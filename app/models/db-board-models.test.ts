import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { boards } from "../data/tables.ts";
import { runBoardModelsContract } from "../test/board-models-contract.ts";
import { testDatabase } from "../test/dependencies.ts";
import { insertBoard } from "./boards/board.ts";
import { BoardClosedError } from "./boards/state.ts";
import { createDbBoardModels } from "./db-board-models.ts";

const input = {
  title: "Sprint 12",
  organiserDisplayName: "Sam",
  categoryLabels: ["Good", "Bad"],
};

// The shared behaviour every BoardModels must have.
runBoardModelsContract("database", async (resolveViewer) =>
  createDbBoardModels(await testDatabase(), resolveViewer),
);

describe("createDbBoardModels specifics", () => {
  it("returns the organiser as an app Member and the board as a live Board", async () => {
    let models = createDbBoardModels(await testDatabase(), async () => null);
    let { board, organiser } = await models.createBoard(input);
    assert.deepEqual(organiser, { id: organiser.id, boardId: board.id, displayName: "Sam" });
    assert.equal(board.organiserMemberId, organiser.id);
  });

  it("treats a board without an organiser as missing", async () => {
    let db = await testDatabase();
    let models = createDbBoardModels(db, async () => null);
    let orphan = await insertBoard(db, "Orphan");
    assert.equal(await models.getBoard(orphan.id), null);
  });

  it("refuses to open voting on a closed board", async () => {
    let models = createDbBoardModels(await testDatabase(), async () => null);
    let { board } = await models.createBoard(input);
    await models.setBoardStatus(board.id, "closed");
    await assert.rejects(() => models.setVotingOpen(board.id, true), BoardClosedError);
  });

  it("lists no viewer votes when nobody is signed in", async () => {
    let models = createDbBoardModels(await testDatabase(), async () => null);
    let { board } = await models.createBoard(input);
    assert.deepEqual(await models.listViewerVotes(board.id), []);
  });

  it("takes createdAt from the database, not from the caller", async () => {
    let models = createDbBoardModels(await testDatabase(), async () => null);
    let { board, organiser } = await models.createBoard(input);
    let [category] = await models.listCategories(board.id);
    let result = await models.createCard(
      {
        id: crypto.randomUUID(),
        boardId: board.id,
        categoryId: category.id,
        memberId: organiser.id,
        body: "A card",
        isAnonymous: false,
        voteCount: 99,
        createdAt: "1999-01-01T00:00:00.000Z",
      },
      "s1",
    );
    assert.ok(result.ok);
    assert.notEqual(result.card.createdAt, "1999-01-01T00:00:00.000Z");
    assert.equal(result.card.voteCount, 0);
  });

  it("does not leave a board behind when creation fails", async () => {
    let db = await testDatabase();
    let models = createDbBoardModels(db, async () => null);
    await assert.rejects(() =>
      models.createBoard({ ...input, organiserDisplayName: "a".repeat(500) }),
    );
    assert.equal((await db.findMany(boards)).length, 0);
  });
});
