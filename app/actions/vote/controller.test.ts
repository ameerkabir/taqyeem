import { loadSession } from "../../sessions.ts";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createRouter } from "remix/router";
import { render } from "remix/middleware/render";
import { board, type Card } from "../../data/fake-board.ts";
import type { BoardModels } from "../../models/boards.ts";
import { createFakeBoardModels } from "../../models/fake-boards.ts";
import { createFakeBoardStore } from "../../models/fake-board-store.ts";
import { boardModelsContext, type loadBoardModels } from "../../middleware/models.ts";
import { routes } from "../../routes.ts";
import controller from "./controller.ts";

function setup(overrides: Partial<BoardModels> = {}) {
  let card: Card = {
    id: "card", boardId: "demo", memberId: "m2", categoryId: "ideas",
    body: "ملاحظة", createdAt: new Date().toISOString(), isAnonymous: true, voteCount: 0,
  };
  let base = createFakeBoardModels(createFakeBoardStore({ cards: [card], submissions: new Map(), votes: new Map() }));
  let writes = 0;
  let models: BoardModels = {
    ...base,
    getBoard: async () => ({ ...board, votingOpen: true }),
    setCardVote: async (...args) => { writes++; return base.setCardVote(...args); },
    ...overrides,
  };
  let provideModels: ReturnType<typeof loadBoardModels> = (context, next) => {
    // Test-only identity injection: each concurrent request gets its own viewer.
    let memberId = context.request.headers.get("X-Test-Member");
    context.set(boardModelsContext, memberId
      ? { ...models, getViewerMemberId: async () => memberId }
      : models, { property: "models" });
    return next();
  };
  let router = createRouter({ middleware: [render(), loadSession("test-only-session-secret"), provideModels] });
  router.map(routes.vote, controller);
  return {
    models,
    get writes() { return writes; },
    request(body = "voted=true", cardId = "card", enhanced = true, memberId?: string) {
      return router.fetch(new URL(routes.vote.href({ boardId: "demo", cardId }), "http://localhost"), {
        method: "POST", body: new URLSearchParams(body), headers: { Accept: enhanced ? "application/json" : "text/html", ...(memberId ? { "X-Test-Member": memberId } : {}) },
      });
    },
  };
}

describe("vote action", () => {
  it("uses the current member, supports repeat submissions and removal, and redirects to the category", async () => {
    let app = setup();
    let response = await app.request("voted=true&memberId=m2", "card", false);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/boards/demo?section=ideas");
    await app.request();
    assert.equal((await app.models.getCard("demo", "card"))?.voteCount, 1);
    assert.deepEqual(await app.models.listViewerVotes("demo"), ["card"]);
    assert.equal((await app.request("voted=false", "card", false)).status, 303);
    assert.equal((await app.models.getCard("demo", "card"))?.voteCount, 0);
  });

  it("returns JSON without redirecting for enhanced submissions", async () => {
    let app = setup();
    let response = await app.request();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Location"), null);
    assert.deepEqual(await response.json(), { voted: true, count: 1 });
    assert.deepEqual(await (await app.request("voted=false")).json(), { voted: false, count: 0 });
  });

  for (let [name, overrides, status] of [
    ["missing board", { getBoard: async () => null }, 404],
    ["missing member", { getViewerMemberId: async () => null }, 403],
    ["closed board", { getBoard: async () => ({ ...board, status: "closed" as const, votingOpen: true }) }, 403],
    ["voting disabled", { getBoard: async () => ({ ...board, votingOpen: false }) }, 403],
  ] as [string, Partial<BoardModels>, number][]) {
    it(`rejects ${name} without writing`, async () => {
      let app = setup(overrides);
      assert.equal((await app.request()).status, status);
      assert.equal(app.writes, 0);
    });
  }

  for (let body of ["", "voted=1", "voted=TRUE", "voted=true&voted=false"]) {
    it(`rejects invalid input ${JSON.stringify(body)}`, async () => {
      let app = setup();
      assert.equal((await app.request(body)).status, 400);
      assert.equal(app.writes, 0);
    });
  }

  it("rejects a missing card without writing", async () => {
    let app = setup();
    assert.equal((await app.request("voted=true", "missing")).status, 404);
    assert.equal(app.writes, 0);
  });

  it("handles a card disappearing before the write", async () => {
    let app = setup({ setCardVote: async () => null });
    assert.equal((await app.request()).status, 404);
  });
});


describe("concurrent vote requests", () => {
  it("counts repeated concurrent votes from one member once", async () => {
    let app = setup();
    let responses = await Promise.all(Array.from({ length: 8 }, () => app.request()));
    for (let response of responses) {
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { voted: true, count: 1 });
    }
    assert.equal((await app.models.getCard("demo", "card"))?.voteCount, 1);
  });

  it("preserves votes from different members without revealing their identities", async () => {
    let app = setup();
    let responses = await Promise.all([
      app.request("voted=true", "card", true, "m1"),
      app.request("voted=true", "card", true, "m2"),
    ]);
    for (let response of responses) {
      assert.equal(response.status, 200);
      let result = await response.json() as { voted: boolean; count: number };
      assert.deepEqual(Object.keys(result).sort(), ["count", "voted"]);
      assert.equal(result.voted, true);
    }
    assert.equal((await app.models.getCard("demo", "card"))?.voteCount, 2);
  });

  it("removes a member's vote once under concurrent retries and preserves other votes", async () => {
    let app = setup();
    await app.request("voted=true", "card", true, "m1");
    await app.request("voted=true", "card", true, "m2");
    let responses = await Promise.all(Array.from({ length: 8 }, () =>
      app.request("voted=false", "card", true, "m1")));
    for (let response of responses) {
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { voted: false, count: 1 });
    }
    await app.request("voted=false", "card", true, "m2");
    let retries = await Promise.all([app.request("voted=false"), app.request("voted=false")]);
    for (let response of retries) {
      assert.deepEqual(await response.json(), { voted: false, count: 0 });
    }
    assert.equal((await app.models.getCard("demo", "card"))?.voteCount, 0);
  });
});
