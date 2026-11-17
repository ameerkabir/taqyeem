import { sql, type Database } from "remix/data-table";
import type { Board } from "../../data/board.ts";
import { loadBoard, loadCategories, loadMembers } from "../boards/load.ts";
import { listCards } from "../cards/card.ts";

import type { Stage } from "./stages.ts";
import { CommandError } from "./errors.ts";
import { requireThat } from "./validation.ts";
import { commandFingerprint } from "./fingerprint.ts";
import { applyCommand, handlerFor } from "./commands/index.ts";
import type {
  Command,
  GuidedStatus,
  MeetingRecord,
  SessionView,
  SharedSession,
} from "./types.ts";

// Storage for guided sessions. Command rules live in ./commands; this module
// reads sessions and commits commands with revision-guarded writes.
export { stages, type Stage } from "./stages.ts";
export { topics, type Theme, type Topic } from "./topics.ts";
export { CommandError } from "./errors.ts";
export { tally, rankedTopics } from "./ranking.ts";
export { applyCommand } from "./commands/index.ts";
export type * from "./types.ts";

/** The starting state for a board's first guided session, honouring its legacy status. */
export function initialState(board: Board): SharedSession {
  return {
    stage:
      board.status === "closed"
        ? "summary"
        : board.status === "meeting"
          ? "discuss"
          : "collect",
    themes: [],
    budget: 5,
    ballot: 0,
    ballotOpen: false,
    votes: {},
    ready: {},
    liveTopic: "",
    outcomes: {},
    decisions: {},
    proposals: [],
    receipts: {},
    closure: null,
    closureVersion: 0,
    legacy: board.status !== "collecting",
  };
}
/** The guided facts every board request needs, in one read; null for legacy boards. */
export async function readGuidedStatus(
  db: Database,
  boardId: string,
): Promise<GuidedStatus | null> {
  let row = (
    await db.exec(
      sql`SELECT revision,json_extract(data,'$.categorySetup.confirmed') AS configured,json_extract(data,'$.stage') AS stage FROM guided_sessions WHERE board_id=${boardId}`,
    )
  ).rows?.[0];
  return row
    ? {
        stage: String(row.stage) as Stage,
        revision: Number(row.revision),
        categorySetupRequired: row.configured === 0,
      }
    : null;
}
/**
 * Starts a guided session for a board. `created` is false when one already existed
 * (a competing create or a retried conversion), so callers can report the conflict.
 */
export async function createSession(
  db: Database,
  boardId: string,
  { legacy = false, requireCategorySetup = false } = {},
): Promise<{ created: boolean; view: SessionView } | null> {
  let board = await loadBoard(db, boardId);
  if (!board) return null;
  let result = await db.exec(
    sql`INSERT OR IGNORE INTO guided_sessions(board_id,data) VALUES (${boardId},${JSON.stringify({ ...initialState(board), legacy: legacy || board.status !== "collecting", ...(requireCategorySetup ? { categorySetup: { confirmed: false, categories: [] } } : {}) })})`,
  );
  let view = await readSession(db, boardId);
  return view ? { created: result.affectedRows === 1, view } : null;
}
/** Read-only: null when the board does not exist or has no guided session. */
export async function readSession(
  db: Database,
  boardId: string,
): Promise<SessionView | null> {
  let board = await loadBoard(db, boardId);
  if (!board) return null;
  // Read revision first: any evidence mutation during subsequent reads makes command CAS fail.
  let row = (
    await db.exec(
      sql`SELECT revision,data FROM guided_sessions WHERE board_id=${boardId}`,
    )
  ).rows?.[0];
  if (!row) return null;
  let [cards, categories, members, records] = await Promise.all([
    listCards(db, boardId),
    loadCategories(db, boardId),
    loadMembers(db, boardId),
    db.exec(
      sql`SELECT version,closed_at FROM guided_closures WHERE board_id=${boardId} ORDER BY version DESC`,
    ),
  ]);
  return {
    board,
    revision: Number(row.revision),
    state: JSON.parse(String(row.data)),
    cards,
    categories,
    members,
    history: records.rows!.map((row) => ({
      version: Number(row.version),
      closedAt: String(row.closed_at),
    })),
  };
}
export async function readMeetingRecord(
  db: Database,
  boardId: string,
  version: number,
): Promise<MeetingRecord | null> {
  if (!Number.isSafeInteger(version) || version < 1) return null;
  const row = (
    await db.exec(
      sql`SELECT closed_at,snapshot FROM guided_closures WHERE board_id=${boardId} AND version=${version}`,
    )
  ).rows?.[0];
  return row
    ? {
        version,
        closedAt: String(row.closed_at),
        closure: JSON.parse(String(row.snapshot)),
      }
    : null;
}
/**
 * Commits one command: replays a repeated command id, otherwise applies it and
 * writes the new state only if the revision is unchanged and the actor still has
 * the role it needs. Returns the committed view (re-read when triggers changed
 * other rows), or the replayed view for a retry.
 * @throws {CommandError} `conflict` when another command won the revision.
 */
export async function commandSession(
  db: Database,
  boardId: string,
  memberId: string,
  command: Command,
) {
  let view = await readSession(db, boardId);
  if (!view) throw new CommandError("invalid", 404);
  requireThat(
    view.members.some((m) => m.id === memberId),
    "forbidden",
    403,
  );
  const { raw: rawFingerprint, digest: fingerprint } =
    await commandFingerprint(command);
  async function replay() {
    const row = (
      await db.exec(
        sql`SELECT member_id,fingerprint FROM guided_command_receipts WHERE board_id=${boardId} AND command_id=${command.id}`,
      )
    ).rows?.[0];
    if (!row) return null;
    requireThat(
      row.member_id === memberId &&
        (row.fingerprint === fingerprint || row.fingerprint === rawFingerprint),
      "invalid",
      400,
    );
    return readSession(db, boardId);
  }
  const prior = await replay();
  if (prior) return prior;
  let state = applyCommand(view, memberId, command);
  state.receipt = {
    id: command.id,
    member: memberId,
    fingerprint,
    kind: command.kind,
    ...(command.kind === "move-note"
      ? {
          move: {
            card: String(command.card),
            fromCategory: String(command.fromCategory),
            categoryId: String(command.categoryId),
          },
        }
      : {}),
  };
  const handler = handlerFor(command.kind)!;
  let requiresFacilitator = handler.facilitatorOnly;
  let result =
    await db.exec(sql`UPDATE guided_sessions SET data=${JSON.stringify(state)},revision=revision+1 WHERE board_id=${boardId} AND revision=${view.revision}
  AND EXISTS(SELECT 1 FROM members WHERE id=${memberId} AND board_id=${boardId} AND (${requiresFacilitator ? 1 : 0}=0 OR role='organiser'))`);
  if (result.affectedRows !== 1) {
    const winner = await replay();
    if (winner) return winner;
    throw new CommandError("conflict");
  }
  // Closing writes a meeting record, so re-read to include it in `history`.
  if (handler.changesEvidence || state.stage === "summary")
    return (await readSession(db, boardId))!;
  return { ...view, state, revision: view.revision + 1 };
}
