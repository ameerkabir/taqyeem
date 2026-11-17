import type { BoardModels } from "../board-models.ts";
import { CommandError } from "./session.ts";

/**
 * Turns the owner name typed into an action form into a member id. Blank means
 * unassigned (""); a name that matches no member of this board is rejected.
 */
export async function resolveOwner(
  models: Pick<BoardModels, "listMembers">,
  boardId: string,
  name: FormDataEntryValue | null,
): Promise<string> {
  let search = String(name ?? "").trim();
  if (!search) return "";
  let owner = (await models.listMembers(boardId)).find(
    (m) => m.displayName === search,
  );
  if (!owner) throw new CommandError("invalid", 400);
  return owner.id;
}
