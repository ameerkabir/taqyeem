import { afterEach } from "remix/test";
import { createTestDatabase } from "./db.ts";
import type { Database } from "remix/data-table";

const opened: Database[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((db) => db.close()));
});
export async function testDatabase() {
  let db = await createTestDatabase();
  opened.push(db);
  return db;
}
