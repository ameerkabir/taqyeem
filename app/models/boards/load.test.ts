import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { boards } from "../../data/tables.ts";
import { createTestDatabase } from "../../test/db.ts";
import { insertBoard } from "./board.ts";
import { loadBoard, loadCategories, loadMembers } from "./load.ts";
import { insertCategories } from "../categories/category.ts";
import { createBoard } from "./create.ts";
import { insertMember } from "../members/member.ts";

type TestDb = Awaited<ReturnType<typeof createTestDatabase>>;

const input = {
  title: "Sprint 12",
  organiserDisplayName: "ريم",
  categoryLabels: ["Good", "Bad", "Ideas"],
};

async function withDb(run: (db: TestDb) => Promise<void>) {
  let db = await createTestDatabase();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

describe("loadBoard", () => {
  it("returns the app's Board shape", async () => {
    await withDb(async (db) => {
      let { board, organiser } = await createBoard(db, input);
      assert.deepEqual(await loadBoard(db, board.id), {
        id: board.id,
        title: "Sprint 12",
        organiserMemberId: organiser.id,
        status: "collecting",
        votingOpen: false,
        currentSectionId: null,
      });
    });
  });

  it("maps voting_open, status and the active section", async () => {
    await withDb(async (db) => {
      let { board, categories } = await createBoard(db, input);
      await db.update(boards, board.id, {
        status: "meeting",
        voting_open: 1,
        current_section_id: categories[1].id,
      });
      let loaded = await loadBoard(db, board.id);
      assert.equal(loaded?.status, "meeting");
      assert.equal(loaded?.votingOpen, true);
      assert.equal(loaded?.currentSectionId, categories[1].id);
    });
  });

  it("returns null for an unknown id", async () => {
    await withDb(async (db) => {
      assert.equal(await loadBoard(db, crypto.randomUUID()), null);
    });
  });

  it("treats a board without an organiser as missing", async () => {
    await withDb(async (db) => {
      let orphan = await insertBoard(db, "Orphan");
      await insertMember(db, { boardId: orphan.id, displayName: "Pat", role: "participant" });
      assert.equal(await loadBoard(db, orphan.id), null);
    });
  });

  it("does not mix up the organisers of different boards", async () => {
    await withDb(async (db) => {
      let a = await createBoard(db, { ...input, title: "A", organiserDisplayName: "Sam" });
      let b = await createBoard(db, { ...input, title: "B", organiserDisplayName: "Lee" });
      assert.equal((await loadBoard(db, a.board.id))?.organiserMemberId, a.organiser.id);
      assert.equal((await loadBoard(db, b.board.id))?.organiserMemberId, b.organiser.id);
    });
  });
});

describe("loadCategories", () => {
  it("returns the app's Category shape in position order", async () => {
    await withDb(async (db) => {
      let { board } = await createBoard(db, input);
      let loaded = await loadCategories(db, board.id);
      assert.deepEqual(
        loaded.map((c) => [c.label, c.position, c.boardId]),
        [["Good", 0, board.id], ["Bad", 1, board.id], ["Ideas", 2, board.id]],
      );
    });
  });

  it("returns an empty list for an unknown board", async () => {
    await withDb(async (db) => {
      assert.deepEqual(await loadCategories(db, crypto.randomUUID()), []);
    });
  });

  it("only returns the requested board's categories", async () => {
    await withDb(async (db) => {
      let a = await insertBoard(db, "A");
      let b = await insertBoard(db, "B");
      await insertCategories(db, a.id, ["One"]);
      await insertCategories(db, b.id, ["Two", "Three"]);
      assert.equal((await loadCategories(db, a.id)).length, 1);
    });
  });
});

describe("loadMembers", () => {
  it("returns the app's Member shape", async () => {
    await withDb(async (db) => {
      let { board, organiser } = await createBoard(db, input);
      await insertMember(db, { boardId: board.id, displayName: "Pat", role: "participant" });
      let loaded = await loadMembers(db, board.id);
      assert.equal(loaded.length, 2);
      let found = loaded.find((m) => m.id === organiser.id);
      assert.deepEqual(found, { id: organiser.id, boardId: board.id, displayName: "ريم" });
    });
  });

  it("returns an empty list for an unknown board", async () => {
    await withDb(async (db) => {
      assert.deepEqual(await loadMembers(db, crypto.randomUUID()), []);
    });
  });
});
