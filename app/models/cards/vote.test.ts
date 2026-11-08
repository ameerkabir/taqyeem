import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { boards, cards, members, votes } from "../../data/tables.ts";
import { createTestDatabase } from "../../test/db.ts";
import { hideFirstFindOne } from "../../test/proxies.ts";
import { createCard, getCard, listCards } from "./card.ts";
import { createBoard } from "../boards/create.ts";
import { insertMember } from "../members/member.ts";
import { listViewerVotes, setCardVote } from "./vote.ts";

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

async function setup(db: TestDb) {
  let board = await createBoard(db, input);
  let pat = await insertMember(db, {
    boardId: board.board.id,
    displayName: "Pat",
    role: "participant",
  });
  let created = await createCard(
    db,
    {
      id: crypto.randomUUID(),
      boardId: board.board.id,
      categoryId: board.categories[0].id,
      memberId: board.organiser.id,
      body: "A card",
      isAnonymous: false,
    },
    "s1",
  );
  assert.ok(created.ok);
  return { board, pat, card: created.card };
}

async function countVotes(db: TestDb) {
  return (await db.exec("SELECT count(*) AS n FROM votes")).rows?.[0].n;
}

describe("votes table", () => {
  it("stores a vote with a UTC ISO timestamp and rejects a second vote by the same member", async () => {
    await withDb(async (db) => {
      let { board, card } = await setup(db);
      let vote = await db.create(
        votes,
        { card_id: card.id, member_id: board.organiser.id, board_id: board.board.id },
        { returnRow: true },
      );
      assert.match(vote.created_at, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
      await assert.rejects(() =>
        db.create(votes, { card_id: card.id, member_id: board.organiser.id, board_id: board.board.id }),
      );
      assert.equal(await countVotes(db), 1);
    });
  });

  it("rejects a vote whose card is on a different board than the stated board", async () => {
    await withDb(async (db) => {
      let { board, card } = await setup(db);
      let other = await createBoard(db, { ...input, title: "Other" });
      await assert.rejects(() =>
        db.create(votes, { card_id: card.id, member_id: other.organiser.id, board_id: other.board.id }),
      );
      assert.equal(await countVotes(db), 0);
      assert.ok(board);
    });
  });

  it("rejects a vote by a member of another board", async () => {
    await withDb(async (db) => {
      let { board, card } = await setup(db);
      let other = await createBoard(db, { ...input, title: "Other" });
      await assert.rejects(() =>
        db.create(votes, { card_id: card.id, member_id: other.organiser.id, board_id: board.board.id }),
      );
      assert.equal(await countVotes(db), 0);
    });
  });

  it("rejects a vote for a card or member that does not exist", async () => {
    await withDb(async (db) => {
      let { board, card } = await setup(db);
      await assert.rejects(() =>
        db.create(votes, { card_id: crypto.randomUUID(), member_id: board.organiser.id, board_id: board.board.id }),
      );
      await assert.rejects(() =>
        db.create(votes, { card_id: card.id, member_id: crypto.randomUUID(), board_id: board.board.id }),
      );
      assert.equal(await countVotes(db), 0);
    });
  });

  it("deletes votes with their card, member or board, and no one else's", async () => {
    await withDb(async (db) => {
      let { board, pat, card } = await setup(db);
      let second = await createCard(
        db,
        {
          id: crypto.randomUUID(),
          boardId: board.board.id,
          categoryId: board.categories[0].id,
          memberId: board.organiser.id,
          body: "Second",
          isAnonymous: false,
        },
        "s2",
      );
      assert.ok(second.ok);
      await setCardVote(db, board.board.id, card.id, board.organiser.id, true);
      await setCardVote(db, board.board.id, card.id, pat.id, true);
      await setCardVote(db, board.board.id, second.card.id, pat.id, true);
      assert.equal(await countVotes(db), 3);

      await db.delete(members, pat.id); // Pat's two votes go
      assert.equal(await countVotes(db), 1);
      await db.delete(cards, card.id); // the remaining vote was on this card
      assert.equal(await countVotes(db), 0);
    });
  });

  it("deleting a board removes its votes but not another board's", async () => {
    await withDb(async (db) => {
      let a = await setup(db);
      let b = await setup(db);
      await setCardVote(db, a.board.board.id, a.card.id, a.board.organiser.id, true);
      await setCardVote(db, b.board.board.id, b.card.id, b.board.organiser.id, true);
      await db.delete(boards, a.board.board.id);
      assert.equal(await countVotes(db), 1);
    });
  });
});

describe("setCardVote", () => {
  it("records a vote and reports the new count", async () => {
    await withDb(async (db) => {
      let { board, card } = await setup(db);
      let result = await setCardVote(db, board.board.id, card.id, board.organiser.id, true);
      assert.deepEqual(result, { voted: true, count: 1 });
    });
  });

  it("is idempotent when voting twice", async () => {
    await withDb(async (db) => {
      let { board, card } = await setup(db);
      await setCardVote(db, board.board.id, card.id, board.organiser.id, true);
      let again = await setCardVote(db, board.board.id, card.id, board.organiser.id, true);
      assert.deepEqual(again, { voted: true, count: 1 });
      assert.equal(await countVotes(db), 1);
    });
  });

  it("counts votes from different members", async () => {
    await withDb(async (db) => {
      let { board, pat, card } = await setup(db);
      await setCardVote(db, board.board.id, card.id, board.organiser.id, true);
      let result = await setCardVote(db, board.board.id, card.id, pat.id, true);
      assert.deepEqual(result, { voted: true, count: 2 });
    });
  });

  it("removes only the caller's vote", async () => {
    await withDb(async (db) => {
      let { board, pat, card } = await setup(db);
      await setCardVote(db, board.board.id, card.id, board.organiser.id, true);
      await setCardVote(db, board.board.id, card.id, pat.id, true);
      let result = await setCardVote(db, board.board.id, card.id, pat.id, false);
      assert.deepEqual(result, { voted: false, count: 1 });
    });
  });

  it("treats removing a vote that does not exist as a no-op", async () => {
    await withDb(async (db) => {
      let { board, card } = await setup(db);
      let result = await setCardVote(db, board.board.id, card.id, board.organiser.id, false);
      assert.deepEqual(result, { voted: false, count: 0 });
    });
  });

  it("returns null for an unknown card or a card from another board", async () => {
    await withDb(async (db) => {
      let { board, card } = await setup(db);
      let other = await createBoard(db, { ...input, title: "Other" });
      assert.equal(await setCardVote(db, board.board.id, crypto.randomUUID(), board.organiser.id, true), null);
      assert.equal(await setCardVote(db, other.board.id, card.id, other.organiser.id, true), null);
      assert.equal(await countVotes(db), 0);
    });
  });

  it("succeeds when it loses a race to a concurrent identical vote", async () => {
    await withDb(async (db) => {
      let { board, card } = await setup(db);
      await setCardVote(db, board.board.id, card.id, board.organiser.id, true);
      // The first "already voted?" lookup misses, so the insert collides with the winner.
      let racing = hideFirstFindOne(db, votes);
      let result = await setCardVote(racing, board.board.id, card.id, board.organiser.id, true);
      assert.deepEqual(result, { voted: true, count: 1 });
      assert.equal(await countVotes(db), 1);
    });
  });

  it("rethrows a genuine failure, such as a member from another board", async () => {
    await withDb(async (db) => {
      let { board, card } = await setup(db);
      let other = await createBoard(db, { ...input, title: "Other" });
      await assert.rejects(() =>
        setCardVote(db, board.board.id, card.id, other.organiser.id, true),
      );
      assert.equal(await countVotes(db), 0);
    });
  });
});

describe("vote counts and viewer votes", () => {
  it("shows the count on getCard and listCards", async () => {
    await withDb(async (db) => {
      let { board, pat, card } = await setup(db);
      await setCardVote(db, board.board.id, card.id, board.organiser.id, true);
      await setCardVote(db, board.board.id, card.id, pat.id, true);
      assert.equal((await getCard(db, board.board.id, card.id))?.voteCount, 2);
      assert.equal((await listCards(db, board.board.id))[0].voteCount, 2);
    });
  });

  it("lists only the viewer's votes on this board", async () => {
    await withDb(async (db) => {
      let { board, pat, card } = await setup(db);
      let other = await setup(db);
      await setCardVote(db, board.board.id, card.id, board.organiser.id, true);
      await setCardVote(db, board.board.id, card.id, pat.id, true);
      await setCardVote(db, other.board.board.id, other.card.id, other.board.organiser.id, true);
      assert.deepEqual(await listViewerVotes(db, board.board.id, pat.id), [card.id]);
      assert.deepEqual(await listViewerVotes(db, board.board.id, crypto.randomUUID()), []);
    });
  });
});
