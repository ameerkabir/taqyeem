import { loadSession } from "../../sessions.ts";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createRouter } from "remix/router";
import { render } from "remix/middleware/render";
import { board, type Board, type Card } from "../../data/fake-board.ts";
import { createFakeBoardModels } from "../../models/fake-boards.ts";
import { createFakeBoardStore } from "../../models/fake-board-store.ts";
import { boardModelsContext, type loadBoardModels } from "../../middleware/models.ts";
import { routes } from "../../routes.ts";
import controller from "./controller.tsx";

function setup(overrides: Partial<Board> = {}, missingBoard = false) {
  let cards: Card[] = [
    { id: "older", boardId: "demo", memberId: "m1", categoryId: "good", body: "ملاحظة قديمة", isAnonymous: true, voteCount: 0, createdAt: "2026-10-20T10:00:00Z" },
    { id: "newer", boardId: "demo", memberId: "m2", categoryId: "good", body: "ملاحظة حديثة", isAnonymous: false, voteCount: 0, createdAt: "2026-10-23T10:00:00Z" },
    { id: "bad-card", boardId: "demo", memberId: "m2", categoryId: "bad", body: "نص <em>التصنيف الآخر</em>", isAnonymous: false, voteCount: 0, createdAt: "2026-10-21T10:00:00Z" },
  ];
  let models = {
    ...createFakeBoardModels(createFakeBoardStore({ cards, submissions: new Map(), votes: new Map<string, Set<string>>() })),
    getBoard: async () => missingBoard ? null : ({ ...board, status: "collecting" as const, votingOpen: false, ...overrides }),
  };
  let provideModels: ReturnType<typeof loadBoardModels> = (context, next) => {
    context.set(boardModelsContext, models, { property: "models" });
    return next();
  };
  let router = createRouter({ middleware: [render(), loadSession("test-only-session-secret"), provideModels] });
  router.map(routes.boardCards, controller);
  return {
    models,
    fetch(section?: string) {
      let url = new URL(routes.boardCards.href({ boardId: "demo" }), "http://localhost");
      if (section !== undefined) url.searchParams.set("section", section);
      return router.fetch(url);
    },
  };
}

describe("board card-list fragment", () => {
  it("returns only the selected category as HTML without the document shell", async () => {
    let response = await setup().fetch("bad");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type") ?? "", /text\/html/);
    let html = await response.text();
    assert.match(html, /<section[\s>]/);
    assert.ok(html.includes("نص &lt;em&gt;التصنيف الآخر&lt;/em&gt;"));
    assert.ok(!html.includes("نص <em>التصنيف الآخر</em>"));
    assert.ok(!html.includes("ملاحظة قديمة"));
    assert.ok(!html.includes("ملاحظة حديثة"));
    // Remix may emit a head for generated styles; the app's Document is absent.
    assert.ok(!/<(?:html|body|main|nav)[\s>]/.test(html));
    assert.ok(!html.includes('name="viewport"'));
    assert.ok(!html.includes("<title>"));
    assert.ok(!html.includes(board.title));
  });

  it("sorts collecting cards newest first and renders authorship and vote state", async () => {
    let app = setup();
    await app.models.setCardVote("demo", "older", "m1", true);
    await app.models.setCardVote("demo", "older", "m2", true);
    let html = await (await app.fetch("good")).text();
    assert.ok(html.indexOf("ملاحظة حديثة") < html.indexOf("ملاحظة قديمة"));
    assert.ok(html.includes("بدون اسم"));
    assert.ok(html.includes("سارة"));
    assert.match(html, /<button\b[^>]*\baria-pressed="true"/);
    assert.match(html, /<button\b[^>]*\baria-pressed="false"/);
    assert.ok(html.includes(routes.editCard.index.href({ boardId: "demo", cardId: "older" })));
    assert.ok(!html.includes(routes.editCard.index.href({ boardId: "demo", cardId: "newer" })));
  });

  for (let status of ["meeting", "closed"] as const) {
    it(`sorts ${status} cards by votes`, async () => {
      let app = setup({ status });
      await app.models.setCardVote("demo", "older", "m2", true);
      await app.models.setCardVote("demo", "newer", "m2", true);
      await app.models.setCardVote("demo", "newer", "m3", true);
      let html = await (await app.fetch("good")).text();
      assert.ok(html.includes("ملاحظة قديمة") && html.includes("ملاحظة حديثة"));
      assert.ok(html.indexOf("ملاحظة حديثة") < html.indexOf("ملاحظة قديمة"));
    });
  }

  for (let section of [undefined, "unknown"]) {
    it(`defaults ${section === undefined ? "missing" : "invalid"} categories to the first category`, async () => {
      let html = await (await setup().fetch(section)).text();
      assert.ok(html.includes("ملاحظة حديثة"));
      assert.ok(!html.includes("التصنيف الآخر"));
    });
  }

  it("defaults to the current meeting section but honours an explicit category", async () => {
    let app = setup({ status: "meeting", currentSectionId: "bad" });
    let html = await (await app.fetch()).text();
    assert.ok(html.includes("التصنيف الآخر"));
    assert.ok(!html.includes("ملاحظة حديثة"));
    let selected = await (await app.fetch("good")).text();
    assert.ok(selected.includes("ملاحظة حديثة"));
    assert.ok(!selected.includes("التصنيف الآخر"));
  });

  it("renders the empty state for a category with no cards", async () => {
    let html = await (await setup().fetch("ideas")).text();
    assert.ok(html.includes("لا توجد ملاحظات بعد"));
    assert.ok(!html.includes("ملاحظة حديثة"));
  });

  it("returns 404 for a missing board", async () => {
    let response = await setup({}, true).fetch("good");
    assert.equal(response.status, 404);
    assert.equal(await response.text(), "اللوحة غير موجودة");
  });

  it("renders every vote as unpressed when no vote records exist", async () => {
    let html = await (await setup().fetch("good")).text();
    assert.ok(!/<button\b[^>]*\baria-pressed="true"/.test(html));
    assert.equal((html.match(/<button\b[^>]*\baria-pressed="false"/g) ?? []).length, 2);
  });
});
