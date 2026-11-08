import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { MAX_CARDS } from "../../data/limits.ts";
import { cards } from "../../data/tables.ts";
import { createTestDatabase } from "../../test/db.ts";
import { hideFirstFindOne } from "../../test/proxies.ts";
import {
  createCard,
  deleteCard,
  getCard,
  listCards,
  updateCard,
  type NewCard,
} from "./card.ts";
import { createBoard } from "../boards/create.ts";
import { insertMember } from "../members/member.ts";
import { setCardVote } from "./vote.ts";

type TestDb = Awaited<ReturnType<typeof createTestDatabase>>;

const input = {
  title: "Sprint 12",
  organiserDisplayName: "Sam",
  categoryLabels: ["Good", "Bad"],
};

const limits = { maxCards: 3, windowMs: 60_000 };

async function withDb(run: (db: TestDb) => Promise<void>) {
  let db = await createTestDatabase();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

function newCard(
  board: { id: string },
  categoryId: string,
  memberId: string,
  overrides: Partial<NewCard> = {},
): NewCard {
  return {
    id: crypto.randomUUID(),
    boardId: board.id,
    categoryId,
    memberId,
    body: "A card",
    isAnonymous: false,
    ...overrides,
  };
}

/** Inserts a card with an explicit age, bypassing the model (time travel for rate limits). */
async function insertAged(
  db: TestDb,
  board: { id: string },
  categoryId: string,
  memberId: string,
  ageMs: number,
) {
  await db.create(cards, {
    id: crypto.randomUUID(),
    board_id: board.id,
    category_id: categoryId,
    member_id: memberId,
    submission_id: crypto.randomUUID(),
    body: "Old card",
    is_anonymous: 0,
    created_at: new Date(Date.now() - ageMs).toISOString(),
  });
}

async function countCards(db: TestDb) {
  return (await db.exec("SELECT count(*) AS total FROM cards")).rows?.[0].total;
}

describe("createCard", () => {
  it("stores a card and returns the app's Card shape", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories } = await createBoard(db, input);
      let draft = newCard(board, categories[0].id, organiser.id, {
        body: "  ما سار جيداً  ",
        isAnonymous: true,
      });
      let result = await createCard(db, draft, crypto.randomUUID());
      assert.ok(result.ok);
      assert.equal(result.card.id, draft.id);
      assert.equal(result.card.boardId, board.id);
      assert.equal(result.card.categoryId, categories[0].id);
      assert.equal(result.card.memberId, organiser.id);
      assert.equal(result.card.body, "ما سار جيداً");
      assert.equal(result.card.isAnonymous, true);
      assert.equal(result.card.voteCount, 0);
      assert.match(result.card.createdAt, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
      assert.equal(await countCards(db), 1);
    });
  });

  it("rejects a blank body and writes nothing", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories } = await createBoard(db, input);
      await assert.rejects(() =>
        createCard(db, newCard(board, categories[0].id, organiser.id, { body: "   " }), "s1"),
      );
      assert.equal(await countCards(db), 0);
    });
  });

  it("returns the original card for a repeated submission", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories } = await createBoard(db, input);
      let first = await createCard(db, newCard(board, categories[0].id, organiser.id), "s1");
      let again = await createCard(
        db,
        newCard(board, categories[1].id, organiser.id, { body: "Different" }),
        "s1",
      );
      assert.ok(first.ok && again.ok);
      assert.equal(again.card.id, first.card.id);
      assert.equal(again.card.body, "A card");
      assert.equal(await countCards(db), 1);
    });
  });

  it("treats the same submission id from another member as a separate card", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories } = await createBoard(db, input);
      let pat = await insertMember(db, { boardId: board.id, displayName: "Pat", role: "participant" });
      await createCard(db, newCard(board, categories[0].id, organiser.id), "s1");
      await createCard(db, newCard(board, categories[0].id, pat.id), "s1");
      assert.equal(await countCards(db), 2);
    });
  });

  it("returns the winner when it loses a race to a concurrent identical submission", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories } = await createBoard(db, input);
      let winner = await createCard(db, newCard(board, categories[0].id, organiser.id), "s1");
      assert.ok(winner.ok);
      // The first lookup misses (the winner "had not committed yet"), so the insert collides.
      let racing = hideFirstFindOne(db, cards);
      let result = await createCard(racing, newCard(board, categories[0].id, organiser.id), "s1");
      assert.ok(result.ok);
      assert.equal(result.card.id, winner.card.id);
      assert.equal(await countCards(db), 1);
    });
  });

  it("rethrows a genuine failure instead of treating it as a duplicate", async () => {
    await withDb(async (db) => {
      let a = await createBoard(db, { ...input, title: "A" });
      let b = await createBoard(db, { ...input, title: "B" });
      // Category from another board: the composite foreign key rejects it.
      await assert.rejects(() =>
        createCard(db, newCard(a.board, b.categories[0].id, a.organiser.id), "s1"),
      );
      assert.equal(await countCards(db), 0);
    });
  });

  it("enforces the rate limit and reports when to retry", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories } = await createBoard(db, input);
      for (let n = 0; n < limits.maxCards; n++) {
        let result = await createCard(db, newCard(board, categories[0].id, organiser.id), `s${n}`, limits);
        assert.ok(result.ok);
      }
      let blocked = await createCard(db, newCard(board, categories[0].id, organiser.id), "extra", limits);
      assert.equal(blocked.ok, false);
      assert.ok(!blocked.ok && blocked.retryAfter >= 1 && blocked.retryAfter <= 60);
      assert.equal(await countCards(db), limits.maxCards);
    });
  });

  it("bases retryAfter on when the oldest card in the window expires", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories } = await createBoard(db, input);
      await insertAged(db, board, categories[0].id, organiser.id, 50_000);
      await insertAged(db, board, categories[0].id, organiser.id, 30_000);
      await insertAged(db, board, categories[0].id, organiser.id, 10_000);
      let blocked = await createCard(db, newCard(board, categories[0].id, organiser.id), "extra", limits);
      assert.ok(!blocked.ok);
      // The 50s-old card leaves the 60s window in about 10 seconds.
      assert.ok(blocked.retryAfter >= 9 && blocked.retryAfter <= 11, `got ${blocked.retryAfter}`);
    });
  });

  it("does not count cards that are older than the window", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories } = await createBoard(db, input);
      for (let n = 0; n < limits.maxCards; n++) {
        await insertAged(db, board, categories[0].id, organiser.id, 120_000);
      }
      let result = await createCard(db, newCard(board, categories[0].id, organiser.id), "fresh", limits);
      assert.ok(result.ok);
    });
  });

  it("limits each member and each board separately", async () => {
    await withDb(async (db) => {
      let a = await createBoard(db, { ...input, title: "A" });
      let b = await createBoard(db, { ...input, title: "B" });
      let pat = await insertMember(db, { boardId: a.board.id, displayName: "Pat", role: "participant" });
      for (let n = 0; n < limits.maxCards; n++) {
        await createCard(db, newCard(a.board, a.categories[0].id, a.organiser.id), `s${n}`, limits);
      }
      let samAgain = await createCard(db, newCard(a.board, a.categories[0].id, a.organiser.id), "x", limits);
      let patFirst = await createCard(db, newCard(a.board, a.categories[0].id, pat.id), "x", limits);
      let otherBoard = await createCard(db, newCard(b.board, b.categories[0].id, b.organiser.id), "x", limits);
      assert.equal(samAgain.ok, false);
      assert.ok(patFirst.ok);
      assert.ok(otherBoard.ok);
    });
  });

  it("does not count a replayed submission against the limit", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories } = await createBoard(db, input);
      for (let n = 0; n < limits.maxCards; n++) {
        await createCard(db, newCard(board, categories[0].id, organiser.id), `s${n}`, limits);
      }
      let replay = await createCard(db, newCard(board, categories[0].id, organiser.id), "s0", limits);
      assert.ok(replay.ok);
      assert.equal(await countCards(db), limits.maxCards);
    });
  });

  it("applies the shared default limit when none is given", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories } = await createBoard(db, input);
      for (let n = 0; n < MAX_CARDS; n++) {
        let result = await createCard(db, newCard(board, categories[0].id, organiser.id), `s${n}`);
        assert.ok(result.ok);
      }
      let blocked = await createCard(db, newCard(board, categories[0].id, organiser.id), "over");
      assert.equal(blocked.ok, false);
    });
  });
});

