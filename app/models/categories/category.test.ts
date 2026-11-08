import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { MAX_CATEGORY_LABEL_LENGTH } from "../../data/limits.ts";
import { boards } from "../../data/tables.ts";
import { createTestDatabase } from "../../test/db.ts";
import { insertBoard } from "../boards/board.ts";
import { insertCategories, listCategories } from "./category.ts";

type TestDb = Awaited<ReturnType<typeof createTestDatabase>>;

async function countCategories(db: TestDb) {
  return (await db.exec("SELECT count(*) AS total FROM categories")).rows?.[0]
    .total;
}

async function withDb(run: (db: TestDb) => Promise<void>) {
  let db = await createTestDatabase();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

describe("categories model", () => {
  it("stores labels in the given order with positions from 0", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      await insertCategories(db, board.id, ["ما سار بشكل جيد", "ما يحتاج تحسين", "أفكار"]);
      let rows = await listCategories(db, board.id);
      assert.deepEqual(
        rows.map((row) => [row.label, row.position]),
        [["ما سار بشكل جيد", 0], ["ما يحتاج تحسين", 1], ["أفكار", 2]],
      );
    });
  });

  it("lists only the categories of the requested board", async () => {
    await withDb(async (db) => {
      let a = await insertBoard(db, "A");
      let b = await insertBoard(db, "B");
      await insertCategories(db, a.id, ["One", "Two"]);
      await insertCategories(db, b.id, ["Only"]);
      assert.equal((await listCategories(db, a.id)).length, 2);
      assert.equal((await listCategories(db, b.id)).length, 1);
    });
  });

  it("trims labels", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      await insertCategories(db, board.id, ["  Good  "]);
      assert.equal((await listCategories(db, board.id))[0].label, "Good");
    });
  });

  it("refuses an empty list and writes nothing", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      await assert.rejects(() => insertCategories(db, board.id, []));
      assert.equal(await countCategories(db), 0);
    });
  });

  it("writes nothing when any label in the batch is invalid", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      await assert.rejects(() => insertCategories(db, board.id, ["Good", "   "]));
      assert.equal(await countCategories(db), 0);
    });
  });

  it("accepts the maximum label length and rejects one over", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      await insertCategories(db, board.id, ["a".repeat(MAX_CATEGORY_LABEL_LENGTH)]);
      let other = await insertBoard(db, "Other");
      await assert.rejects(() =>
        insertCategories(db, other.id, ["a".repeat(MAX_CATEGORY_LABEL_LENGTH + 1)]),
      );
      assert.equal(await countCategories(db), 1);
    });
  });

  it("rejects categories for a board that does not exist", async () => {
    await withDb(async (db) => {
      await assert.rejects(() =>
        insertCategories(db, crypto.randomUUID(), ["Good"]),
      );
      assert.equal(await countCategories(db), 0);
    });
  });

  it("rejects a second batch at positions already taken on the same board", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      await insertCategories(db, board.id, ["Good", "Bad"]);
      await assert.rejects(() => insertCategories(db, board.id, ["Again"]));
      assert.equal(await countCategories(db), 2);
    });
  });

  it("allows the same label on different boards", async () => {
    await withDb(async (db) => {
      let a = await insertBoard(db, "A");
      let b = await insertBoard(db, "B");
      await insertCategories(db, a.id, ["Good"]);
      await insertCategories(db, b.id, ["Good"]);
      assert.equal(await countCategories(db), 2);
    });
  });

  it("deletes a board's categories with the board, and no one else's", async () => {
    await withDb(async (db) => {
      let a = await insertBoard(db, "A");
      let b = await insertBoard(db, "B");
      await insertCategories(db, a.id, ["One", "Two"]);
      await insertCategories(db, b.id, ["Three"]);
      assert.equal(await db.delete(boards, a.id), true);
      assert.equal((await listCategories(db, a.id)).length, 0);
      assert.equal((await listCategories(db, b.id)).length, 1);
    });
  });
});
