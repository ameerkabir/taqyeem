import type { Database } from "remix/data-table";
import { insertMember, MemberNameTakenError } from "../members/member.ts";
import type { JoinBoardResult } from "../board-models.ts";
import { loadBoard } from "./load.ts";

/**
 * Adds a participant to a board. Returns null when there is no such (live) board, and a
 * refusal when the board is closed or the name is already taken on it. The name is trimmed and length-checked by the member
 * insert, which throws on a blank or over-long name; the form validates first.
 *
 * Joining is one insert, so there is no partial state to clean up. If the board closes
 * between the check and the insert the member is still added, which is harmless.
 */
export async function joinBoard(
  db: Database,
  boardId: string,
  displayName: string,
): Promise<JoinBoardResult | null> {
  let board = await loadBoard(db, boardId);
  if (!board) return null;
  if (board.status === "closed") return { ok: false, reason: "closed" };

  try {
    let row = await insertMember(db, { boardId, displayName, role: "participant" });
    return {
      ok: true,
      member: { id: row.id, boardId: row.board_id, displayName: row.display_name },
    };
  } catch (error) {
    // Names are unique per board (normalised), including the organiser's.
    if (error instanceof MemberNameTakenError) return { ok: false, reason: "name_taken" };
    throw error;
  }
}
