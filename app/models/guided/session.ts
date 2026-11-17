import { sql, type Database } from "remix/data-table";
import type { Board, Card, Category, Member } from "../../data/board.ts";
import { loadBoard, loadCategories, loadMembers } from "../boards/load.ts";
import { listCards } from "../cards/card.ts";

import { stages, type Stage } from "./stages.ts";
export { stages, type Stage } from "./stages.ts";
export type Disposition = "suggested" | "agreed" | "deferred" | "declined";
export interface Theme {
  id: string;
  title: string;
  notes: string[];
}
export interface Topic {
  id: string;
  title: string;
  notes: string[];
}
export interface Proposal {
  id: string;
  text: string;
  topic: string;
  author: string;
  owner: string;
  due: string;
  disposition: Disposition;
  completed: boolean;
  updatedAt: string;
}
export interface Closure {
  at: string;
  topics: Topic[];
  outcomes: Record<string, string>;
  decisions: Record<string, string>;
  proposals: Proposal[];
  cards: Card[];
  categories: Category[];
}
export interface MeetingRecord {
  version: number;
  closedAt: string;
  closure: Closure;
}
export interface SharedSession {
  stage: Stage;
  categorySetup?: {
    confirmed: boolean;
    categories: { id: string; label: string; tone: number }[];
  };
  themes: Theme[];
  budget: number;
  ballot: number;
  ballotOpen: boolean;
  votes: Record<string, string[]>;
  ready: Record<string, boolean>;
  liveTopic: string;
  outcomes: Record<string, "discussed" | "skipped">;
  decisions: Record<string, string>;
  proposals: Proposal[];
  receipts: Record<string, string>;
  receipt?: { id: string; member: string; fingerprint: string; kind?: string };
  closure: Closure | null;
  closureVersion?: number;
  legacy: boolean;
  recent?: Record<string, number[]>;
}
export interface SessionView {
  revision: number;
  state: SharedSession;
  board: Board;
  cards: Card[];
  categories: Category[];
  members: Member[];
  history?: { version: number; closedAt: string }[];
}
export class CommandError extends Error {
  constructor(
    public code:
      | "conflict"
      | "forbidden"
      | "invalid"
      | "duplicateTheme"
      | "locked"
      | "budget"
      | "rate"
      | "storage",
    public status = 409,
  ) {
    super(code);
  }
}
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
export async function hasGuidedSession(db: Database, boardId: string) {
  return Boolean(
    (
      await db.exec(
        sql`SELECT board_id FROM guided_sessions WHERE board_id=${boardId}`,
      )
    ).rows?.length,
  );
}
export async function readSession(
  db: Database,
  boardId: string,
  legacy = false,
  requireCategorySetup = false,
): Promise<SessionView | null> {
  let board = await loadBoard(db, boardId);
  if (!board) return null;
  await db.exec(
    sql`INSERT OR IGNORE INTO guided_sessions(board_id,data) VALUES (${boardId},${JSON.stringify({ ...initialState(board), legacy: legacy || board.status !== "collecting", ...(requireCategorySetup ? { categorySetup: { confirmed: false, categories: [] } } : {}) })})`,
  );
  // Read revision first: any evidence mutation during subsequent reads makes command CAS fail.
  let row = (
    await db.exec(
      sql`SELECT revision,data FROM guided_sessions WHERE board_id=${boardId}`,
    )
  ).rows![0];
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
export function topics(view: Pick<SessionView, "cards" | "state">): Topic[] {
  let grouped = new Set(view.state.themes.flatMap((t) => t.notes));
  // Source order, not theme name, locale, vote time or display shelf, breaks ties.
  let rank = new Map(view.cards.map((c, i) => [c.id, i]));
  return [
    ...view.state.themes.map((t) => ({ ...t })),
    ...view.cards
      .filter((c) => !grouped.has(c.id))
      .map((c) => ({ id: c.id, title: c.body, notes: [c.id] })),
  ].sort(
    (a, b) =>
      Math.min(...a.notes.map((id) => rank.get(id) ?? Infinity)) -
      Math.min(...b.notes.map((id) => rank.get(id) ?? Infinity)),
  );
}
export function rankedTopics(view: SessionView): Topic[] {
  let counts = tally(view.state);
  return topics(view).sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
}
export function tally(state: SharedSession): Record<string, number> {
  let counts: Record<string, number> = {};
  for (let votes of Object.values(state.votes))
    for (let id of votes) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}
export interface Command {
  id: string;
  revision: number;
  kind: string;
  [key: string]: unknown;
}
function text(value: unknown, max = 500): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new CommandError("invalid", 400);
  return value.trim();
}
function requireThat(
  ok: unknown,
  code: CommandError["code"] = "locked",
  status = 409,
): asserts ok {
  if (!ok) throw new CommandError(code, status);
}
function themeNameKey(title: string) {
  return title
    .normalize("NFKC")
    .replace(/\p{Default_Ignorable_Code_Point}/gu, "")
    .trim()
    .replace(/\s+/gu, " ")
    .toLowerCase();
}
function uniqueThemeTitle(
  state: SharedSession,
  value: unknown,
  exceptId?: string,
) {
  const title = text(value, 160),
    key = themeNameKey(title);
  requireThat(
    key.length > 0 && !/[\u0000-\u001f\u007f]/.test(title),
    "invalid",
    400,
  );
  requireThat(
    !state.themes.some(
      (theme) => theme.id !== exceptId && themeNameKey(theme.title) === key,
    ),
    "duplicateTheme",
    400,
  );
  return title;
}
export function applyCommand(
  view: SessionView,
  memberId: string,
  command: Command,
): SharedSession {
  let { board, cards, members } = view;
  requireThat(
    members.some((m) => m.id === memberId),
    "forbidden",
    403,
  );
  let state = structuredClone(view.state);
  requireThat(
    Number.isSafeInteger(command.revision) &&
      command.revision === view.revision,
    "conflict",
  );
  requireThat(
    typeof command.id === "string" && /^[0-9a-f-]{36}$/i.test(command.id),
    "invalid",
    400,
  );
  const now = Date.now();
  const recent = (state.recent?.[memberId] ?? []).filter(
    (at) => at > now - 60000,
  );
  requireThat(recent.length < 60, "rate", 429);
  state.recent = { ...state.recent, [memberId]: [...recent, now] };
  const facilitator = board.organiserMemberId === memberId;
  const shared = () => requireThat(facilitator, "forbidden", 403);
  const topic = () => {
    let id = text(command.topic, 100);
    requireThat(
      topics(view).some((t) => t.id === id),
      "invalid",
      400,
    );
    return id;
  };
  const noClosure = () => requireThat(state.stage !== "summary");
  requireThat(
    state.categorySetup?.confirmed !== false || command.kind === "configure",
  );
  switch (command.kind) {
    case "reopen": {
      shared();
      requireThat(state.stage === "summary" && state.closure !== null);
      const version = state.closureVersion ?? 1;
      requireThat(
        Number.isSafeInteger(command.version) && command.version === version,
        "conflict",
      );
      state.closureVersion = version;
      state.closure = null;
      state.stage = "discuss";
      state.ready = {};
      state.ballotOpen = false;
      if (!topics(view).some((topic) => topic.id === state.liveTopic))
        state.liveTopic = rankedTopics(view)[0]?.id ?? "";
      break;
    }
    case "configure": {
      shared();
      requireThat(
        state.stage === "collect" &&
          cards.length === 0 &&
          state.categorySetup?.confirmed === false,
      );
      requireThat(
        command.choice === "classic" || command.choice === "custom",
        "invalid",
        400,
      );
      let labels =
        command.choice === "classic"
          ? view.categories.map((c) => c.label)
          : command.labels;
      requireThat(
        Array.isArray(labels) && labels.length >= 1 && labels.length <= 8,
        "invalid",
        400,
      );
      const clean = labels.map((label) => text(label, 120));
      requireThat(
        clean.every(
          (label) =>
            !/[\u0000-\u001f\u007f]/.test(label) &&
            label.replace(/\p{Default_Ignorable_Code_Point}/gu, "").trim()
              .length > 0,
        ),
        "invalid",
        400,
      );
      requireThat(
        new Set(
          clean.map((label) => label.normalize("NFKC").toLocaleLowerCase()),
        ).size === clean.length,
        "invalid",
        400,
      );
      state.categorySetup = {
        confirmed: true,
        categories: clean.map((label, i) => ({
          id:
            command.choice === "classic"
              ? view.categories[i].id
              : crypto.randomUUID(),
          label,
          tone: i % 4,
        })),
      };
      break;
    }
    case "advance": {
      shared();
      noClosure();
      if (state.stage === "vote") requireThat(!state.ballotOpen);
      let next = stages[stages.indexOf(state.stage) + 1];
      state.stage = next;
      state.ready = {};
      if (next === "vote") {
        state.ballot++;
        state.ballotOpen = true;
        state.votes = {};
      }
      if (next === "discuss") state.liveTopic = rankedTopics(view)[0]?.id ?? "";
      if (next === "summary") {
        state.closureVersion = (state.closureVersion ?? 0) + 1;
        state.closure = {
          at: new Date().toISOString(),
          topics: rankedTopics(view),
          outcomes: structuredClone(state.outcomes),
          decisions: structuredClone(state.decisions),
          proposals: structuredClone(state.proposals),
          cards: structuredClone(cards),
          categories: structuredClone(view.categories),
        };
      }
      break;
    }
    case "ready":
      requireThat(
        state.stage === "collect" ||
          (state.stage === "vote" && state.ballotOpen),
      );
      requireThat(typeof command.value === "boolean", "invalid", 400);
      state.ready[memberId] = command.value;
      break;
    case "budget":
      shared();
      requireThat(state.stage === "collect" || state.stage === "group");
      requireThat(
        Number.isInteger(command.value) &&
          Number(command.value) >= 1 &&
          Number(command.value) <= 20,
        "invalid",
        400,
      );
      state.budget = Number(command.value);
      break;
    case "theme": {
      shared();
      requireThat(state.stage === "group");
      let target = state.themes.find((theme) => theme.id === command.theme);
      requireThat(
        command.theme === undefined || command.theme === "" || target,
        "invalid",
        400,
      );
      let ids = command.notes;
      requireThat(
        Array.isArray(ids) &&
          ids.length > 0 &&
          ids.every(
            (id) => typeof id === "string" && cards.some((c) => c.id === id),
          ),
        "invalid",
        400,
      );
      requireThat(
        new Set(ids).size === ids.length &&
          !state.themes.some((t) => t.notes.some((id) => ids.includes(id))),
        "invalid",
        400,
      );
      if (target) target.notes.push(...ids);
      else
        state.themes.push({
          id: command.id,
          title: uniqueThemeTitle(state, command.title),
          notes: ids,
        });
      break;
    }
    case "rename":
      shared();
      requireThat(state.stage === "group");
      requireThat(
        state.themes.some((t) => t.id === command.theme),
        "invalid",
        400,
      );
      state.themes.find((t) => t.id === command.theme)!.title =
        uniqueThemeTitle(state, command.title, String(command.theme));
      break;
    case "ungroup":
      shared();
      requireThat(state.stage === "group");
      requireThat(
        state.themes.some((t) => t.id === command.theme),
        "invalid",
        400,
      );
      state.themes = state.themes.filter((t) => t.id !== command.theme);
      break;
    case "ballot":
      shared();
      requireThat(state.stage === "vote");
      requireThat(typeof command.value === "boolean", "invalid", 400);
      requireThat(command.ballot === state.ballot, "conflict");
      if (command.value && !state.ballotOpen) {
        state.ballot++;
        state.ready = {};
      }
      state.ballotOpen = command.value;
      break;
    case "vote": {
      requireThat(state.stage === "vote" && state.ballotOpen);
      requireThat(command.ballot === state.ballot, "conflict");
      let id = topic();
      requireThat(typeof command.value === "boolean", "invalid", 400);
      let mine = new Set(state.votes[memberId] ?? []);
      if (command.value) {
        mine.add(id);
        requireThat(mine.size <= state.budget, "budget");
      } else mine.delete(id);
      state.votes[memberId] = [...mine];
      break;
    }
    case "live":
      shared();
      requireThat(state.stage === "discuss");
      state.liveTopic = topic();
      break;
    case "outcome":
      shared();
      requireThat(state.stage === "discuss");
      requireThat(
        command.value === "discussed" || command.value === "skipped",
        "invalid",
        400,
      );
      state.outcomes[topic()] = command.value;
      break;
    case "decision":
      shared();
      requireThat(state.stage === "discuss");
      state.decisions[topic()] = text(command.text, 2000);
      break;
    case "edit-proposal":
    case "propose": {
      requireThat(state.stage === "discuss" || state.stage === "actions");
      let owner = typeof command.owner === "string" ? command.owner : "";
      requireThat(
        !owner || members.some((m) => m.id === owner),
        "invalid",
        400,
      );
      let due = typeof command.due === "string" ? command.due : "";
      requireThat(
        !due ||
          (/^\d{4}-\d{2}-\d{2}$/.test(due) &&
            !Number.isNaN(Date.parse(due)) &&
            new Date(due).toISOString().slice(0, 10) === due),
        "invalid",
        400,
      );
      if (command.kind === "edit-proposal") {
        const proposal = state.proposals.find((p) => p.id === command.proposal);
        requireThat(proposal, "invalid", 400);
        requireThat(
          facilitator ||
            (proposal.author === memberId &&
              proposal.disposition === "suggested"),
          "forbidden",
          403,
        );
        Object.assign(proposal, {
          text: text(command.text),
          owner,
          due,
          topic: command.topic ? topic() : "",
          updatedAt: new Date().toISOString(),
        });
      } else {
        state.proposals.push({
          id: command.id,
          text: text(command.text),
          topic: command.topic ? topic() : "",
          author: memberId,
          owner,
          due,
          disposition: facilitator ? "agreed" : "suggested",
          completed: false,
          updatedAt: new Date().toISOString(),
        });
      }
      break;
    }
    case "disposition": {
      shared();
      requireThat(state.stage === "discuss" || state.stage === "actions");
      requireThat(
        ["agreed", "deferred", "declined"].includes(String(command.value)),
        "invalid",
        400,
      );
      let p = state.proposals.find((p) => p.id === command.proposal);
      requireThat(p, "invalid", 400);
      p.disposition = command.value as Disposition;
      p.updatedAt = new Date().toISOString();
      break;
    }
    case "complete": {
      let p = state.proposals.find((p) => p.id === command.proposal);
      requireThat(p && p.disposition === "agreed", "invalid", 400);
      requireThat(facilitator || p.owner === memberId, "forbidden", 403);
      requireThat(typeof command.value === "boolean", "invalid", 400);
      p.completed = command.value;
      p.updatedAt = new Date().toISOString();
      break;
    }
    default:
      throw new CommandError("invalid", 400);
  }
  return state;
}
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
  const rawFingerprint = JSON.stringify({ ...command, revision: undefined });
  requireThat(rawFingerprint.length <= 65536, "invalid", 400);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawFingerprint),
  );
  const fingerprint = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
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
  };
  let requiresFacilitator = [
    "configure",
    "reopen",
    "advance",
    "budget",
    "theme",
    "rename",
    "ungroup",
    "ballot",
    "live",
    "outcome",
    "decision",
    "disposition",
  ].includes(command.kind);
  let result =
    await db.exec(sql`UPDATE guided_sessions SET data=${JSON.stringify(state)},revision=revision+1 WHERE board_id=${boardId} AND revision=${view.revision}
  AND EXISTS(SELECT 1 FROM members WHERE id=${memberId} AND board_id=${boardId} AND (${requiresFacilitator ? 1 : 0}=0 OR role='organiser'))`);
  if (result.affectedRows !== 1) {
    const winner = await replay();
    if (winner) return winner;
    throw new CommandError("conflict");
  }
  if (
    command.kind === "configure" ||
    command.kind === "reopen" ||
    state.stage === "summary"
  )
    return (await readSession(db, boardId))!;
  return { ...view, state, revision: view.revision + 1 };
}
