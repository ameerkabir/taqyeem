import { Database } from "remix/data-table";
import { createD1Driver } from "./d1-driver.ts";

// Cache by binding, not by request. Never capture an ExecutionContext here.
const databases = new WeakMap<D1Database, Database>();
export function openDatabase(binding: D1Database): Database {
  let db = databases.get(binding);
  if (!db) {
    db = new Database(createD1Driver(binding));
    databases.set(binding, db);
  }
  return db;
}
