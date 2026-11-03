import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import type { Card } from "../data/fake-board.ts";
import { createFakeBoardModels } from "./fake-boards.ts";

function card(time: number): Card {
  return {
    id: crypto.randomUUID(),
    boardId: "demo",
    memberId: "m1",
    categoryId: "ideas",
    body: "ملاحظة",
    isAnonymous: false,
    voteCount: 0,
    createdAt: new Date(time).toISOString(),
  };
}

describe("in-memory card submissions", () => {
  it("shares writes and duplicate detection across model instances", async () => {
    let store = { cards: [] as Card[], submissions: new Map<string, Card>(), votes: new Map<string, Set<string>>() };
    let first = createFakeBoardModels(store);
    let second = createFakeBoardModels(store);
    let submissionId = crypto.randomUUID();
    let original = card(Date.now());
    let saved = await first.createCard(original, submissionId);
    let retry = await second.createCard(
      { ...original, id: crypto.randomUUID() },
      submissionId,
    );
    assert.ok(saved.ok);
    assert.ok(retry.ok);
    assert.equal(retry.card.id, saved.card.id);
    assert.equal((await second.listCards("demo")).length, 1);
  });

  it("scopes submission IDs to the member and board", async () => {
    let store = { cards: [] as Card[], submissions: new Map<string, Card>(), votes: new Map<string, Set<string>>() };
    let models = createFakeBoardModels(store);
    let submissionId = crypto.randomUUID();
    let original = card(Date.now());
    await models.createCard(original, submissionId);
    await models.createCard(
      { ...original, id: crypto.randomUUID(), memberId: "m2" },
      submissionId,
    );
    await models.createCard(
      { ...original, id: crypto.randomUUID(), boardId: "another-board" },
      submissionId,
    );
    assert.equal(store.cards.length, 3);
  });
});

describe("in-memory card rate limit", () => {
  it("shares allowance across model instances, without charging retries", async () => {
    let time = Date.now();
    let store = { cards: [] as Card[], submissions: new Map<string, Card>(), votes: new Map<string, Set<string>>() };
    let first = createFakeBoardModels(store, () => time);
    let second = createFakeBoardModels(store, () => time);
    let original = card(time);
    let submissionId = crypto.randomUUID();
    await first.createCard(original, submissionId);
    for (let i = 0; i < 4; i++) {
      assert.ok((await first.createCard(card(time), crypto.randomUUID())).ok);
    }
    assert.ok((await second.createCard(original, submissionId)).ok);
    let blocked = await second.createCard(card(time), crypto.randomUUID());
    assert.ok(!blocked.ok);
    assert.equal(blocked.retryAfter, 60);
    assert.equal(store.cards.length, 5);
  });

  it("rounds the retry delay up and releases allowance at the exact boundary", async () => {
    let time = Date.now();
    let store = {
      cards: Array.from({ length: 5 }, () => card(time - 58_500)),
      submissions: new Map<string, Card>(), votes: new Map<string, Set<string>>(),
    };
    let models = createFakeBoardModels(store, () => time);
    let submissionId = crypto.randomUUID();
    let blocked = await models.createCard(card(time), submissionId);
    assert.ok(!blocked.ok);
    assert.equal(blocked.retryAfter, 2);
    time += 1500;
    assert.ok((await models.createCard(card(time), submissionId)).ok);
    assert.equal(store.cards.length, 6);
  });
});

