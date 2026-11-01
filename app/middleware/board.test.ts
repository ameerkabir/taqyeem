import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createController, createRouter } from "remix/router";
import { render } from "remix/middleware/render";
import { route } from "remix/routes";
import { board } from "../data/fake-board.ts";
import type { BoardModels } from "../models/boards.ts";
import { createFakeBoardModels } from "../models/fake-boards.ts";
import { boardModelsContext, type loadBoardModels } from "./models.ts";
import { loadBoard } from "./board.ts";
import { requireBoardMember } from "./board-member.ts";

function setup(overrides: Partial<BoardModels> = {}, boardId = "demo") {
  let models = { ...createFakeBoardModels(), ...overrides };
  let provideModels: ReturnType<typeof loadBoardModels> = (context, next) => {
    context.set(boardModelsContext, models, { property: "models" });
    return next();
  };
  let routes = route({ protected: "/protected" });
  let router = createRouter({ middleware: [render(), provideModels] });
  router.get("/public", () => new Response("Public"));
  router.map(
    routes,
    createController(routes, {
      middleware: [loadBoard({ boardId }), requireBoardMember()],
      actions: {
        protected(context) {
          return Response.json({
            board: context.board,
            member: context.member,
          });
        },
      },
    }),
  );
  return router;
}

async function mustNotRun(): Promise<never> {
  throw new Error("An earlier guard should have stopped this request");
}

describe("board access middleware", () => {
  it("provides the board and verified member and loads the board only once", async () => {
    let loads = 0;
    let router = setup({
      getBoard: async (id) => {
        loads++;
        assert.equal(id, "demo");
        return board;
      },
    });
    let response = await router.fetch("http://localhost/protected");
    assert.equal(response.status, 200);
    let data = (await response.json()) as {
      board: { id: string };
      member: { id: string; boardId: string };
    };
    assert.equal(data.board.id, "demo");
    assert.equal(data.member.id, "m1");
    assert.equal(data.member.boardId, data.board.id);
    assert.equal(loads, 1);
  });

  it("uses the configured board for identity and membership lookups", async () => {
    let router = setup(
      {
        getBoard: async (id) => ({ ...board, id }),
        getViewerMemberId: async (id) => {
          assert.equal(id, "other");
          return "m2";
        },
        listMembers: async (id) => {
          assert.equal(id, "other");
          return [{ id: "m2", boardId: id, displayName: "عضو" }];
        },
      },
      "other",
    );
    assert.equal(
      (await router.fetch("http://localhost/protected")).status,
      200,
    );
  });

  it("rejects a missing board before looking up membership", async () => {
    let router = setup({
      getBoard: async () => null,
      getViewerMemberId: mustNotRun,
    });
    let response = await router.fetch("http://localhost/protected");
    assert.equal(response.status, 404);
    assert.equal(await response.text(), "اللوحة غير موجودة");
  });

  it("rejects missing identity before listing members", async () => {
    let router = setup({
      getViewerMemberId: async () => null,
      listMembers: mustNotRun,
    });
    let response = await router.fetch("http://localhost/protected", {
      headers: { Accept: "application/json" },
    });
    assert.equal(response.status, 403);
    assert.equal(
      ((await response.json()) as { error: string }).error,
      "يرجى الانضمام إلى اللوحة",
    );
  });

  it("rejects a member ID absent from the board", async () => {
    let router = setup({ getViewerMemberId: async () => "unknown" });
    let response = await router.fetch("http://localhost/protected");
    assert.equal(response.status, 403);
    assert.equal(await response.text(), "العضو غير موجود في هذه اللوحة");
  });

  it("rejects matching member IDs belonging to another board", async () => {
    let router = setup({
      listMembers: async () => [
        { id: "m1", boardId: "another-board", displayName: "عضو" },
      ],
    });
    assert.equal(
      (await router.fetch("http://localhost/protected")).status,
      403,
    );
  });

  it("does not apply board access checks to public routes", async () => {
    let router = setup({ getBoard: mustNotRun });
    assert.equal((await router.fetch("http://localhost/public")).status, 200);
  });
});
