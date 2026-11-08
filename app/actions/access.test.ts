import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import type { Database } from "remix/data-table";
import { ACCESS_REASON_HEADER, NOT_MEMBER_REASON } from "../data/access.ts";
import { boards, cards, categories, members, votes } from "../data/tables.ts";
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

type Caller = "visitor" | "outsider" | "participant" | "organiser" | "latecomer";

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
    latecomer: undefined, // joins after the board is closed, in the closed-board tests
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

  return { db, request, cookies, path, cardId: cardId!, categoryId: category.id };
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
    let organiserOnly: [string, Record<string, string>][] = [
      [`${w.path}/voting`, { votingOpen: "true" }],
      [`${w.path}/status`, { status: "meeting" }],
    ];
    for (let [path, fields] of organiserOnly) {
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

// Closing a board stops contributions. It does not stop membership or reading.
describe("closed boards: join and read, never contribute", () => {
  async function closedWorld() {
    let w = await world();
    let closed = await w.request("organiser", `${w.path}/status`, { method: "POST", fields: { status: "closed" } });
    assert.equal(closed.status, 303);
    let joined = await w.request("visitor", `${w.path}/join`, { method: "POST", fields: { displayName: "Lina" } });
    assert.equal(joined.status, 303);
    w.cookies.latecomer = sessionCookie(joined);
    return w;
  }

  const count = async (w: Awaited<ReturnType<typeof world>>, table: typeof cards | typeof votes | typeof members) =>
    (await w.db.findMany(table)).length;

  it("a visitor joins a closed board and becomes an ordinary participant", async () => {
    let w = await closedWorld();
    let [lina] = await w.db.findMany(members, { where: { display_name: "Lina" } });
    assert.equal(lina.role, "participant");
    assert.equal(lina.board_id, w.path.split("/").pop());
    // Not the organiser: the board's organiser is unchanged and exactly one.
    let organisers = (await w.db.findMany(members, { where: { board_id: lina.board_id } })).filter((m) => m.role === "organiser");
    assert.equal(organisers.length, 1);
    assert.equal((await w.db.findMany(boards, { where: { id: lina.board_id } }))[0].status, "closed");
  });

  it("their signed session lets them read the board, the notes and the page they came for", async () => {
    let w = await closedWorld();
    let board = await w.request("latecomer", w.path);
    assert.equal(board.status, 200);
    let fragment = await w.request("latecomer", `${w.path}/cards?section=${w.categoryId}`);
    assert.equal(fragment.status, 200);
    assert.ok((await fragment.text()).includes("A note"));
    // The closed explanation is on the page; the add-note link is not offered.
    let html = await (await w.request("latecomer", w.path)).text();
    assert.ok(html.includes("اللوحة مغلقة، لا يمكن إضافة ملاحظات"));
    assert.ok(!html.includes(`${w.path}/new?category=`));
  });

  it("a forged or missing session on the same closed board still cannot read", async () => {
    let w = await closedWorld();
    assert.equal((await w.request("visitor", w.path)).status, 303);
    assert.equal((await w.request("outsider", w.path)).status, 303);
    assert.equal((await w.request("visitor", `${w.path}/cards?section=${w.categoryId}`)).status, 403);
  });

  it("creating, editing, deleting and voting are rejected on a closed board, and write nothing", async () => {
    let w = await closedWorld();
    let before = { cards: await count(w, cards), votes: await count(w, votes) };
    let [original] = await w.db.findMany(cards);

    let attempts: { who: Caller; name: string; path: string; fields: Record<string, string> }[] = [
      { who: "latecomer", name: "new note", path: `${w.path}/new`, fields: { submissionId: crypto.randomUUID(), text: "late note", categoryId: w.categoryId, isAnonymous: "false" } },
      { who: "latecomer", name: "vote", path: `${w.path}/cards/${w.cardId}/vote`, fields: { voted: "true" } },
      { who: "latecomer", name: "edit another's note", path: `${w.path}/cards/${w.cardId}/edit`, fields: { text: "hacked", categoryId: w.categoryId, isAnonymous: "false" } },
      { who: "latecomer", name: "delete another's note", path: `${w.path}/cards/${w.cardId}/delete`, fields: {} },
      // Even the author, who is a member, cannot change their own note while closed.
      { who: "organiser", name: "author edit", path: `${w.path}/cards/${w.cardId}/edit`, fields: { text: "edited", categoryId: w.categoryId, isAnonymous: "false" } },
      { who: "organiser", name: "author delete", path: `${w.path}/cards/${w.cardId}/delete`, fields: {} },
      { who: "organiser", name: "author vote", path: `${w.path}/cards/${w.cardId}/vote`, fields: { voted: "true" } },
      { who: "participant", name: "new note by an earlier member", path: `${w.path}/new`, fields: { submissionId: crypto.randomUUID(), text: "late", categoryId: w.categoryId, isAnonymous: "false" } },
    ];
    for (let attempt of attempts) {
      let response = await w.request(attempt.who, attempt.path, { method: "POST", json: true, fields: attempt.fields });
      assert.equal(response.status, 403, `${attempt.who}: ${attempt.name}`);
      let body = (await response.json()) as { error: string };
      assert.equal(typeof body.error, "string");
    }
    assert.equal(await count(w, cards), before.cards);
    assert.equal(await count(w, votes), before.votes);
    let [after] = await w.db.findMany(cards);
    assert.equal(after.body, original.body);
  });

  it("ordinary members cannot change the stage or voting, so a closed board cannot be reopened by them", async () => {
    let w = await closedWorld();
    for (let who of ["latecomer", "participant"] as const) {
      let organiserOnly: [string, Record<string, string>][] = [
        [`${w.path}/status`, { status: "collecting" }],
        [`${w.path}/status`, { status: "meeting" }],
        [`${w.path}/voting`, { votingOpen: "true" }],
      ];
      for (let [path, fields] of organiserOnly) {
        let response = await w.request(who, path, { method: "POST", json: true, fields });
        assert.equal(response.status, 403, `${who} ${path}`);
        assert.equal(response.headers.get(ACCESS_REASON_HEADER), null, "a member refused is not 'not a member'");
      }
    }
    let [board] = await w.db.findMany(boards);
    assert.equal(board.status, "closed");
    assert.equal(board.voting_open, 0);
  });

  it("a returning member skips joining and keeps their identity", async () => {
    let w = await closedWorld();
    let before = await count(w, members);
    let [lina] = await w.db.findMany(members, { where: { display_name: "Lina" } });
    let again = await w.request("latecomer", `${w.path}/join`, { method: "POST", fields: { displayName: "Lina" } });
    assert.equal(again.status, 303);
    assert.equal(again.headers.get("Location"), w.path);
    assert.equal((await w.request("latecomer", `${w.path}/join`)).status, 303);
    assert.equal(await count(w, members), before);
    assert.equal((await w.db.findMany(members, { where: { display_name: "Lina" } }))[0].id, lina.id);
  });

  it("when the organiser reopens the board, a member who joined while closed contributes as any member would", async () => {
    let w = await closedWorld();
    // Reopened and collecting: notes allowed, voting not yet open.
    assert.equal((await w.request("organiser", `${w.path}/status`, { method: "POST", fields: { status: "collecting" } })).status, 303);
    let note = await w.request("latecomer", `${w.path}/new`, {
      method: "POST",
      json: true,
      fields: { submissionId: crypto.randomUUID(), text: "now allowed", categoryId: w.categoryId, isAnonymous: "false" },
    });
    assert.equal(note.status, 303);
    assert.equal(await count(w, cards), 2);
    let vote = await w.request("latecomer", `${w.path}/cards/${w.cardId}/vote`, { method: "POST", json: true, fields: { voted: "true" } });
    assert.equal(vote.status, 403, "voting is still governed by the board's voting setting");

    // Voting opened by the organiser: they can vote; editing is locked during voting, as for everyone.
    assert.equal((await w.request("organiser", `${w.path}/voting`, { method: "POST", fields: { votingOpen: "true" } })).status, 303);
    let voted = await w.request("latecomer", `${w.path}/cards/${w.cardId}/vote`, { method: "POST", json: true, fields: { voted: "true" } });
    assert.equal(voted.status, 200);
    assert.deepEqual(await voted.json(), { voted: true, count: 1 });
    let [own] = (await w.db.findMany(cards)).filter((c) => c.body === "now allowed");
    assert.equal((await w.request("latecomer", `${w.path}/cards/${own.id}/edit`, { method: "POST", json: true, fields: { text: "x", categoryId: w.categoryId, isAnonymous: "false" } })).status, 403);

    // Voting closed again: they may edit their own note, but still not anyone else's, and they never become organiser.
    await w.request("organiser", `${w.path}/voting`, { method: "POST", fields: { votingOpen: "false" } });
    let edited = await w.request("latecomer", `${w.path}/cards/${own.id}/edit`, { method: "POST", json: true, fields: { text: "edited by me", categoryId: w.categoryId, isAnonymous: "false" } });
    assert.equal(edited.status, 303);
    assert.equal((await w.request("latecomer", `${w.path}/cards/${w.cardId}/edit`, { method: "POST", json: true, fields: { text: "x", categoryId: w.categoryId, isAnonymous: "false" } })).status, 403);
    assert.equal((await w.request("latecomer", `${w.path}/status`, { method: "POST", json: true, fields: { status: "closed" } })).status, 403);
  });

  it("closing again takes contribution away from them again without removing their membership", async () => {
    let w = await closedWorld();
    await w.request("organiser", `${w.path}/status`, { method: "POST", fields: { status: "collecting" } });
    await w.request("organiser", `${w.path}/status`, { method: "POST", fields: { status: "closed" } });
    assert.equal((await w.request("latecomer", w.path)).status, 200);
    let note = await w.request("latecomer", `${w.path}/new`, { method: "POST", json: true, fields: { submissionId: crypto.randomUUID(), text: "nope", categoryId: w.categoryId, isAnonymous: "false" } });
    assert.equal(note.status, 403);
  });

  it("keeps the requested board and category from the gated page through joining a closed board", async () => {
    let w = await world();
    await w.request("organiser", `${w.path}/status`, { method: "POST", fields: { status: "closed" } });
    let [first, second] = (await w.db.findMany(categories, { where: { board_id: w.path.split("/").pop()! } }))
      .sort((a, b) => a.position - b.position);
    assert.ok(first && second);

    let gated = await w.request("visitor", `${w.path}?section=${second.id}`);
    assert.equal(gated.status, 303);
    assert.equal(gated.headers.get("Location"), `${w.path}/join?section=${second.id}`);

    let form = await w.request("visitor", gated.headers.get("Location")!);
    assert.equal(form.status, 200);
    assert.ok((await form.text()).includes(`name="section"`));

    let joined = await w.request("visitor", `${w.path}/join`, { method: "POST", fields: { displayName: "Lina", section: second.id } });
    assert.equal(joined.headers.get("Location"), `${w.path}?section=${second.id}`);
    w.cookies.latecomer = sessionCookie(joined);
    let landed = await w.request("latecomer", joined.headers.get("Location")!);
    assert.equal(landed.status, 200);
  });

  it("missing boards and invalid names fail the same way whatever the board's state", async () => {
    let w = await closedWorld();
    let missing = `/boards/${crypto.randomUUID()}`;
    assert.equal((await w.request("visitor", `${missing}/join`)).status, 404);
    assert.equal((await w.request("visitor", `${missing}/join`, { method: "POST", fields: { displayName: "Pat" } })).status, 404);
    let before = await count(w, members);
    for (let name of ["", "  ", "\u200B"]) {
      assert.equal((await w.request("visitor", `${w.path}/join`, { method: "POST", fields: { displayName: name } })).status, 400);
    }
    assert.equal((await w.request("visitor", `${w.path}/join`, { method: "POST", fields: { displayName: "lina" } })).status, 409);
    assert.equal(await count(w, members), before);
  });
});

