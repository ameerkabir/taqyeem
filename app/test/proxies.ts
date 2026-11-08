import type { createTestDatabase } from "./db.ts";

type TestDb = Awaited<ReturnType<typeof createTestDatabase>>;

/**
 * Wraps a database so the first `findOne` on `table` returns null, as if a concurrent
 * request had not yet inserted the row. Used to exercise "lost the race" recovery paths.
 */
export function hideFirstFindOne(db: TestDb, table: unknown): TestDb {
  let hidden = false;
  return new Proxy(db, {
    get(target, property) {
      let value = Reflect.get(target, property, target);
      if (property === "findOne") {
        return async (candidate: unknown, ...rest: unknown[]) => {
          if (!hidden && candidate === table) {
            hidden = true;
            return null;
          }
          return (value as (...args: unknown[]) => unknown).call(target, candidate, ...rest);
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as TestDb;
}