describe("in-memory card editing and deletion", () => {
  it("finds later cards by both board and card ID", async () => {
    let first = card(Date.now());
    let second = card(Date.now());
    let models = createFakeBoardModels({ cards: [first, second], submissions: new Map(), votes: new Map<string, Set<string>>() });
    assert.equal((await models.getCard("demo", second.id))?.id, second.id);
    assert.equal(await models.getCard("another-board", second.id), null);
  });

  it("updates only editable fields and makes changes visible to other model instances", async () => {
    let original = { ...card(Date.now()), voteCount: 3 };
    let before = { ...original };
    let store = { cards: [original], submissions: new Map<string, Card>(), votes: new Map<string, Set<string>>() };
    let models = createFakeBoardModels(store);
    let changes = { body: "ملاحظة معدلة", categoryId: "bad", isAnonymous: true, id: "forged", memberId: "m2", voteCount: 0 };
    let updated = await models.updateCard("demo", original.id, changes);
    assert.ok(updated);
    assert.equal(updated.body, changes.body);
    assert.equal(updated.categoryId, "bad");
    assert.equal(updated.isAnonymous, true);
    assert.equal(updated.id, before.id);
    assert.equal(updated.memberId, before.memberId);
    assert.equal(updated.createdAt, before.createdAt);
    assert.equal(updated.voteCount, before.voteCount);
    assert.equal((await createFakeBoardModels(store).getCard("demo", original.id))?.body, changes.body);
    assert.equal(await models.updateCard("wrong-board", original.id, changes), null);
    assert.equal(await models.updateCard("demo", "missing", changes), null);
  });

  it("deletes only the matching card and never removes the last card on a miss", async () => {
    let first = card(Date.now());
    let second = card(Date.now());
    let store = { cards: [first, second], submissions: new Map<string, Card>(), votes: new Map<string, Set<string>>() };
    let models = createFakeBoardModels(store);
    assert.equal(await models.deleteCard("wrong-board", first.id), false);
    assert.equal(await models.deleteCard("demo", "missing"), false);
    assert.equal(store.cards.length, 2);
    assert.equal(await models.deleteCard("demo", first.id), true);
    assert.equal(store.cards.length, 1);
    assert.equal(store.cards[0].id, second.id);
  });
});

