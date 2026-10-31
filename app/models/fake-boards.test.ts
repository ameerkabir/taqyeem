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
    let store = { cards: [] as Card[], submissions: new Map<string, Card>() };
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
    let store = { cards: [] as Card[], submissions: new Map<string, Card>() };
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
    let store = { cards: [] as Card[], submissions: new Map<string, Card>() };
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
      submissions: new Map<string, Card>(),
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
