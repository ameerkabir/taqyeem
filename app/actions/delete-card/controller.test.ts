import { testDatabase } from "../../test/dependencies.ts";
import { loadLocale } from "../../middleware/locale.ts";
import { loadAppDependencies } from "../../middleware/dependencies.ts";
import { loadSession } from "../../sessions.ts";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createRouter } from "remix/router";
import { render } from "remix/middleware/render";
import { board, type Card } from "../../data/fake-board.ts";
import type { BoardModels } from "../../models/boards.ts";
import { createFakeBoardModels } from "../../models/fake-boards.ts";
import { createFakeBoardStore } from "../../models/fake-board-store.ts";
import {
  boardModelsContext,
  type loadBoardModels,
} from "../../middleware/models.ts";
import { routes } from "../../routes.ts";
import controller from "./controller.tsx";

async function setup(overrides: Partial<BoardModels> = {}) {
  let saved: Card[] = [
    {
      id: "own-card",
      boardId: "demo",
      memberId: "m1",
      categoryId: "ideas",
      body: "ملاحظة <b>خاصة</b>",
      createdAt: new Date().toISOString(),
      isAnonymous: true,
      voteCount: 0,
    },
  ];
  let deletes = 0;
  let base = createFakeBoardModels(createFakeBoardStore({ cards: saved, submissions: new Map(), votes: new Map<string, Set<string>>() }));
  let models: BoardModels = {
    ...base,
    getBoard: async () => ({ ...board, votingOpen: false }),
    deleteCard: async (boardId, cardId) => {
      deletes++;
      return base.deleteCard(boardId, cardId);
    },
    ...overrides,
  };
  let provideModels: ReturnType<typeof loadBoardModels> = (context, next) => {
    context.set(boardModelsContext, models, { property: "models" });
    return next();
  };
  let router = createRouter({ middleware: [loadLocale(), loadAppDependencies({ db: await testDatabase(), config: { appEnv: "test" }, waitUntil() {} }), render(), loadSession("test-only-session-secret"), provideModels] });
  router.map(routes.deleteCard, controller);
  return {
    saved,
    get deletes() {
      return deletes;
    },
    request(method: "GET" | "POST", cardId = "own-card", enhanced = true) {
      return router.fetch(
        new URL(routes.deleteCard.index.href({ boardId: "demo", cardId }), "http://localhost"),
        {
          method,
          headers: { Accept: enhanced ? "application/json" : "text/html" },
        },
      );
    },
  };
}

describe("delete card access", () => {
  for (let method of ["GET", "POST"] as const) {
    for (let testCase of [
      {
        name: "missing board",
        overrides: { getBoard: async () => null },
        status: 404,
      },
      {
        name: "missing membership",
        overrides: { getViewerMemberId: async () => null },
        status: 403,
      },
      {
        name: "another member",
        overrides: { getViewerMemberId: async () => "m2" },
        status: 403,
      },
      {
        name: "closed board",
        overrides: {
          getBoard: async () => ({ ...board, status: "closed" as const }),
        },
        status: 403,
      },
    ]) {
      it(`${method} rejects ${testCase.name} without deleting`, async () => {
        let app = await setup(testCase.overrides);
        assert.equal((await app.request(method)).status, testCase.status);
        assert.equal(app.saved.length, 1);
        assert.equal(app.deletes, 0);
      });
    }
    it(`${method} rejects a missing card`, async () => {
      let app = await setup();
      assert.equal((await app.request(method, "missing")).status, 404);
      assert.equal(app.deletes, 0);
    });
  }

  it("allows the author to delete an anonymous card and returns a redirect", async () => {
    let app = await setup();
    let response = await app.request("POST");
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/boards/demo?section=ideas");
    assert.equal(app.saved.length, 0);
    assert.equal(app.deletes, 1);
  });

  it("does not delete when the confirmation page is opened", async () => {
    let app = await setup();
    assert.equal((await app.request("GET")).status, 200);
    assert.equal(app.deletes, 0);
    let response = await app.request("GET", "own-card", false);
    let html = await response.text();
    assert.ok(html.includes("هل تريد حذف هذه الملاحظة؟"));
    assert.ok(html.includes("ملاحظة &lt;b&gt;خاصة&lt;/b&gt;"));
    assert.match(html, /<form[^>]*method="post"/);
    assert.ok(html.includes("/boards/demo?section=ideas"));
  });

  for (let status of ["collecting", "meeting", "closed"] as const) {
    for (let votingOpen of [false, true]) {
      for (let method of ["GET", "POST"] as const) {
        it(`${method} checks ${status} with voting ${votingOpen ? "open" : "closed"}`, async () => {
          let app = await setup({
            getBoard: async () => ({ ...board, status, votingOpen }),
          });
          let response = await app.request(method);
          let allowed = status !== "closed" && !votingOpen;
          assert.equal(
            response.status,
            allowed ? (method === "POST" ? 303 : 200) : 403,
          );
          let deleted = allowed && method === "POST";
          assert.equal(app.deletes, deleted ? 1 : 0);
          assert.equal(app.saved.length, deleted ? 0 : 1);
          if (!allowed) {
            assert.equal(
              ((await response.json()) as { error: string }).error,
              status === "closed"
                ? "اللوحة مغلقة"
                : "لا يمكن حذف الملاحظة أثناء التصويت",
            );
          }
        });
      }
    }
  }

  it("rechecks voting on POST if voting opened after the confirmation request", async () => {
    let votingOpen = false;
    let app = await setup({ getBoard: async () => ({ ...board, votingOpen }) });
    assert.equal((await app.request("GET")).status, 200);
    votingOpen = true;
    let response = await app.request("POST");
    assert.equal(response.status, 403);
    assert.equal(
      ((await response.json()) as { error: string }).error,
      "لا يمكن حذف الملاحظة أثناء التصويت",
    );
    assert.equal(app.deletes, 0);
    assert.equal(app.saved.length, 1);
  });
});
