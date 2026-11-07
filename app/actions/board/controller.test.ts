import { loadLocale } from "../../middleware/locale.ts";
import { loadAppDependencies } from "../../middleware/dependencies.ts";
import { loadSession } from "../../sessions.ts";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createRouter } from "remix/router";
import { render } from "remix/middleware/render";
import { board, type Board, type Card } from "../../data/fake-board.ts";
import { createFakeBoardModels } from "../../models/fake-boards.ts";
import { createFakeBoardStore } from "../../models/fake-board-store.ts";
import {
  boardModelsContext,
  type loadBoardModels,
} from "../../middleware/models.ts";
import controller from "./controller.tsx";
import boardCardsController from "../board-cards/controller.tsx";
import { routes } from "../../routes.ts";

async function page(
  overrides: Partial<Board> = {},
  viewerMemberId: string | null = "m1",
  section = "good",
) {
  let cards: Card[] = [
    {
      id: "own",
      boardId: "demo",
      memberId: "m1",
      categoryId: "good",
      body: "ملاحظتي",
      isAnonymous: true,
      voteCount: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: "other",
      boardId: "demo",
      memberId: "m2",
      categoryId: "good",
      body: "ملاحظة زميل",
      isAnonymous: false,
      voteCount: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: "bad-card", boardId: "demo", memberId: "m2", categoryId: "bad",
      body: "ملاحظة القسم الآخر", isAnonymous: false, voteCount: 0,
      createdAt: new Date().toISOString(),
    },
  ];
  let models = {
    ...createFakeBoardModels(createFakeBoardStore({ cards, submissions: new Map(), votes: new Map<string, Set<string>>() })),
    getBoard: async () => ({ ...board, votingOpen: false, ...overrides }),
    getViewerMemberId: async () => viewerMemberId,
  };
  let provideModels: ReturnType<typeof loadBoardModels> = (context, next) => {
    context.set(boardModelsContext, models, { property: "models" });
    return next();
  };
  let router = createRouter({ middleware: [loadLocale(), loadAppDependencies({ config: { appEnv: "test" }, waitUntil() {} }), render(), loadSession("test-only-session-secret"), provideModels] });
  router.map(routes.board, controller);
  router.map(routes.boardCards, boardCardsController);
  let response = await router.fetch(`http://localhost/boards/demo?section=${encodeURIComponent(section)}`);
  assert.equal(response.status, 200);
  return response.text();
}

describe("own-card menu", () => {
  for (let status of ["collecting", "meeting"] as const) {
    it(`links to edit and confirmation for an anonymous own card during ${status}`, async () => {
      let html = await page({ status, votingOpen: false });
      assert.ok(html.includes(routes.editCard.index.href({ boardId: "demo", cardId: "own" })));
      assert.ok(html.includes(routes.deleteCard.index.href({ boardId: "demo", cardId: "own" })));
      assert.ok(
        !html.includes(routes.editCard.index.href({ boardId: "demo", cardId: "other" })),
      );
      assert.ok(
        !html.includes(routes.deleteCard.index.href({ boardId: "demo", cardId: "other" })),
      );
      assert.match(html, /<details[\s>]/);
    });
  }
  it("explains why management is unavailable during voting", async () => {
    let html = await page({ votingOpen: true });
    assert.ok(html.includes("التعديل والحذف غير متاحين أثناء التصويت"));
    assert.ok(!html.includes(routes.editCard.index.href({ boardId: "demo", cardId: "own" })));
    assert.ok(!html.includes(routes.deleteCard.index.href({ boardId: "demo", cardId: "own" })));
  });
  it("explains why management is unavailable after closing", async () => {
    let html = await page({ status: "closed", votingOpen: false });
    assert.ok(html.includes("اللوحة مغلقة"));
    assert.ok(!html.includes(routes.editCard.index.href({ boardId: "demo", cardId: "own" })));
    assert.ok(!html.includes(routes.deleteCard.index.href({ boardId: "demo", cardId: "own" })));
  });
  it("does not expose management links without a viewer identity", async () => {
    let html = await page({}, null);
    assert.ok(!/href="[^"]*\/(?:edit|delete)"/.test(html));
  });
});

describe("server-rendered board frame", () => {
  it("includes the resolved card list in the initial document without browser JavaScript", async () => {
    let html = await page();
    assert.match(html, /<html[\s>]/);
    assert.ok(html.includes(board.title));
    assert.ok(html.includes("ملاحظتي"));
    assert.ok(html.includes("ملاحظة زميل"));
    assert.ok(!html.includes("ملاحظة القسم الآخر"));
  });

  it("passes the selected category to the frame while keeping the board shell", async () => {
    let html = await page({}, "m1", "bad");
    assert.ok(html.includes(board.title));
    assert.ok(html.includes("ملاحظة القسم الآخر"));
    assert.ok(!html.includes("ملاحظتي"));
    assert.ok(!html.includes("ملاحظة زميل"));
    assert.ok(html.includes("/boards/demo/new?category=bad"));
  });
});


describe("meeting voting banner", () => {
  for (let status of ["collecting", "meeting", "closed"] as const) {
    for (let votingOpen of [false, true]) {
      it(`${status} with voting ${votingOpen ? "open" : "closed"}`, async () => {
        let html = await page({ status, votingOpen });
        assert.equal(
          html.includes('aria-label="حالة التصويت"'),
          status === "meeting" && votingOpen,
        );
      });
    }
  }
});
