import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createRouter } from "remix/router";
import { render } from "remix/middleware/render";
import { board, type Board, type Card } from "../../data/fake-board.ts";
import { createFakeBoardModels } from "../../models/fake-boards.ts";
import {
  boardModelsContext,
  type loadBoardModels,
} from "../../middleware/models.ts";
import controller from "./controller.tsx";
import { routes } from "../../routes.ts";

async function page(
  overrides: Partial<Board> = {},
  viewerMemberId: string | null = "m1",
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
  ];
  let models = {
    ...createFakeBoardModels({ cards, submissions: new Map() }),
    getBoard: async () => ({ ...board, ...overrides }),
    getViewerMemberId: async () => viewerMemberId,
  };
  let provideModels: ReturnType<typeof loadBoardModels> = (context, next) => {
    context.set(boardModelsContext, models, { property: "models" });
    return next();
  };
  let router = createRouter({ middleware: [render(), provideModels] });
  router.map(routes.board, controller);
  let response = await router.fetch("http://localhost/board?section=good");
  assert.equal(response.status, 200);
  return response.text();
}

describe("own-card menu", () => {
  for (let status of ["collecting", "meeting"] as const) {
    it(`links to edit and confirmation for an anonymous own card during ${status}`, async () => {
      let html = await page({ status, votingOpen: false });
      assert.ok(html.includes(routes.editCard.index.href({ cardId: "own" })));
      assert.ok(html.includes(routes.deleteCard.index.href({ cardId: "own" })));
      assert.ok(
        !html.includes(routes.editCard.index.href({ cardId: "other" })),
      );
      assert.ok(
        !html.includes(routes.deleteCard.index.href({ cardId: "other" })),
      );
      assert.match(html, /<details[\s>]/);
    });
  }
  it("explains why management is unavailable during voting", async () => {
    let html = await page({ votingOpen: true });
    assert.ok(html.includes("التعديل والحذف غير متاحين أثناء التصويت"));
    assert.ok(!html.includes("/board/cards/own/"));
  });
  it("explains why management is unavailable after closing", async () => {
    let html = await page({ status: "closed", votingOpen: false });
    assert.ok(html.includes("اللوحة مغلقة"));
    assert.ok(!html.includes("/board/cards/own/"));
  });
  it("does not expose management links without a viewer identity", async () => {
    let html = await page({}, null);
    assert.ok(!html.includes("/board/cards/"));
  });
});
