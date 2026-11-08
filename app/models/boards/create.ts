import type { Database } from "remix/data-table";
import { boards } from "../../data/tables.ts";
import { insertBoard } from "./board.ts";
import type { CreateBoardInput } from "../board-models.ts";
import { insertCategories } from "../categories/category.ts";
import { insertMember } from "../members/member.ts";

/** The input can never succeed (e.g. no categories). Nothing was written. */
export class CreateBoardInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateBoardInputError";
  }
}

/**
 * A write failed. The partial board is removed on a best-effort basis; retrying is safe.
 * If that removal also failed, `cleanupFailed` is true and `orphanedBoardId` names the
 * leftover board so the caller can log it. `cause` is always the original failure.
 */
export class CreateBoardError extends Error {
  readonly cleanupFailed: boolean;
  readonly orphanedBoardId: string | null;

  constructor(options?: { cause?: unknown; orphanedBoardId?: string }) {
    super("Could not create the board", { cause: options?.cause });
    this.name = "CreateBoardError";
    this.orphanedBoardId = options?.orphanedBoardId ?? null;
    this.cleanupFailed = this.orphanedBoardId !== null;
  }
}

// D1 has no transactions, so this is three independent writes, board first because
// members and categories reference it. If a later write fails we delete the board;
// ON DELETE CASCADE removes whatever else was written in that one statement.
export async function createBoard(db: Database, input: CreateBoardInput) {
  // A board always has at least one category and the database cannot enforce that,
  // so refuse before the first write.
  let labels = input.categoryLabels.map((label) => label.trim());
  if (labels.length === 0 || labels.some((label) => label === "")) {
    throw new CreateBoardInputError("A board needs at least one non-empty category");
  }

  let board;
  try {
    board = await insertBoard(db, input.title);
  } catch (cause) {
    throw new CreateBoardError({ cause }); // nothing written, nothing to clean up
  }

  try {
    let organiser = await insertMember(db, {
      boardId: board.id,
      displayName: input.organiserDisplayName,
      role: "organiser",
    });
    let categories = await insertCategories(db, board.id, labels);
    return { board, organiser, categories };
  } catch (cause) {
    let orphanedBoardId: string | undefined;
    try {
      await db.delete(boards, board.id);
    } catch {
      // Best effort: cleanup must never hide the original failure. Report it instead.
      orphanedBoardId = board.id;
    }
    throw new CreateBoardError({ cause, orphanedBoardId });
  }
}