describe("in-memory card voting", () => {
  function setup() {
    let first = card(Date.now());
    let second = card(Date.now());
    let otherBoard = { ...first, boardId: "another-board" };
    let store = {
      cards: [first, second, otherBoard],
      submissions: new Map<string, Card>(),
      votes: new Map<string, Set<string>>(),
    };
    return { first, second, store, models: createFakeBoardModels(store) };
  }

  it("adds one vote and repeated requests do not add duplicates", async () => {
    let { first, models } = setup();
    for (let attempt = 0; attempt < 3; attempt++) {
      let result = await models.setCardVote("demo", first.id, "m1", true);
      assert.ok(result);
      assert.equal(result.voted, true);
      assert.equal(result.count, 1);
    }
  });

  it("removes a vote and repeated removals keep the count at zero", async () => {
    let { first, models } = setup();
    await models.setCardVote("demo", first.id, "m1", true);
    for (let attempt = 0; attempt < 3; attempt++) {
      let result = await models.setCardVote("demo", first.id, "m1", false);
      assert.ok(result);
      assert.equal(result.voted, false);
      assert.equal(result.count, 0);
    }
  });

  it("can remove an absent vote without creating a negative count", async () => {
    let { first, models } = setup();
    let result = await models.setCardVote("demo", first.id, "m1", false);
    assert.ok(result);
    assert.equal(result.voted, false);
    assert.equal(result.count, 0);
  });

  it("keeps each member's vote independent", async () => {
    let { first, models } = setup();
    await models.setCardVote("demo", first.id, "m1", true);
    let added = await models.setCardVote("demo", first.id, "m2", true);
    assert.ok(added);
    assert.equal(added.count, 2);
    let removed = await models.setCardVote("demo", first.id, "m1", false);
    assert.ok(removed);
    assert.equal(removed.voted, false);
    assert.equal(removed.count, 1);
    let remaining = await models.setCardVote("demo", first.id, "m2", true);
    assert.ok(remaining);
    assert.equal(remaining.voted, true);
    assert.equal(remaining.count, 1);
  });

  it("scopes voter sets to both the board and card", async () => {
    let { first, second, models, store } = setup();
    await models.setCardVote("demo", first.id, "m1", true);
    let anotherCard = await models.setCardVote("demo", second.id, "m1", true);
    let anotherBoard = await models.setCardVote("another-board", first.id, "m1", true);
    assert.ok(anotherCard);
    assert.ok(anotherBoard);
    assert.equal(anotherCard.count, 1);
    assert.equal(anotherBoard.count, 1);
    assert.equal(store.votes.size, 3);
    let removed = await models.setCardVote("demo", first.id, "m1", false);
    assert.ok(removed);
    assert.equal(removed.count, 0);
    assert.equal(store.votes.get(JSON.stringify(["another-board", first.id]))?.has("m1"), true);
  });

  it("returns null for missing or wrong-board cards without writing votes", async () => {
    let { first, models, store } = setup();
    assert.equal(await models.setCardVote("demo", "missing", "m1", true), null);
    assert.equal(await models.setCardVote("wrong-board", first.id, "m1", true), null);
    assert.equal(store.votes.size, 0);
  });

  it("shares votes between model instances using the same store", async () => {
    let { first, models, store } = setup();
    await models.setCardVote("demo", first.id, "m1", true);
    let secondInstance = createFakeBoardModels(store);
    let result = await secondInstance.setCardVote("demo", first.id, "m2", true);
    assert.ok(result);
    assert.equal(result.count, 2);
  });

  it("handles concurrent duplicate requests and different members without losing votes", async () => {
    let { first, models } = setup();
    let results = await Promise.all([
      models.setCardVote("demo", first.id, "m1", true),
      models.setCardVote("demo", first.id, "m1", true),
      models.setCardVote("demo", first.id, "m2", true),
      models.setCardVote("demo", first.id, "m3", true),
    ]);
    assert.ok(results.every((result) => result?.voted === true));
    let result = await models.setCardVote("demo", first.id, "m1", true);
    assert.ok(result);
    assert.equal(result.count, 3);
  });

  it("reads zero votes from an empty vote store even when a card has a legacy count", async () => {
    let { first, models } = setup();
    first.voteCount = 99;
    let found = await models.getCard("demo", first.id);
    let listed = (await models.listCards("demo")).find((card) => card.id === first.id);
    assert.equal(found?.voteCount, 0);
    assert.equal(listed?.voteCount, 0);
    assert.equal((await models.listViewerVotes("demo")).length, 0);
    assert.equal(first.voteCount, 99);
  });

  it("keeps list, single-card counts and viewer votes in sync after voting and removing", async () => {
    let { first, models, store } = setup();
    await models.setCardVote("demo", first.id, "m2", true);
    assert.equal((await models.getCard("demo", first.id))?.voteCount, 1);
    assert.equal((await models.listViewerVotes("demo")).length, 0);

    await models.setCardVote("demo", first.id, "m1", true);
    let anotherInstance = createFakeBoardModels(store);
    assert.equal((await anotherInstance.getCard("demo", first.id))?.voteCount, 2);
    assert.equal((await anotherInstance.listCards("demo")).find((card) => card.id === first.id)?.voteCount, 2);
    assert.equal((await anotherInstance.listViewerVotes("demo"))[0], first.id);

    await models.setCardVote("demo", first.id, "m1", false);
    assert.equal((await anotherInstance.getCard("demo", first.id))?.voteCount, 1);
    assert.equal((await anotherInstance.listCards("demo")).find((card) => card.id === first.id)?.voteCount, 1);
    assert.equal((await anotherInstance.listViewerVotes("demo")).length, 0);
  });

  it("limits viewer votes to cards on the requested board and excludes deleted cards", async () => {
    let { first, second, models } = setup();
    await models.setCardVote("another-board", first.id, "m1", true);
    await models.setCardVote("demo", second.id, "m1", true);
    assert.equal(JSON.stringify(await models.listViewerVotes("demo")), JSON.stringify([second.id]));
    assert.equal(JSON.stringify(await models.listViewerVotes("another-board")), JSON.stringify([first.id]));
    assert.equal((await models.getCard("demo", first.id))?.voteCount, 0);
    await models.deleteCard("demo", second.id);
    assert.equal((await models.listViewerVotes("demo")).length, 0);
  });
});
