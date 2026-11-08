import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import type { Database } from "remix/data-table";
import { boards, categories, members } from "../../data/tables.ts";
import { createAppRouter } from "../../router.ts";
import { routes } from "../../routes.ts";
import { testDatabase } from "../../test/dependencies.ts";

const options = {
  sessionSecret: "test-only-session-secret",
  config: { appEnv: "test" },
  waitUntil() {},
};

function submit(db: Database, fields: Record<string, string>, headers: Record<string, string> = {}) {
  return createAppRouter({ ...options, db }).fetch(
    new Request("http://localhost" + routes.newBoard.action.href(), {
      method: "POST",
      body: new URLSearchParams(fields),
      headers,
    }),
  );
}

/** A database whose writes to the given tables (or deletes) fail, to simulate D1 errors. */
function failing(db: Database, options: { create?: unknown[]; delete?: boolean }): Database {
  return new Proxy(db, {
    get(target, property) {
      let value = Reflect.get(target, property, target);
      // Rows are written with create (one row) or createMany (e.g. all the categories).
      if ((property === "create" || property === "createMany") && options.create) {
        return async (table: unknown, ...rest: unknown[]) => {
          if (options.create!.includes(table)) throw new Error("simulated write failure");
          return (value as (...args: unknown[]) => unknown).call(target, table, ...rest);
        };
      }
      if (property === "delete" && options.delete) {
        return async () => {
          throw new Error("simulated delete failure");
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Database;
}

const valid = { title: "لوحة اختبار", organiserDisplayName: "منظم" };

describe("new board action", () => {
  it("persists the board, its organiser and the default categories, then redirects to it", async () => {
    let db = await testDatabase();
    let response = await submit(db, valid);
    assert.equal(response.status, 303);

    let [board] = await db.findMany(boards);
    assert.equal(board.title, "لوحة اختبار");
    assert.equal(response.headers.get("Location"), routes.board.href({ boardId: board.id }));
    assert.equal((await db.findMany(members, { where: { board_id: board.id } })).length, 1);
    assert.equal((await db.findMany(categories, { where: { board_id: board.id } })).length, 3);
    assert.match(response.headers.get("Set-Cookie") ?? "", /^taqyeem_session=/);
  });

  it("still validates input before touching the database", async () => {
    let db = await testDatabase();
    let response = await submit(db, { title: "   ", organiserDisplayName: "منظم" });
    assert.equal(response.status, 400);
    assert.equal((await db.findMany(boards)).length, 0);
  });

  it("shows a retry message, keeps the typed values, and leaves no board when saving fails", async () => {
    let db = await testDatabase();
    let response = await submit(failing(db, { create: [members] }), valid, {
      "Accept-Language": "en",
    });
    assert.equal(response.status, 500);
    let html = await response.text();
    assert.ok(html.includes("the board was not created"));
    assert.ok(html.includes("لوحة اختبار"));
    assert.ok(html.includes('role="alert"'));
    assert.ok(!html.includes("simulated write failure"));
    assert.equal(response.headers.get("Location"), null);
    assert.equal((await db.findMany(boards)).length, 0);
  });

  it("shows the message in Arabic by default", async () => {
    let db = await testDatabase();
    let response = await submit(failing(db, { create: [categories] }), valid);
    assert.equal(response.status, 500);
    assert.ok((await response.text()).includes("لم يتم إنشاء اللوحة"));
    assert.equal((await db.findMany(boards)).length, 0);
  });

  it("can be retried after a failure", async () => {
    let db = await testDatabase();
    assert.equal((await submit(failing(db, { create: [members] }), valid)).status, 500);
    assert.equal((await submit(db, valid)).status, 303);
    assert.equal((await db.findMany(boards)).length, 1);
  });

  it("still reports a retry page when cleanup fails too, without leaking the error", async () => {
    let db = await testDatabase();
    let response = await submit(failing(db, { create: [members], delete: true }), valid, {
      "Accept-Language": "en",
    });
    assert.equal(response.status, 500);
    let html = await response.text();
    assert.ok(html.includes("the board was not created"));
    assert.ok(!html.includes("simulated"));
    // The orphan stays in the table but is invisible: it has no organiser.
    assert.equal((await db.findMany(boards)).length, 1);
  });
});
