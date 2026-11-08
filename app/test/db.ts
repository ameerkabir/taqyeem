import { readdir, readFile } from "node:fs/promises";
import { createSqliteDatabase } from "remix/data-table/sqlite";

export const migrationsDirectory = new URL("../../database/migrations/", import.meta.url);

// Fresh database each time; replay the same flat numbered SQL files Wrangler uses.
// No second migration journal is needed for an empty, disposable test database.
export async function createTestDatabase(directory: URL = migrationsDirectory) {
  let db = createSqliteDatabase({ filename: ":memory:", foreignKeys: true });
  try {
    let files = (await readdir(directory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
    for (let file of files) await db.executeScript(await readFile(new URL(file, directory), "utf8"));
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
