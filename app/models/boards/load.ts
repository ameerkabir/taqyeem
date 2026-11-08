import type { Database } from "remix/data-table";
import type { Board, Category, Member } from "../../data/board.ts";
import { boards, members } from "../../data/tables.ts";
import { listCategories as listCategoryRows } from "../categories/category.ts";
import { listMembers as listMemberRows } from "../members/member.ts";

// Rows are snake_case and storage-shaped; the app works with Board/Category/Member.
// This is the one place that converts between them.

/**
 * A board is only "live" when it has an organiser. createBoard cannot guarantee that
 * (no transactions, cleanup is best effort), so a board without one is treated as missing.
 */
export async function loadBoard(db: Database, id: string): Promise<Board | null> {
  let row = await db.find(boards, id);
  if (!row) return null;

  let organiser = await db.findOne(members, {
    where: { board_id: id, role: "organiser" },
  });
  if (!organiser) return null;

  return {
    id: row.id,
    title: row.title,
    organiserMemberId: organiser.id,
    status: row.status,
    votingOpen: row.voting_open === 1,
    currentSectionId: row.current_section_id,
  };
}

export async function loadCategories(db: Database, boardId: string): Promise<Category[]> {
  let rows = await listCategoryRows(db, boardId);
  return rows.map((row) => ({
    id: row.id,
    boardId: row.board_id,
    label: row.label,
    position: row.position,
  }));
}

export async function loadMembers(db: Database, boardId: string): Promise<Member[]> {
  let rows = await listMemberRows(db, boardId);
  return rows.map((row) => ({
    id: row.id,
    boardId: row.board_id,
    displayName: row.display_name,
  }));
}
