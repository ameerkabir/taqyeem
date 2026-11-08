import type { Database } from "remix/data-table";
import { members } from "../../data/tables.ts";
import { memberNameKey } from "./name-key.ts";

export type MemberRole = "organiser" | "participant";

/** Another member of this board already has this name (compared after normalising). */
export class MemberNameTakenError extends Error {
  constructor() {
    super("That name is already used on this board");
    this.name = "MemberNameTakenError";
  }
}

/**
 * Names are unique per board by their normalised key; the database enforces it with a unique
 * index, so two simultaneous joins cannot both win. A failed insert is only reported as a taken
 * name if a member with that key really exists; any other failure is rethrown unchanged.
 * Only this function writes members, which is what keeps name_key filled in.
 */
export async function insertMember(
  db: Database,
  input: { boardId: string; displayName: string; role: MemberRole },
) {
  // The CHECK cannot reject whitespace-only names, so trim here as well as in the form.
  let displayName = input.displayName.trim();
  let nameKey = memberNameKey(displayName);
  // e.g. a name made only of zero-width characters: not empty to trim(), invisible to people.
  if (nameKey === "") throw new Error("A member name must contain a visible character");

  try {
    return await db.create(
      members,
      {
        id: crypto.randomUUID(),
        board_id: input.boardId,
        display_name: displayName,
        name_key: nameKey,
        role: input.role,
      },
      { returnRow: true },
    );
  } catch (error) {
    let clash = await db.findOne(members, {
      where: { board_id: input.boardId, name_key: nameKey },
    });
    if (clash) throw new MemberNameTakenError();
    throw error;
  }
}

export async function findMember(db: Database, id: string) {
  return db.find(members, id);
}

export async function listMembers(db: Database, boardId: string) {
  return db.findMany(members, { where: { board_id: boardId } });
}
