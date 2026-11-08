import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import type { Database } from "remix/data-table";
import { ACCESS_REASON_HEADER, NOT_MEMBER_REASON } from "../data/access.ts";
import { categories } from "../data/tables.ts";
import { createAppRouter } from "../router.ts";
import { testDatabase } from "../test/dependencies.ts";

// The authorization matrix. Every board route is tried by every kind of caller and the exact
// outcome is asserted, so a new route without a guard (or a guard that is only in the UI)
// shows up here. Nothing in this file looks at what the page shows; the API decides.

const options = {
  sessionSecret: "test-only-session-secret",
  config: { appEnv: "test" },
  waitUntil() {},
};

type Caller = "visitor" | "outsider" | "participant" | "organiser";

function sessionCookie(response: Response) {
  return response.headers.getSetCookie().find((c) => c.startsWith("taqyeem_session="))!.split(";")[0];
}

async function world() {
  let db = await testDatabase();
  let cookies: Record<Caller, string | undefined> = {
    visitor: undefined,
    outsider: undefined,
    participant: undefined,
    organiser: undefined,
  };

  function request(caller: Caller, path: string, init: { method?: string; json?: boolean; fields?: Record<string, string> } = {}) {
    let headers = new Headers();
    if (cookies[caller]) headers.set("Cookie", cookies[caller]!);
    if (init.json) headers.set("Accept", "application/json");
    return createAppRouter({ ...options, db }).fetch(
      new Request("http://localhost" + path, {
        method: init.method ?? "GET",
        headers,
        body: init.fields ? new URLSearchParams(init.fields) : undefined,
      }),
    );
  }

  // The organiser creates the board; another person organises a different board; a third
  // person joins the first board as a participant; a fourth has never touched the app.
  let created = await request("visitor", "/boards/new", {
    method: "POST",
    fields: { title: "Board A", organiserDisplayName: "Sam" },
  });
  cookies.organiser = sessionCookie(created);
  let path = created.headers.get("Location")!;

  let otherBoard = await request("visitor", "/boards/new", {
    method: "POST",
    fields: { title: "Board B", organiserDisplayName: "Lee" },
  });
  cookies.outsider = sessionCookie(otherBoard);

  let joined = await request("visitor", `${path}/join`, { method: "POST", fields: { displayName: "Pat" } });
  cookies.participant = sessionCookie(joined);

  // A note by the organiser, to address by id.
  let boardId = path.split("/").pop()!;
  let [category] = await (db as Database).findMany(categories, { where: { board_id: boardId } });
  let note = await request("organiser", `${path}/new`, {
    method: "POST",
    json: true,
    fields: { submissionId: crypto.randomUUID(), text: "A note", categoryId: category.id, isAnonymous: "false" },
  });
  assert.equal(note.status, 303);
  let cardsHtml = await (await request("organiser", `${path}/cards?section=${category.id}`)).text();
  let cardId = cardsHtml.match(/\/cards\/([0-9a-f-]{36})\//)?.[1];
  assert.ok(cardId, "the note should be listed with links containing its id");

  return { db, request, path, cardId: cardId!, categoryId: category.id };
}

describe("authorization matrix: who may do what", () => {
  it("page navigations: non-members are sent to the join form, members get the page", async () => {
    let w = await world();
    let pages = [
      w.path,
      `${w.path}/new`,
      `${w.path}/cards/${w.cardId}/edit`,
      `${w.path}/cards/${w.cardId}/delete`,
    ];
    for (let page of pages) {
      for (let caller of ["visitor", "outsider"] as const) {
        let response = await w.request(caller, page);
        assert.equal(response.status, 303, `${caller} GET ${page}`);
        assert.equal(response.headers.get("Location"), `${w.path}/join`, `${caller} GET ${page}`);
        assert.equal(await response.text(), "", `${caller} must not receive page content`);
      }
    }
    for (let caller of ["participant", "organiser"] as const) {
      assert.equal((await w.request(caller, w.path)).status, 200, `${caller} board`);
      assert.equal((await w.request(caller, `${w.path}/new`)).status, 200, `${caller} new note`);
    }
  });

  it("the cards fragment is members only and never redirects", async () => {
    let w = await world();
    let fragment = `${w.path}/cards?section=${w.categoryId}`;
    for (let caller of ["visitor", "outsider"] as const) {
      let response = await w.request(caller, fragment);
      assert.equal(response.status, 403, caller);
      assert.equal(response.headers.get(ACCESS_REASON_HEADER), NOT_MEMBER_REASON);
      assert.equal(response.headers.get("Location"), null);
      assert.ok(!(await response.text()).includes("A note"));
    }
    for (let caller of ["participant", "organiser"] as const) {
      let response = await w.request(caller, fragment);
      assert.equal(response.status, 200, caller);
      assert.ok((await response.text()).includes("A note"), caller);
    }
  });

  it("every mutation rejects non-members with 403 JSON, a reason header, and no change", async () => {
    let w = await world();
    let mutations: { name: string; path: string; fields: Record<string, string> }[] = [
      { name: "new note", path: `${w.path}/new`, fields: { submissionId: crypto.randomUUID(), text: "x", categoryId: w.categoryId, isAnonymous: "false" } },
      { name: "edit note", path: `${w.path}/cards/${w.cardId}/edit`, fields: { text: "hacked", categoryId: w.categoryId, isAnonymous: "false" } },
      { name: "delete note", path: `${w.path}/cards/${w.cardId}/delete`, fields: {} },
      { name: "vote", path: `${w.path}/cards/${w.cardId}/vote`, fields: { voted: "true" } },
      { name: "toggle voting", path: `${w.path}/voting`, fields: { votingOpen: "true" } },
      { name: "change stage", path: `${w.path}/status`, fields: { status: "closed" } },
    ];
    for (let caller of ["visitor", "outsider"] as const) {
      for (let mutation of mutations) {
        let response = await w.request(caller, mutation.path, { method: "POST", json: true, fields: mutation.fields });
        assert.equal(response.status, 403, `${caller}: ${mutation.name}`);
        assert.equal(response.headers.get(ACCESS_REASON_HEADER), NOT_MEMBER_REASON, `${caller}: ${mutation.name}`);
        let body = (await response.json()) as { error?: string };
        assert.equal(typeof body.error, "string", `${caller}: ${mutation.name} returns JSON`);
      }
    }
    // Nothing changed.
    let html = await (await w.request("organiser", `${w.path}/cards?section=${w.categoryId}`)).text();
    assert.ok(html.includes("A note") && !html.includes("hacked"));
    assert.ok((await w.request("organiser", w.path)).status === 200); // board not closed
  });

  it("a rejected non-member vote tells the client to join, not that the network failed", async () => {
    let w = await world();
    let response = await w.request("visitor", `${w.path}/cards/${w.cardId}/vote`, {
      method: "POST",
      json: true,
      fields: { voted: "true" },
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get(ACCESS_REASON_HEADER), NOT_MEMBER_REASON);
    assert.deepEqual(await response.json(), { error: "يرجى الانضمام إلى اللوحة" });
  });

  it("only the organiser may open voting or change the stage; a participant gets 403", async () => {
    let w = await world();
    for (let [path, fields] of [
      [`${w.path}/voting`, { votingOpen: "true" }],
      [`${w.path}/status`, { status: "meeting" }],
    ] as const) {
      let asParticipant = await w.request("participant", path, { method: "POST", json: true, fields });
      assert.equal(asParticipant.status, 403, path);
      assert.equal(asParticipant.headers.get(ACCESS_REASON_HEADER), null, "a member being refused is not 'not a member'");
    }
    assert.equal((await w.request("organiser", `${w.path}/status`, { method: "POST", fields: { status: "meeting" } })).status, 303);
    assert.equal((await w.request("organiser", `${w.path}/voting`, { method: "POST", fields: { votingOpen: "true" } })).status, 303);
  });

  it("members can vote once the organiser opens voting; non-members still cannot", async () => {
    let w = await world();
    await w.request("organiser", `${w.path}/voting`, { method: "POST", fields: { votingOpen: "true" } });
    let vote = await w.request("participant", `${w.path}/cards/${w.cardId}/vote`, {
      method: "POST",
      json: true,
      fields: { voted: "true" },
    });
    assert.equal(vote.status, 200);
    assert.deepEqual(await vote.json(), { voted: true, count: 1 });
    let outsider = await w.request("outsider", `${w.path}/cards/${w.cardId}/vote`, {
      method: "POST",
      json: true,
      fields: { voted: "true" },
    });
    assert.equal(outsider.status, 403);
  });

  it("a participant cannot edit or delete someone else's note", async () => {
    let w = await world();
    for (let action of ["edit", "delete"]) {
      let page = await w.request("participant", `${w.path}/cards/${w.cardId}/${action}`);
      assert.equal(page.status, 403, `${action} page`);
      let submit = await w.request("participant", `${w.path}/cards/${w.cardId}/${action}`, {
        method: "POST",
        json: true,
        fields: { text: "hijack", categoryId: w.categoryId, isAnonymous: "false" },
      });
      assert.equal(submit.status, 403, `${action} submit`);
    }
    let html = await (await w.request("organiser", `${w.path}/cards?section=${w.categoryId}`)).text();
    assert.ok(html.includes("A note") && !html.includes("hijack"));
  });

  it("a board that does not exist is 404 for everyone, and the join form never reveals more", async () => {
    let w = await world();
    let missing = `/boards/${crypto.randomUUID()}`;
    for (let caller of ["visitor", "outsider", "participant", "organiser"] as const) {
      assert.equal((await w.request(caller, missing)).status, 404, caller);
      assert.equal((await w.request(caller, `${missing}/join`)).status, 404, caller);
    }
  });
});
