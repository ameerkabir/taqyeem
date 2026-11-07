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

function validForm() {
  let data = new FormData();
  data.set("text", "  ملاحظة معدلة  ");
  data.set("categoryId", "bad");
  return data;
}
function setup(overrides: Partial<BoardModels> = {}) {
  let original: Card = {
    id: "own-card",
    boardId: "demo",
    memberId: "m1",
    categoryId: "ideas",
    body: "ملاحظة <b>أصلية</b>",
    isAnonymous: true,
    voteCount: 7,
    createdAt: "2026-10-20T10:00:00Z",
  };
  let saved = [{ ...original }];
  let updates = 0;
  let base = createFakeBoardModels(createFakeBoardStore({ cards: saved, submissions: new Map(), votes: new Map<string, Set<string>>() }));
  let models = {
    ...base,
    getBoard: async () => ({ ...board, votingOpen: false }),
    updateCard: async (...args: Parameters<BoardModels["updateCard"]>) => {
      updates++;
      return base.updateCard(...args);
    },
    ...overrides,
  };
  let provideModels: ReturnType<typeof loadBoardModels> = (context, next) => {
    context.set(boardModelsContext, models, { property: "models" });
    return next();
  };
  let router = createRouter({ middleware: [loadAppDependencies({ config: { appEnv: "test" }, waitUntil() {} }), render(), loadSession("test-only-session-secret"), provideModels] });
  router.map(routes.editCard, controller);
  return {
    original,
    saved,
    get updates() {
      return updates;
    },
    request(
      method: "GET" | "POST",
      data = validForm(),
      enhanced = true,
      cardId = "own-card",
    ) {
      return router.fetch(
        new URL(routes.editCard.index.href({ boardId: "demo", cardId }), "http://localhost"),
        {
          method,
          headers: { Accept: enhanced ? "application/json" : "text/html" },
          ...(method === "POST" ? { body: data } : {}),
        },
      );
    },
  };
}

describe("edit card", () => {
  it("prefills the escaped text, category and anonymity without mutating on GET", async () => {
    let app = setup();
    let response = await app.request("GET");
    assert.equal(response.status, 200);
    let html = await response.text();
    assert.ok(html.includes("ملاحظة &lt;b&gt;أصلية&lt;/b&gt;"));
    assert.match(html, /value="ideas"[^>]*checked/);
    assert.match(html, /name="isAnonymous"[^>]*checked/);
    assert.ok(html.includes("/boards/demo?section=ideas"));
    assert.equal(app.updates, 0);
  });
  it("saves editable fields, preserves identity and votes, and redirects to the selected category", async () => {
    let app = setup();
    let data = validForm();
    data.set("id", "forged");
    data.set("memberId", "m2");
    data.set("voteCount", "0");
    let response = await app.request("POST", data);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/boards/demo?section=bad");
    let card = app.saved[0];
    assert.equal(card.body, "ملاحظة معدلة");
    assert.equal(card.categoryId, "bad");
    assert.equal(card.isAnonymous, false);
    assert.equal(card.id, app.original.id);
    assert.equal(card.memberId, app.original.memberId);
    assert.equal(card.createdAt, app.original.createdAt);
    assert.equal(card.voteCount, 7);
    assert.equal(app.updates, 1);
  });
  it("can retain anonymity and accepts exactly 500 trimmed characters without a submission ID", async () => {
    let app = setup();
    let data = validForm();
    data.set("text", ` ${"س".repeat(500)} `);
    data.set("isAnonymous", "true");
    assert.equal((await app.request("POST", data)).status, 303);
    assert.equal(app.saved[0].body.length, 500);
    assert.equal(app.saved[0].isAnonymous, true);
  });
  for (let method of ["GET", "POST"] as const) {
    for (let scenario of [
      {
        name: "missing board",
        overrides: { getBoard: async () => null },
        status: 404,
      },
      {
        name: "missing member",
        overrides: { getViewerMemberId: async () => null },
        status: 403,
      },
      {
        name: "another author",
        overrides: { getViewerMemberId: async () => "m2" },
        status: 403,
      },
      {
        name: "missing card",
        overrides: { getCard: async () => null },
        status: 404,
      },
    ]) {
      it(`${method} rejects ${scenario.name} without updating`, async () => {
        let app = setup(scenario.overrides);
        assert.equal((await app.request(method)).status, scenario.status);
        assert.equal(app.updates, 0);
        assert.equal(app.saved[0].body, app.original.body);
      });
    }
    for (let status of ["collecting", "meeting", "closed"] as const) {
      for (let votingOpen of [false, true]) {
        it(`${method} checks ${status} with voting ${votingOpen ? "open" : "closed"}`, async () => {
          let app = setup({
            getBoard: async () => ({ ...board, status, votingOpen }),
          });
          let allowed = status !== "closed" && !votingOpen;
          assert.equal(
            (await app.request(method)).status,
            allowed ? (method === "GET" ? 200 : 303) : 403,
          );
          assert.equal(app.updates, allowed && method === "POST" ? 1 : 0);
        });
      }
    }
  }
  for (let scenario of [
    { name: "missing text", field: "text", value: null },
    { name: "blank text", field: "text", value: " \n " },
    { name: "oversized text", field: "text", value: "س".repeat(501) },
    { name: "uploaded text", field: "text", value: new Blob(["text"]) },
    { name: "missing category", field: "categoryId", value: null },
    { name: "foreign category", field: "categoryId", value: "unknown" },
  ]) {
    it(`rejects ${scenario.name} without updating`, async () => {
      let app = setup();
      let data = validForm();
      if (scenario.value === null) data.delete(scenario.field);
      else if (typeof scenario.value === "string")
        data.set(scenario.field, scenario.value);
      else data.set(scenario.field, scenario.value);
      let response = await app.request("POST", data);
      assert.equal(response.status, 400);
      assert.equal(app.updates, 0);
      assert.equal(app.saved[0].body, app.original.body);
      assert.ok(((await response.json()) as { error: string }).error);
    });
  }
  it("preserves the native draft and choices when validation fails", async () => {
    let app = setup();
    let data = validForm();
    let text = `<script>${"س".repeat(501)}</script>`;
    data.set("text", text);
    data.set("isAnonymous", "true");
    let response = await app.request("POST", data, false);
    assert.equal(response.status, 400);
    let html = await response.text();
    assert.ok(html.includes("الحد الأقصى ٥٠٠ حرف"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(!html.includes(text));
    assert.match(html, /value="bad"[^>]*checked/);
    assert.match(html, /name="isAnonymous"[^>]*checked/);
    assert.match(html, /role="alert"/);
    assert.equal(app.updates, 0);
  });
  it("rechecks voting on POST and preserves the native edit draft", async () => {
    let votingOpen = false;
    let app = setup({ getBoard: async () => ({ ...board, votingOpen }) });
    assert.equal((await app.request("GET")).status, 200);
    votingOpen = true;
    let response = await app.request("POST", validForm(), false);
    assert.equal(response.status, 403);
    let html = await response.text();
    assert.ok(html.includes("لا يمكن تعديل الملاحظة أثناء التصويت"));
    assert.ok(html.includes("ملاحظة معدلة"));
    assert.equal(app.updates, 0);
  });
});
