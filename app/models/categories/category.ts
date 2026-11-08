import type { Database } from "remix/data-table";
import { categories } from "../../data/tables.ts";

// One createMany = one statement, so the labels land together or not at all.
// Positions follow the order given, starting at 0.
export async function insertCategories(
  db: Database,
  boardId: string,
  labels: readonly string[],
) {
  let clean = labels.map((label) => label.trim());
  // "A board has at least one category" cannot be a database constraint, so refuse before writing.
  if (clean.length === 0) throw new Error("A board needs at least one category");
  return db.createMany(
    categories,
    clean.map((label, position) => ({
      id: crypto.randomUUID(),
      board_id: boardId,
      label,
      position,
    })),
    { returnRows: true },
  );
}

export async function listCategories(db: Database, boardId: string) {
  return db.findMany(categories, {
    where: { board_id: boardId },
    orderBy: ["position", "asc"],
  });
}
