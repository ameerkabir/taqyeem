import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import type { Card } from "../data/board.ts";
import { MAX_CARDS } from "../data/limits.ts";
import type { BoardModels } from "../models/board-models.ts";

type ResolveViewer = (boardId: string) => Promise<string | null>;
export type MakeModels = (resolveViewer: ResolveViewer) => Promise<BoardModels>;

const input = {
  title: "Sprint 12",
  organiserDisplayName: "ريم",
  categoryLabels: ["Good", "Bad", "Ideas"],
};

async function start(make: MakeModels) {
  let viewer: string | null = null;
  let models = await make(async () => viewer);
  let { board, organiser } = await models.createBoard(input);
  viewer = organiser.id;
  let categories = await models.listCategories(board.id);
  return {
    models,
    board,
    organiser,
    categories,
    setViewer(memberId: string | null) {
      viewer = memberId;
    },
  };
}

function cardFor(boardId: string, categoryId: string, memberId: string, body = "A card"): Card {
  return {
    id: crypto.randomUUID(),
    boardId,
    categoryId,
    memberId,
    body,
    isAnonymous: false,
    voteCount: 0,
    createdAt: new Date().toISOString(),
  };
}

/**
 * The behaviour every BoardModels implementation must share, exercised only through the
 * interface. Run it against the real implementation and, while it exists, the test double,
 * so the double cannot drift from what the app really does.
 *
 * Deliberately not covered because implementations differ: opening voting on a closed board
 * (the real one refuses), and the exact createdAt value (the database stamps it).
 */
