import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { MAX_CARD_TEXT_LENGTH } from "../../data/limits.ts";
import { boards, cards, categories, members } from "../../data/tables.ts";
import { createTestDatabase } from "../../test/db.ts";
import { insertMember } from "../members/member.ts";
import { createBoard } from "../boards/create.ts";

// These tests exercise the cards table itself (constraints, defaults, cascades).
// The card model, idempotent submit and rate limit are tested separately.

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

async function countCards(db: TestDb) {
  return (await db.exec("SELECT count(*) AS total FROM cards")).rows?.[0].total;
}

function cardValues(
  boardId: string,
  categoryId: string,
  memberId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: crypto.randomUUID(),
    board_id: boardId,
    category_id: categoryId,
    member_id: memberId,
    submission_id: crypto.randomUUID(),
    body: "A card",
    is_anonymous: 0,
    ...overrides,
  };
}

describe("cards table", () => {
  it("stores a card and fills created_at with a UTC ISO timestamp", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories: cats } = await createBoard(db, input);
      let before = Date.now();
      let card = await db.create(
        cards,
        cardValues(board.id, cats[0].id, organiser.id, { body: "ما سار جيداً" }),
        { returnRow: true },
      );
      let after = Date.now();

      assert.equal(card.body, "ما سار جيداً");
      assert.equal(card.is_anonymous, 0);
      assert.match(card.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      let stored = Date.parse(card.created_at);
      // Millisecond text, so allow one second of slack either side.
      assert.ok(stored >= before - 1000 && stored <= after + 1000);
    });
  });

  it("defaults is_anonymous to 0 and rejects values other than 0 and 1", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories: cats } = await createBoard(db, input);
      let { is_anonymous: _omit, ...withoutFlag } = cardValues(board.id, cats[0].id, organiser.id);
      let card = await db.create(cards, withoutFlag, { returnRow: true });
      assert.equal(card.is_anonymous, 0);
      await assert.rejects(() =>
        db.create(cards, cardValues(board.id, cats[0].id, organiser.id, { is_anonymous: 2 })),
      );
      assert.equal(await countCards(db), 1);
    });
  });

  it("rejects a category that belongs to another board", async () => {
    await withDb(async (db) => {
      let a = await createBoard(db, { ...input, title: "A" });
      let b = await createBoard(db, { ...input, title: "B" });
      await assert.rejects(() =>
        db.create(cards, cardValues(a.board.id, b.categories[0].id, a.organiser.id)),
      );
      assert.equal(await countCards(db), 0);
    });
  });

  it("rejects a member that belongs to another board", async () => {
    await withDb(async (db) => {
      let a = await createBoard(db, { ...input, title: "A" });
      let b = await createBoard(db, { ...input, title: "B" });
      await assert.rejects(() =>
        db.create(cards, cardValues(a.board.id, a.categories[0].id, b.organiser.id)),
      );
      assert.equal(await countCards(db), 0);
    });
  });

  it("rejects a board, category or member that does not exist", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories: cats } = await createBoard(db, input);
      let missing = crypto.randomUUID();
      await assert.rejects(() => db.create(cards, cardValues(missing, cats[0].id, organiser.id)));
      await assert.rejects(() => db.create(cards, cardValues(board.id, missing, organiser.id)));
      await assert.rejects(() => db.create(cards, cardValues(board.id, cats[0].id, missing)));
      assert.equal(await countCards(db), 0);
    });
  });

  it("rejects a repeated submission by the same member on the same board", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories: cats } = await createBoard(db, input);
      let submissionId = crypto.randomUUID();
      await db.create(
        cards,
        cardValues(board.id, cats[0].id, organiser.id, { submission_id: submissionId }),
      );
      await assert.rejects(() =>
        db.create(
          cards,
          cardValues(board.id, cats[1].id, organiser.id, { submission_id: submissionId }),
        ),
      );
      assert.equal(await countCards(db), 1);
    });
  });

  it("allows the same submission id from a different member or on a different board", async () => {
    await withDb(async (db) => {
      let a = await createBoard(db, { ...input, title: "A" });
      let b = await createBoard(db, { ...input, title: "B" });
      let other = await insertMember(db, {
        boardId: a.board.id,
        displayName: "Pat",
        role: "participant",
      });
      let submissionId = crypto.randomUUID();
      for (let [boardId, categoryId, memberId] of [
        [a.board.id, a.categories[0].id, a.organiser.id],
        [a.board.id, a.categories[0].id, other.id],
        [b.board.id, b.categories[0].id, b.organiser.id],
      ]) {
        await db.create(
          cards,
          cardValues(boardId, categoryId, memberId, { submission_id: submissionId }),
        );
      }
      assert.equal(await countCards(db), 3);
    });
  });

  it("rejects an empty body, accepts the maximum length, rejects one over", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories: cats } = await createBoard(db, input);
      await assert.rejects(() =>
        db.create(cards, cardValues(board.id, cats[0].id, organiser.id, { body: "" })),
      );
      await db.create(
        cards,
        cardValues(board.id, cats[0].id, organiser.id, { body: "a".repeat(MAX_CARD_TEXT_LENGTH) }),
      );
      await assert.rejects(() =>
        db.create(
          cards,
          cardValues(board.id, cats[0].id, organiser.id, {
            body: "a".repeat(MAX_CARD_TEXT_LENGTH + 1),
          }),
        ),
      );
      assert.equal(await countCards(db), 1);
    });
  });
});

