import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import {
  MAX_CATEGORY_LABEL_LENGTH,
  MAX_MEMBER_NAME_LENGTH,
} from "../../data/limits.ts";
import { createTestDatabase } from "../../test/db.ts";
import {
  CreateBoardError,
  CreateBoardInputError,
  createBoard,
} from "./create.ts";

type TestDb = Awaited<ReturnType<typeof createTestDatabase>>;

const input = {
  title: "Sprint 12",
  organiserDisplayName: "ريم",
  categoryLabels: ["Good", "Bad", "Ideas"],
};

async function count(db: TestDb, table: "boards" | "members" | "categories") {
  return (await db.exec(`SELECT count(*) AS total FROM ${table}`)).rows?.[0]
    .total;
}

async function counts(db: TestDb) {
  return [
    await count(db, "boards"),
    await count(db, "members"),
    await count(db, "categories"),
  ];
}

async function withDb(run: (db: TestDb) => Promise<void>) {
  let db = await createTestDatabase();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

async function caught(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return error;
  }
  assert.fail("expected the call to throw");
}

describe("createBoard", () => {
  it("writes the board, one organiser and every category", async () => {
    await withDb(async (db) => {
      let result = await createBoard(db, input);
      assert.equal(result.board.title, "Sprint 12");
      assert.equal(result.organiser.board_id, result.board.id);
      assert.equal(result.organiser.role, "organiser");
      assert.deepEqual(
        result.categories.map((row) => [row.label, row.position]),
        [["Good", 0], ["Bad", 1], ["Ideas", 2]],
      );
      assert.deepEqual(await counts(db), [1, 1, 3]);
    });
  });

  it("creates independent boards for the same input", async () => {
    await withDb(async (db) => {
      let first = await createBoard(db, input);
      let second = await createBoard(db, input);
      assert.notEqual(first.board.id, second.board.id);
      assert.deepEqual(await counts(db), [2, 2, 6]);
    });
  });

  it("refuses missing or blank categories before writing anything", async () => {
    await withDb(async (db) => {
      for (let categoryLabels of [[], ["Good", "   "]]) {
        let error = await caught(() => createBoard(db, { ...input, categoryLabels }));
        assert.ok(error instanceof CreateBoardInputError);
      }
      assert.deepEqual(await counts(db), [0, 0, 0]);
    });
  });

  it("throws CreateBoardError and writes nothing when the title is invalid", async () => {
    await withDb(async (db) => {
      let error = await caught(() => createBoard(db, { ...input, title: "   " }));
      assert.ok(error instanceof CreateBoardError);
      assert.deepEqual(await counts(db), [0, 0, 0]);
    });
  });

  it("removes the board when the organiser insert fails", async () => {
    await withDb(async (db) => {
      let error = await caught(() =>
        createBoard(db, {
          ...input,
          organiserDisplayName: "a".repeat(MAX_MEMBER_NAME_LENGTH + 1),
        }),
      );
      assert.ok(error instanceof CreateBoardError);
      assert.deepEqual(await counts(db), [0, 0, 0]);
    });
  });

  it("removes the board and organiser when the categories insert fails", async () => {
    await withDb(async (db) => {
      let error = await caught(() =>
        createBoard(db, {
          ...input,
          categoryLabels: ["Good", "a".repeat(MAX_CATEGORY_LABEL_LENGTH + 1)],
        }),
      );
      assert.ok(error instanceof CreateBoardError);
      assert.deepEqual(await counts(db), [0, 0, 0]);
      assert.equal(error.cleanupFailed, false);
      assert.equal(error.orphanedBoardId, null);
    });
  });

  it("can be retried after a failure and then succeeds", async () => {
    await withDb(async (db) => {
      await caught(() =>
        createBoard(db, {
          ...input,
          categoryLabels: ["a".repeat(MAX_CATEGORY_LABEL_LENGTH + 1)],
        }),
      );
      await createBoard(db, input);
      assert.deepEqual(await counts(db), [1, 1, 3]);
    });
  });

  it("reports the original failure even when cleanup also fails", async () => {
    await withDb(async (db) => {
      // Cleanup is best effort; here it fails too, so the orphan board remains.
      let brokenCleanup = new Proxy(db, {
        get(target, property) {
          if (property === "delete") {
            return async () => {
              throw new Error("delete failed");
            };
          }
          let value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      let error = await caught(() =>
        createBoard(brokenCleanup, {
          ...input,
          categoryLabels: ["a".repeat(MAX_CATEGORY_LABEL_LENGTH + 1)],
        }),
      );
      assert.ok(error instanceof CreateBoardError);
      let failure = error as CreateBoardError;
      assert.ok(!String(failure.cause).includes("delete failed"));
      assert.equal(await count(db, "boards"), 1);
      // The caller is told which board was left behind, so it can log it.
      assert.equal(failure.cleanupFailed, true);
      let leftover = (await db.exec("SELECT id FROM boards")).rows?.[0].id;
      assert.equal(failure.orphanedBoardId, leftover);
    });
  });
});
