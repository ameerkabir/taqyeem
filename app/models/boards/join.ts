import type { Database } from "remix/data-table";
import { insertMember, MemberNameTakenError } from "../members/member.ts";
import type { JoinBoardResult } from "../board-models.ts";
import { loadBoard } from "./load.ts";

/**
 * Adds a participant to a board, whatever its status. Returns null when there is no such
 * (live) board, and a refusal when the name is already taken on it. The name is trimmed and
 * length-checked by the member insert, which throws on a blank or over-long name; the form
 * validates first.
 *
 * A closed board still accepts members: closing stops contributions (notes, edits, deletes,
 * votes), which the contribution routes enforce, not who may join and read. The member is an
 * ordinary participant with no special role, so if the organiser reopens the board they simply
 * get whatever the board's current state allows.
 *
 * Joining is one insert, so there is no partial state to clean up.
 */
export async function joinBoard(
  db: Database,
  boardId: string,
  displayName: string,
): Promise<JoinBoardResult | null> {
  let board = await loadBoard(db, boardId);
  if (!board) return null;

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