describe("cards cascades", () => {
  it("deleting a category deletes only that category's cards", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories: cats } = await createBoard(db, input);
      await db.create(cards, cardValues(board.id, cats[0].id, organiser.id));
      await db.create(cards, cardValues(board.id, cats[0].id, organiser.id));
      await db.create(cards, cardValues(board.id, cats[1].id, organiser.id));
      assert.equal(await db.delete(categories, cats[0].id), true);
      assert.equal(await countCards(db), 1);
    });
  });

  it("deleting a member deletes only that member's cards", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories: cats } = await createBoard(db, input);
      let other = await insertMember(db, {
        boardId: board.id,
        displayName: "Pat",
        role: "participant",
      });
      await db.create(cards, cardValues(board.id, cats[0].id, organiser.id));
      await db.create(cards, cardValues(board.id, cats[0].id, other.id));
      assert.equal(await db.delete(members, other.id), true);
      assert.equal(await countCards(db), 1);
    });
  });

  it("deleting a board deletes its cards, members and categories but not another board's", async () => {
    await withDb(async (db) => {
      let a = await createBoard(db, { ...input, title: "A" });
      let b = await createBoard(db, { ...input, title: "B" });
      await db.create(cards, cardValues(a.board.id, a.categories[0].id, a.organiser.id));
      await db.create(cards, cardValues(a.board.id, a.categories[1].id, a.organiser.id));
      await db.create(cards, cardValues(b.board.id, b.categories[0].id, b.organiser.id));

      assert.equal(await db.delete(boards, a.board.id), true);

      assert.equal(await countCards(db), 1);
      let remaining = (await db.exec("SELECT board_id FROM cards")).rows?.[0].board_id;
      assert.equal(remaining, b.board.id);
      assert.equal((await db.exec("SELECT count(*) AS n FROM members")).rows?.[0].n, 1);
      assert.equal((await db.exec("SELECT count(*) AS n FROM categories")).rows?.[0].n, 2);
    });
  });

  it("deleting a board whose active section holds cards still succeeds", async () => {
    await withDb(async (db) => {
      let { board, organiser, categories: cats } = await createBoard(db, input);
      await db.update(boards, board.id, { current_section_id: cats[0].id });
      await db.create(cards, cardValues(board.id, cats[0].id, organiser.id));
      assert.equal(await db.delete(boards, board.id), true);
      assert.equal(await countCards(db), 0);
    });
  });
});