export function runBoardModelsContract(name: string, make: MakeModels) {
  describe(`BoardModels contract: ${name}`, () => {
    it("creates a board that can be read back in the app's shapes", async () => {
      let { models, board, organiser, categories } = await start(make);
      assert.equal(board.title, "Sprint 12");
      assert.equal(board.status, "collecting");
      assert.equal(board.votingOpen, false);
      assert.equal(board.organiserMemberId, organiser.id);
      assert.equal(organiser.boardId, board.id);
      assert.equal(organiser.displayName, "ريم");
      assert.deepEqual(await models.getBoard(board.id), board);
      assert.deepEqual(
        categories.map((c) => [c.label, c.position]),
        [["Good", 0], ["Bad", 1], ["Ideas", 2]],
      );
      assert.deepEqual(
        (await models.listMembers(board.id)).map((m) => m.id),
        [organiser.id],
      );
    });

    it("returns null for a board that does not exist", async () => {
      let { models } = await start(make);
      assert.equal(await models.getBoard(crypto.randomUUID()), null);
      assert.equal(await models.setVotingOpen(crypto.randomUUID(), true), null);
      assert.equal(await models.setBoardStatus(crypto.randomUUID(), "closed"), null);
    });

    it("opens and closes voting and moves through the stages", async () => {
      let { models, board } = await start(make);
      assert.equal((await models.setVotingOpen(board.id, true))?.votingOpen, true);
      assert.equal((await models.getBoard(board.id))?.votingOpen, true);
      assert.equal((await models.setBoardStatus(board.id, "meeting"))?.status, "meeting");
      assert.equal((await models.setVotingOpen(board.id, false))?.votingOpen, false);
    });

    it("closing a board also closes voting", async () => {
      let { models, board } = await start(make);
      await models.setVotingOpen(board.id, true);
      let closed = await models.setBoardStatus(board.id, "closed");
      assert.equal(closed?.status, "closed");
      assert.equal(closed?.votingOpen, false);
    });

    it("joins a participant who then appears in the member list and can vote", async () => {
      let { models, board, organiser, categories } = await start(make);
      let joined = await models.joinBoard(board.id, "  Pat  ");
      assert.ok(joined?.ok);
      assert.equal(joined.member.displayName, "Pat");
      assert.equal(joined.member.boardId, board.id);
      assert.deepEqual(
        (await models.listMembers(board.id)).map((m) => m.id).sort(),
        [organiser.id, joined.member.id].sort(),
      );
      let draft = cardFor(board.id, categories[0].id, organiser.id);
      await models.createCard(draft, "s1");
      let vote = await models.setCardVote(board.id, draft.id, joined.member.id, true);
      assert.deepEqual(vote, { voted: true, count: 1 });
    });

    it("refuses a name that is already taken on the board, including the organiser's", async () => {
      let { models, board } = await start(make); // organiser: ريم
      assert.ok((await models.joinBoard(board.id, "Pat"))?.ok);
      for (let name of ["Pat", "pat", " PAT ", "ريم"]) {
        assert.deepEqual(await models.joinBoard(board.id, name), { ok: false, reason: "name_taken" }, name);
      }
      assert.equal((await models.listMembers(board.id)).length, 2);
      let other = await models.createBoard({ ...input, title: "Other" });
      assert.ok((await models.joinBoard(other.board.id, "Pat"))?.ok);
    });

    it("refuses to join a closed board and reports a missing one", async () => {
      let { models, board } = await start(make);
      assert.equal(await models.joinBoard(crypto.randomUUID(), "Pat"), null);
      await models.setBoardStatus(board.id, "closed");
      assert.deepEqual(await models.joinBoard(board.id, "Pat"), { ok: false, reason: "closed" });
      assert.equal((await models.listMembers(board.id)).length, 1);
    });

    it("identifies the viewer", async () => {
      let { models, board, organiser, setViewer } = await start(make);
      assert.equal(await models.getViewerMemberId(board.id), organiser.id);
      setViewer(null);
      assert.equal(await models.getViewerMemberId(board.id), null);
    });

    it("creates, reads, updates and deletes a card", async () => {
      let { models, board, organiser, categories } = await start(make);
      let draft = cardFor(board.id, categories[0].id, organiser.id);
      let created = await models.createCard(draft, "s1");
      assert.ok(created.ok);
      assert.equal(created.card.id, draft.id);
      assert.equal(created.card.body, "A card");
      assert.equal(created.card.voteCount, 0);

      assert.equal((await models.getCard(board.id, draft.id))?.id, draft.id);
      assert.deepEqual((await models.listCards(board.id)).map((c) => c.id), [draft.id]);

      let updated = await models.updateCard(board.id, draft.id, {
        body: "Edited",
        categoryId: categories[1].id,
        isAnonymous: true,
      });
      assert.equal(updated?.body, "Edited");
      assert.equal(updated?.categoryId, categories[1].id);
      assert.equal(updated?.isAnonymous, true);

      assert.equal(await models.deleteCard(board.id, draft.id), true);
      assert.equal(await models.getCard(board.id, draft.id), null);
      assert.equal(await models.deleteCard(board.id, draft.id), false);
    });

    it("scopes cards to their board", async () => {
      let { models, board, organiser, categories } = await start(make);
      let draft = cardFor(board.id, categories[0].id, organiser.id);
      await models.createCard(draft, "s1");
      let other = await models.createBoard({ ...input, title: "Other" });
      assert.equal(await models.getCard(other.board.id, draft.id), null);
      assert.equal(await models.deleteCard(other.board.id, draft.id), false);
      assert.deepEqual(await models.listCards(other.board.id), []);
    });

    it("returns the original card for a repeated submission", async () => {
      let { models, board, organiser, categories } = await start(make);
      let first = await models.createCard(cardFor(board.id, categories[0].id, organiser.id), "s1");
      let again = await models.createCard(
        cardFor(board.id, categories[0].id, organiser.id, "Other text"),
        "s1",
      );
      assert.ok(first.ok && again.ok);
      assert.equal(again.card.id, first.card.id);
      assert.equal((await models.listCards(board.id)).length, 1);
    });

    it("rate limits a member after MAX_CARDS cards and says when to retry", async () => {
      let { models, board, organiser, categories } = await start(make);
      for (let n = 0; n < MAX_CARDS; n++) {
        let result = await models.createCard(
          cardFor(board.id, categories[0].id, organiser.id),
          `s${n}`,
        );
        assert.ok(result.ok);
      }
      let blocked = await models.createCard(
        cardFor(board.id, categories[0].id, organiser.id),
        "over",
      );
      assert.ok(!blocked.ok);
      assert.ok(blocked.retryAfter >= 1);
    });

    it("votes idempotently and reports the viewer's votes", async () => {
      let { models, board, organiser, categories } = await start(make);
      let draft = cardFor(board.id, categories[0].id, organiser.id);
      await models.createCard(draft, "s1");

      assert.deepEqual(await models.setCardVote(board.id, draft.id, organiser.id, true), {
        voted: true,
        count: 1,
      });
      assert.deepEqual(await models.setCardVote(board.id, draft.id, organiser.id, true), {
        voted: true,
        count: 1,
      });
      assert.deepEqual(await models.listViewerVotes(board.id), [draft.id]);
      assert.equal((await models.getCard(board.id, draft.id))?.voteCount, 1);

      assert.deepEqual(await models.setCardVote(board.id, draft.id, organiser.id, false), {
        voted: false,
        count: 0,
      });
      assert.deepEqual(await models.listViewerVotes(board.id), []);
    });

    it("refuses to vote for a card that does not exist", async () => {
      let { models, board, organiser } = await start(make);
      assert.equal(
        await models.setCardVote(board.id, crypto.randomUUID(), organiser.id, true),
        null,
      );
    });
  });
}
