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
    assert.equal(retry.id, saved.id);
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
