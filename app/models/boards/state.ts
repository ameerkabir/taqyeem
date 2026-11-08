import type { Database } from "remix/data-table";
import type { Board, BoardStatus } from "../../data/board.ts";
import { boards } from "../../data/tables.ts";
import { loadBoard } from "./load.ts";

/** Voting cannot be opened on a closed board. */
export class BoardClosedError extends Error {
  constructor() {
    super("Voting cannot be opened on a closed board");
    this.name = "BoardClosedError";
  }
}

/**
 * Closing voting is always allowed. Opening it on a closed board throws BoardClosedError
 * (the database CHECK also forbids it, but this gives callers a precise error).
 * Returns null when the board does not exist.
 */
export async function setVotingOpen(
  db: Database,
  boardId: string,
  votingOpen: boolean,
): Promise<Board | null> {
  let row = await db.find(boards, boardId);
  if (!row) return null;
  if (votingOpen && row.status === "closed") throw new BoardClosedError();

  await db.update(boards, boardId, { voting_open: votingOpen ? 1 : 0 });
  return loadBoard(db, boardId);
}

/**
 * One UPDATE sets every column the new status implies, so there is no half-applied state:
 * - closed also closes voting
 * - anything other than meeting clears the active section (it only has meaning in a meeting)
 * Returns null when the board does not exist.
 */
export async function setBoardStatus(
  db: Database,
  boardId: string,
  status: BoardStatus,
): Promise<Board | null> {
  let changes: {
    status: BoardStatus;
    voting_open?: number;
    current_section_id?: string | null;
  } = { status };
  if (status === "closed") changes.voting_open = 0;
  if (status !== "meeting") changes.current_section_id = null;

  let result = await db.updateMany(boards, changes, { where: { id: boardId } });
  if (result.affectedRows === 0) return null;
  return loadBoard(db, boardId);
}
