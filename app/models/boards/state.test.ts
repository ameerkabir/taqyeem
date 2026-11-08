import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { boards } from "../../data/tables.ts";
import { createTestDatabase } from "../../test/db.ts";
import { insertBoard } from "./board.ts";
import { BoardClosedError, setBoardStatus, setVotingOpen } from "./state.ts";
import { createBoard } from "./create.ts";

type TestDb = Awaited<ReturnType<typeof createTestDatabase>>;

const input = {
  title: "Sprint 12",
  organiserDisplayName: "Sam",
  categoryLabels: ["Good", "Bad"],
};

async function withDb(run: (db: TestDb) => Promise<void>) {
  let db = await createTestDatabase();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

async function rowOf(db: TestDb, boardId: string) {
  return (await db.find(boards, boardId))!;
}

describe("setVotingOpen", () => {
  it("opens and closes voting and returns the updated board", async () => {
    await withDb(async (db) => {
      let { board } = await createBoard(db, input);
      assert.equal((await setVotingOpen(db, board.id, true))?.votingOpen, true);
      assert.equal((await rowOf(db, board.id)).voting_open, 1);
      assert.equal((await setVotingOpen(db, board.id, false))?.votingOpen, false);
      assert.equal((await rowOf(db, board.id)).voting_open, 0);
    });
  });

  it("is idempotent", async () => {
    await withDb(async (db) => {
      let { board } = await createBoard(db, input);
      await setVotingOpen(db, board.id, true);
      assert.equal((await setVotingOpen(db, board.id, true))?.votingOpen, true);
    });
  });

  it("returns null for an unknown board and for one without an organiser", async () => {
    await withDb(async (db) => {
      assert.equal(await setVotingOpen(db, crypto.randomUUID(), true), null);
      let orphan = await insertBoard(db, "Orphan");
      assert.equal(await setVotingOpen(db, orphan.id, true), null);
    });
  });

  it("refuses to open voting on a closed board and changes nothing", async () => {
    await withDb(async (db) => {
      let { board } = await createBoard(db, input);
      await setBoardStatus(db, board.id, "closed");
      await assert.rejects(() => setVotingOpen(db, board.id, true), BoardClosedError);
      assert.equal((await rowOf(db, board.id)).voting_open, 0);
    });
  });

  it("still allows closing voting on a closed board", async () => {
    await withDb(async (db) => {
      let { board } = await createBoard(db, input);
      await setBoardStatus(db, board.id, "closed");
      assert.equal((await setVotingOpen(db, board.id, false))?.votingOpen, false);
    });
  });

  it("does not touch other boards", async () => {
    await withDb(async (db) => {
      let a = await createBoard(db, { ...input, title: "A" });
      let b = await createBoard(db, { ...input, title: "B" });
      await setVotingOpen(db, a.board.id, true);
      assert.equal((await rowOf(db, b.board.id)).voting_open, 0);
    });
  });
});

describe("setBoardStatus", () => {
  it("moves through the stages and returns the updated board", async () => {
    await withDb(async (db) => {
      let { board } = await createBoard(db, input);
      assert.equal((await setBoardStatus(db, board.id, "meeting"))?.status, "meeting");
      assert.equal((await setBoardStatus(db, board.id, "closed"))?.status, "closed");
      assert.equal((await setBoardStatus(db, board.id, "collecting"))?.status, "collecting");
    });
  });

  it("closing a board closes voting in the same update", async () => {
    await withDb(async (db) => {
      let { board } = await createBoard(db, input);
      await setVotingOpen(db, board.id, true);
      let closed = await setBoardStatus(db, board.id, "closed");
      assert.equal(closed?.status, "closed");
      assert.equal(closed?.votingOpen, false);
      assert.equal((await rowOf(db, board.id)).voting_open, 0);
    });
  });

  it("leaves voting alone when moving between open stages", async () => {
    await withDb(async (db) => {
      let { board } = await createBoard(db, input);
      await setVotingOpen(db, board.id, true);
      assert.equal((await setBoardStatus(db, board.id, "meeting"))?.votingOpen, true);
    });
  });

  it("keeps voting closed when a closed board is reopened", async () => {
    await withDb(async (db) => {
      let { board } = await createBoard(db, input);
      await setBoardStatus(db, board.id, "closed");
      assert.equal((await setBoardStatus(db, board.id, "collecting"))?.votingOpen, false);
    });
  });

  it("clears the active section when leaving the meeting stage", async () => {
    for (let next of ["collecting", "closed"] as const) {
      await withDb(async (db) => {
        let { board, categories } = await createBoard(db, input);
        await setBoardStatus(db, board.id, "meeting");
        await db.update(boards, board.id, { current_section_id: categories[0].id });
        let moved = await setBoardStatus(db, board.id, next);
        assert.equal(moved?.currentSectionId, null);
        assert.equal((await rowOf(db, board.id)).current_section_id, null);
      });
    }
  });

  it("keeps the active section while the board stays in the meeting stage", async () => {
    await withDb(async (db) => {
      let { board, categories } = await createBoard(db, input);
      await setBoardStatus(db, board.id, "meeting");
      await db.update(boards, board.id, { current_section_id: categories[1].id });
      let again = await setBoardStatus(db, board.id, "meeting");
      assert.equal(again?.currentSectionId, categories[1].id);
    });
  });

  it("returns null for an unknown board and for one without an organiser", async () => {
    await withDb(async (db) => {
      assert.equal(await setBoardStatus(db, crypto.randomUUID(), "closed"), null);
      let orphan = await insertBoard(db, "Orphan");
      assert.equal(await setBoardStatus(db, orphan.id, "closed"), null);
    });
  });

  it("does not touch other boards", async () => {
    await withDb(async (db) => {
      let a = await createBoard(db, { ...input, title: "A" });
      let b = await createBoard(db, { ...input, title: "B" });
      await setBoardStatus(db, a.board.id, "closed");
      assert.equal((await rowOf(db, b.board.id)).status, "collecting");
    });
  });
});

describe("closed-means-voting-closed at the database level", () => {
  it("rejects a closed board with voting open, in either order of change", async () => {
    await withDb(async (db) => {
      let { board } = await createBoard(db, input);
      await assert.rejects(() =>
        db.update(boards, board.id, { status: "closed", voting_open: 1 }),
      );
      await db.update(boards, board.id, { voting_open: 1 });
      // Closing without also closing voting would leave the inconsistent state.
      await assert.rejects(() => db.update(boards, board.id, { status: "closed" }));
      assert.equal((await rowOf(db, board.id)).status, "collecting");
    });
  });

  it("rejects opening voting directly on a closed board", async () => {
    await withDb(async (db) => {
      let { board } = await createBoard(db, input);
      await setBoardStatus(db, board.id, "closed");
      await assert.rejects(() => db.update(boards, board.id, { voting_open: 1 }));
    });
  });
});
