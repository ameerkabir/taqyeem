import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { MAX_BOARD_TITLE_LENGTH } from "../../data/limits.ts";
import { boards, categories } from "../../data/tables.ts";
import { createTestDatabase } from "../../test/db.ts";
import { findBoard, insertBoard } from "./board.ts";
import { insertCategories } from "../categories/category.ts";
import { insertMember } from "../members/member.ts";

type TestDb = Awaited<ReturnType<typeof createTestDatabase>>;

async function countBoards(db: Awaited<ReturnType<typeof createTestDatabase>>) {
  return (await db.exec("SELECT count(*) AS total FROM boards")).rows?.[0]
    .total;
}

describe("boards model", () => {
  it("creates and reads back a board", async () => {
    let db = await createTestDatabase();
    try {
      let board = await insertBoard(db, "Sprint 12");
      assert.equal((await findBoard(db, board.id))?.title, "Sprint 12");
    } finally {
      await db.close();
    }
  });

  it("stores Arabic titles unchanged", async () => {
    let db = await createTestDatabase();
    try {
      let board = await insertBoard(db, "مراجعة السبرنت");
      assert.equal((await findBoard(db, board.id))?.title, "مراجعة السبرنت");
    } finally {
      await db.close();
    }
  });

  it("gives each board its own id, even with the same title", async () => {
    let db = await createTestDatabase();
    try {
      let first = await insertBoard(db, "Retro");
      let second = await insertBoard(db, "Retro");
      assert.notEqual(first.id, second.id);
      assert.equal(await countBoards(db), 2);
    } finally {
      await db.close();
    }
  });

  it("returns no board for an unknown id", async () => {
    let db = await createTestDatabase();
    try {
      assert.ok(!(await findBoard(db, crypto.randomUUID())));
    } finally {
      await db.close();
    }
  });

  it("accepts a title of exactly the maximum length", async () => {
    let db = await createTestDatabase();
    try {
      let title = "a".repeat(MAX_BOARD_TITLE_LENGTH);
      let board = await insertBoard(db, title);
      assert.equal((await findBoard(db, board.id))?.title, title);
    } finally {
      await db.close();
    }
  });

  it("rejects an empty title and writes nothing", async () => {
    let db = await createTestDatabase();
    try {
      await assert.rejects(() => insertBoard(db, ""));
      assert.equal(await countBoards(db), 0);
    } finally {
      await db.close();
    }
  });

  it("rejects a title one character over the maximum and writes nothing", async () => {
    let db = await createTestDatabase();
    try {
      await assert.rejects(() =>
        insertBoard(db, "a".repeat(MAX_BOARD_TITLE_LENGTH + 1)),
      );
      assert.equal(await countBoards(db), 0);
    } finally {
      await db.close();
    }
  });

  it("rejects a duplicate id", async () => {
    let db = await createTestDatabase();
    try {
      let board = await insertBoard(db, "Original");
      await assert.rejects(() =>
        db.create(boards, { id: board.id, title: "Impostor" }),
      );
      assert.equal((await findBoard(db, board.id))?.title, "Original");
      assert.equal(await countBoards(db), 1);
    } finally {
      await db.close();
    }
  });

  it("trims surrounding whitespace from the title", async () => {
    let db = await createTestDatabase();
    try {
      let board = await insertBoard(db, "  Retro  ");
      assert.equal(board.title, "Retro");
      assert.equal((await findBoard(db, board.id))?.title, "Retro");
    } finally {
      await db.close();
    }
  });

  it("rejects a whitespace-only title and writes nothing", async () => {
    let db = await createTestDatabase();
    try {
      await assert.rejects(() => insertBoard(db, "   "));
      assert.equal(await countBoards(db), 0);
    } finally {
      await db.close();
    }
  });

  it("stores SQL-looking titles as plain text", async () => {
    let db = await createTestDatabase();
    try {
      let evil = "x'); DROP TABLE boards; --";
      let board = await insertBoard(db, evil);
      assert.equal((await findBoard(db, board.id))?.title, evil);
      assert.equal(await countBoards(db), 1);
    } finally {
      await db.close();
    }
  });

  it("treats SQL-looking ids as plain values when looking up", async () => {
    let db = await createTestDatabase();
    try {
      await insertBoard(db, "Real board");
      assert.ok(!(await findBoard(db, "' OR '1'='1")));
      assert.equal(await countBoards(db), 1);
    } finally {
      await db.close();
    }
  });

  it("keeps databases isolated from each other", async () => {
    let first = await createTestDatabase();
    let second = await createTestDatabase();
    try {
      await insertBoard(first, "Only here");
      assert.equal(await countBoards(first), 1);
      assert.equal(await countBoards(second), 0);
    } finally {
      await first.close();
      await second.close();
    }
  });
});

describe("board state columns", () => {
  async function withDb(run: (db: TestDb) => Promise<void>) {
    let db = await createTestDatabase();
    try {
      await run(db);
    } finally {
      await db.close();
    }
  }

  it("starts collecting, voting closed, no active section", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      let row = await findBoard(db, board.id);
      assert.equal(row?.status, "collecting");
      assert.equal(row?.voting_open, 0);
      assert.equal(row?.current_section_id, null);
    });
  });

  it("rejects an unknown status", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      await assert.rejects(() =>
        db.update(boards, board.id, { status: "archived" as "closed" }),
      );
      assert.equal((await findBoard(db, board.id))?.status, "collecting");
    });
  });

  it("rejects voting_open values other than 0 and 1", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      await assert.rejects(() => db.update(boards, board.id, { voting_open: 2 }));
      await db.update(boards, board.id, { voting_open: 1 });
      assert.equal((await findBoard(db, board.id))?.voting_open, 1);
    });
  });

  it("rejects an active section that is not a category", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      await assert.rejects(() =>
        db.update(boards, board.id, { current_section_id: crypto.randomUUID() }),
      );
      assert.equal((await findBoard(db, board.id))?.current_section_id, null);
    });
  });

  it("accepts a category from any board; the model must check it is the board's own", async () => {
    await withDb(async (db) => {
      let a = await insertBoard(db, "A");
      let b = await insertBoard(db, "B");
      let [category] = await insertCategories(db, b.id, ["Other board"]);
      // The database only checks that the category exists, not whose it is.
      await db.update(boards, a.id, { current_section_id: category.id });
      assert.equal((await findBoard(db, a.id))?.current_section_id, category.id);
    });
  });

  it("clears the active section when its category is deleted, keeping the board", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      let [category] = await insertCategories(db, board.id, ["Good", "Bad"]);
      await db.update(boards, board.id, { current_section_id: category.id });
      assert.equal(await db.delete(categories, category.id), true);
      let row = await findBoard(db, board.id);
      assert.equal(row?.current_section_id, null);
      assert.equal(row?.title, "Retro");
    });
  });

  it("still cascades to categories and members when a board with an active section is deleted", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      let [category] = await insertCategories(db, board.id, ["Good"]);
      await insertMember(db, { boardId: board.id, displayName: "Sam", role: "organiser" });
      await db.update(boards, board.id, { current_section_id: category.id });
      assert.equal(await db.delete(boards, board.id), true);
      assert.equal((await db.exec("SELECT count(*) AS n FROM categories")).rows?.[0].n, 0);
      assert.equal((await db.exec("SELECT count(*) AS n FROM members")).rows?.[0].n, 0);
    });
  });
});