describe("getCard, listCards, updateCard, deleteCard", () => {
  async function setup(db: TestDb) {
    let a = await createBoard(db, { ...input, title: "A" });
    let b = await createBoard(db, { ...input, title: "B" });
    let created = await createCard(db, newCard(a.board, a.categories[0].id, a.organiser.id), "s1");
    assert.ok(created.ok);
    return { a, b, card: created.card };
  }

  it("gets a card only through its own board", async () => {
    await withDb(async (db) => {
      let { a, b, card } = await setup(db);
      assert.equal((await getCard(db, a.board.id, card.id))?.id, card.id);
      assert.equal(await getCard(db, b.board.id, card.id), null);
      assert.equal(await getCard(db, a.board.id, crypto.randomUUID()), null);
    });
  });

  it("lists only the board's cards, oldest first, with vote counts", async () => {
    await withDb(async (db) => {
      let { a, b, card } = await setup(db);
      let second = await createCard(db, newCard(a.board, a.categories[1].id, a.organiser.id), "s2");
      await createCard(db, newCard(b.board, b.categories[0].id, b.organiser.id), "s3");
      assert.ok(second.ok);
      await setCardVote(db, a.board.id, second.card.id, a.organiser.id, true);

      let listed = await listCards(db, a.board.id);
      assert.deepEqual(listed.map((c) => c.id).sort(), [card.id, second.card.id].sort());
      assert.equal(listed.find((c) => c.id === second.card.id)?.voteCount, 1);
      assert.equal(listed.find((c) => c.id === card.id)?.voteCount, 0);
    });
  });

  it("updates body, category and anonymity and nothing else", async () => {
    await withDb(async (db) => {
      let { a, card } = await setup(db);
      let updated = await updateCard(db, a.board.id, card.id, {
        body: "  Edited  ",
        categoryId: a.categories[1].id,
        isAnonymous: true,
        // Extra properties must be ignored.
        ...({ memberId: crypto.randomUUID(), boardId: crypto.randomUUID() } as object),
      });
      assert.equal(updated?.body, "Edited");
      assert.equal(updated?.categoryId, a.categories[1].id);
      assert.equal(updated?.isAnonymous, true);
      assert.equal(updated?.memberId, a.organiser.id);
      assert.equal(updated?.boardId, a.board.id);
      assert.equal(updated?.createdAt, card.createdAt);
    });
  });

  it("returns null when updating an unknown card or one from another board", async () => {
    await withDb(async (db) => {
      let { a, b, card } = await setup(db);
      let changes = { body: "Nope", categoryId: b.categories[0].id, isAnonymous: false };
      assert.equal(await updateCard(db, b.board.id, card.id, changes), null);
      assert.equal(await updateCard(db, a.board.id, crypto.randomUUID(), changes), null);
      assert.equal((await getCard(db, a.board.id, card.id))?.body, "A card");
    });
  });

  it("refuses to move a card into another board's category", async () => {
    await withDb(async (db) => {
      let { a, b, card } = await setup(db);
      await assert.rejects(() =>
        updateCard(db, a.board.id, card.id, {
          body: card.body,
          categoryId: b.categories[0].id,
          isAnonymous: false,
        }),
      );
      assert.equal((await getCard(db, a.board.id, card.id))?.categoryId, a.categories[0].id);
    });
  });

  it("deletes a card only through its own board, together with its votes", async () => {
    await withDb(async (db) => {
      let { a, b, card } = await setup(db);
      await setCardVote(db, a.board.id, card.id, a.organiser.id, true);
      assert.equal(await deleteCard(db, b.board.id, card.id), false);
      assert.equal(await countCards(db), 1);
      assert.equal(await deleteCard(db, a.board.id, card.id), true);
      assert.equal(await deleteCard(db, a.board.id, card.id), false);
      assert.equal(await countCards(db), 0);
      assert.equal((await db.exec("SELECT count(*) AS n FROM votes")).rows?.[0].n, 0);
    });
  });
});
