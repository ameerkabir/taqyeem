import type { Database } from "remix/data-table";
import { boards } from "../../data/tables.ts";

export async function insertBoard(db: Database, title: string) {
  return db.create(
    boards,
    // The CHECK cannot reject whitespace-only titles, so trim here as well as in the form.
    { id: crypto.randomUUID(), title: title.trim() },
    { returnRow: true },
  );
}

export async function findBoard(db: Database, id: string) {
  return db.find(boards, id);
}
