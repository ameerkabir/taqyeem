import type { Database } from "remix/data-table";
import { members } from "../../data/tables.ts";

export type MemberRole = "organiser" | "participant";

export async function insertMember(
  db: Database,
  input: { boardId: string; displayName: string; role: MemberRole },
) {
  return db.create(
    members,
    {
      id: crypto.randomUUID(),
      board_id: input.boardId,
      // The CHECK cannot reject whitespace-only names, so trim here as well as in the form.
      display_name: input.displayName.trim(),
      role: input.role,
    },
    { returnRow: true },
  );
}

export async function findMember(db: Database, id: string) {
  return db.find(members, id);
}

export async function listMembers(db: Database, boardId: string) {
  return db.findMany(members, { where: { board_id: boardId } });
}
