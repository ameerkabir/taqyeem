import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import type { Database } from "remix/data-table";
import { boards, categories, members } from "../../data/tables.ts";
import { MAX_MEMBER_NAME_LENGTH } from "../../data/limits.ts";
import { createAppRouter } from "../../router.ts";
import { testDatabase } from "../../test/dependencies.ts";

const options = {
  sessionSecret: "test-only-session-secret",
  config: { appEnv: "test" },
  waitUntil() {},
};
const origin = "http://localhost";

function call(db: Database, path: string, init: RequestInit & { cookie?: string; fields?: Record<string, string> } = {}) {
  let { cookie, fields, ...rest } = init;
  let headers = new Headers(rest.headers);
  if (cookie) headers.set("Cookie", cookie);
  return createAppRouter({ ...options, db }).fetch(
    new Request(origin + path, {
      ...rest,
      headers,
      body: fields ? new URLSearchParams(fields) : undefined,
    }),
  );
}

function sessionCookie(response: Response) {
  return response.headers.getSetCookie().find((c) => c.startsWith("taqyeem_session="))!.split(";")[0];
}

async function createBoard(db: Database, title = "لوحة الفريق") {
  let response = await call(db, "/boards/new", {
    method: "POST",
    fields: { title, organiserDisplayName: "Sam" },
  });
  assert.equal(response.status, 303);
  return { path: response.headers.get("Location")!, organiserCookie: sessionCookie(response) };
}

describe("join form", () => {
  it("shows the board's title and a name field to someone who has not joined", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    let response = await call(db, `${path}/join`);
    assert.equal(response.status, 200);
    let html = await response.text();
    assert.ok(html.includes("لوحة الفريق"));
    assert.ok(html.includes('name="displayName"'));
    // Nothing about the board's contents is shown before joining.
    assert.ok(!html.includes("ما سار بشكل جيد"));
  });

  it("returns 404 for a board that does not exist", async () => {
    let db = await testDatabase();
    assert.equal((await call(db, `/boards/${crypto.randomUUID()}/join`)).status, 404);
    assert.equal(
      (await call(db, `/boards/${crypto.randomUUID()}/join`, { method: "POST", fields: { displayName: "Pat" } })).status,
      404,
    );
  });

  it("joins as a participant, signs the visitor in, and lets them see the board", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    let response = await call(db, `${path}/join`, { method: "POST", fields: { displayName: "  Pat  " } });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), path);

    let [pat] = await db.findMany(members, { where: { display_name: "Pat" } });
    assert.equal(pat.role, "participant");

    let cookie = sessionCookie(response);
    let board = await call(db, path, { cookie });
    assert.equal(board.status, 200);
    assert.ok((await board.text()).includes("لوحة الفريق"));
  });

  it("does not make the new member an organiser", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    let joined = await call(db, `${path}/join`, { method: "POST", fields: { displayName: "Pat" } });
    let board = await (await call(db, path, { cookie: sessionCookie(joined) })).text();
    assert.ok(!board.includes("You are the organiser") && !board.includes("أنت منظم"));
    let status = await call(db, `${path}/status`, {
      method: "POST",
      cookie: sessionCookie(joined),
      fields: { status: "closed" },
    });
    assert.equal(status.status, 403);
  });

  it("does not create a second member when the form is submitted again", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    let first = await call(db, `${path}/join`, { method: "POST", fields: { displayName: "Pat" } });
    let cookie = sessionCookie(first);
    let again = await call(db, `${path}/join`, { method: "POST", cookie, fields: { displayName: "Pat" } });
    assert.equal(again.status, 303);
    assert.equal(again.headers.get("Location"), path);
    assert.equal((await db.findMany(members, { where: { display_name: "Pat" } })).length, 1);
  });

  it("sends an existing member straight to the board", async () => {
    let db = await testDatabase();
    let { path, organiserCookie } = await createBoard(db);
    let response = await call(db, `${path}/join`, { cookie: organiserCookie });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), path);
  });

  it("keeps a visitor's memberships on other boards when they join another", async () => {
    let db = await testDatabase();
    let own = await createBoard(db, "My board");
    let other = await createBoard(db, "Other board");
    let joined = await call(db, `${other.path}/join`, {
      method: "POST",
      cookie: own.organiserCookie,
      fields: { displayName: "Alex" },
    });
    let cookie = sessionCookie(joined);
    assert.equal((await call(db, own.path, { cookie })).status, 200);
    assert.equal((await call(db, other.path, { cookie })).status, 200);
  });

  it("re-shows the form with the typed name and a message when the name is invalid", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    for (let name of ["", "   ", "a".repeat(MAX_MEMBER_NAME_LENGTH + 1)]) {
      let response = await call(db, `${path}/join`, {
        method: "POST",
        headers: { "Accept-Language": "en" },
        fields: { displayName: name },
      });
      assert.equal(response.status, 400, JSON.stringify(name));
      assert.ok((await response.text()).includes('role="alert"'));
    }
    assert.equal((await db.findMany(members)).length, 1); // only the organiser
  });

  it("shows the length limit in the active language", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    let tooLong = "a".repeat(MAX_MEMBER_NAME_LENGTH + 1);
    let en = await (await call(db, `${path}/join`, { method: "POST", headers: { "Accept-Language": "en" }, fields: { displayName: tooLong } })).text();
    assert.ok(en.includes(`at most ${MAX_MEMBER_NAME_LENGTH} characters`));
    let ar = await (await call(db, `${path}/join`, { method: "POST", fields: { displayName: tooLong } })).text();
    assert.ok(ar.includes(String(MAX_MEMBER_NAME_LENGTH)));
  });

  it("shows a retry message and keeps the name when saving fails", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    let failing = new Proxy(db, {
      get(target, property) {
        let value = Reflect.get(target, property, target);
        if (property === "create") {
          return async (table: unknown, ...rest: unknown[]) => {
            if (table === members) throw new Error("simulated write failure");
            return (value as (...a: unknown[]) => unknown).call(target, table, ...rest);
          };
        }
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as Database;
    let response = await call(failing, `${path}/join`, {
      method: "POST",
      headers: { "Accept-Language": "en" },
      fields: { displayName: "Pat" },
    });
    assert.equal(response.status, 500);
    let html = await response.text();
    assert.ok(html.includes("you were not added"));
    assert.ok(html.includes('value="Pat"'));
    assert.ok(!html.includes("simulated"));
    assert.equal((await db.findMany(members, { where: { display_name: "Pat" } })).length, 0);
    assert.equal((await db.findMany(boards)).length, 1);
  });

  it("stores hostile text as a plain name", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    let name = "x'); DROP TABLE members; --";
    assert.equal((await call(db, `${path}/join`, { method: "POST", fields: { displayName: name } })).status, 303);
    assert.equal((await db.findMany(members, { where: { display_name: name } })).length, 1);
  });

  it("tells someone their name is taken, keeps what they typed, and adds no one", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db); // organiser: Sam
    for (let typed of ["Sam", "sam", "  SAM  "]) {
      let response = await call(db, `${path}/join`, {
        method: "POST",
        headers: { "Accept-Language": "en" },
        fields: { displayName: typed },
      });
      assert.equal(response.status, 409, typed);
      assert.equal(response.headers.get("Location"), null);
      assert.equal(response.headers.getSetCookie().some((c) => c.startsWith("taqyeem_session=")), false);
      let html = await response.text();
      assert.ok(html.includes("That name is already used on this board"), typed);
      assert.ok(html.includes('role="alert"'));
    }
    assert.equal((await db.findMany(members)).length, 1);
  });

  it("shows the taken-name message in Arabic by default", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    let html = await (await call(db, `${path}/join`, { method: "POST", fields: { displayName: "Sam" } })).text();
    assert.ok(html.includes("هذا الاسم مستخدم بالفعل"));
  });

  it("lets them retry with a different name", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    assert.equal((await call(db, `${path}/join`, { method: "POST", fields: { displayName: "Sam" } })).status, 409);
    let retry = await call(db, `${path}/join`, { method: "POST", fields: { displayName: "Sam K" } });
    assert.equal(retry.status, 303);
  });

  it("treats a name made only of invisible characters as missing", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    let response = await call(db, `${path}/join`, { method: "POST", fields: { displayName: "\u200B\u200B" } });
    assert.equal(response.status, 400);
    assert.equal((await db.findMany(members)).length, 1);
  });
});

async function categoryIds(db: Database, path: string) {
  let rows = await db.findMany(categories, { where: { board_id: path.split("/").pop()! } });
  return rows.map((row) => row.id);
}

async function closeBoard(db: Database, path: string, organiserCookie: string) {
  let response = await call(db, `${path}/status`, { method: "POST", cookie: organiserCookie, fields: { status: "closed" } });
  assert.equal(response.status, 303);
}

describe("joining a closed board", () => {
  it("shows the form with a clear view-only explanation, not an error, in English", async () => {
    let db = await testDatabase();
    let { path, organiserCookie } = await createBoard(db);
    await closeBoard(db, path, organiserCookie);
    let response = await call(db, `${path}/join`, { headers: { "Accept-Language": "en" } });
    assert.equal(response.status, 200);
    let html = await response.text();
    assert.ok(html.includes("This board is closed. You can join and read its notes"));
    assert.ok(html.includes("can no longer be added, edited, deleted or voted on"));
    assert.ok(html.includes('role="note"'));
    assert.ok(!html.includes('role="alert"'), "closed is an explanation, not an error");
    assert.ok(html.includes('name="displayName"'));
    assert.ok(html.includes("Join to view"));
    assert.ok(!html.includes("no longer accepting"));
  });

  it("explains it in Arabic, right-to-left, with the same form", async () => {
    let db = await testDatabase();
    let { path, organiserCookie } = await createBoard(db);
    await closeBoard(db, path, organiserCookie);
    let html = await (await call(db, `${path}/join`)).text();
    assert.match(html, /<html[^>]*\blang="ar"/);
    assert.match(html, /<html[^>]*\bdir="rtl"/);
    assert.ok(html.includes("هذه اللوحة مغلقة. يمكنك الانضمام وقراءة ملاحظاتها"));
    assert.ok(html.includes("انضم للعرض"));
    assert.ok(html.includes('name="displayName"'));
  });

  it("does not show the view-only explanation on an open board", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    let html = await (await call(db, `${path}/join`, { headers: { "Accept-Language": "en" } })).text();
    assert.ok(!html.includes("This board is closed"));
    assert.ok(html.includes("Join board"));
  });

  it("is a native form that posts without JavaScript", async () => {
    let db = await testDatabase();
    let { path, organiserCookie } = await createBoard(db);
    await closeBoard(db, path, organiserCookie);
    let html = await (await call(db, `${path}/join`)).text();
    let form = html.match(/<form[^>]*action="[^"]*\/join"[^>]*>/)?.[0] ?? "";
    assert.match(form, /method="post"/i);
    // Posting the fields a browser would send, with no script, joins.
    let joined = await call(db, `${path}/join`, { method: "POST", fields: { displayName: "Pat" } });
    assert.equal(joined.status, 303);
  });

  it("joins as an ordinary participant, signs them in, and lets them read the closed board", async () => {
    let db = await testDatabase();
    let { path, organiserCookie } = await createBoard(db);
    await closeBoard(db, path, organiserCookie);
    let joined = await call(db, `${path}/join`, { method: "POST", fields: { displayName: "Pat" } });
    assert.equal(joined.status, 303);
    assert.equal(joined.headers.get("Location"), path);
    let [pat] = await db.findMany(members, { where: { display_name: "Pat" } });
    assert.equal(pat.role, "participant");
    let cookie = sessionCookie(joined);
    let board = await call(db, path, { cookie });
    assert.equal(board.status, 200);
    let [category] = await categoryIds(db, path);
    assert.equal((await call(db, `${path}/cards?section=${category}`, { cookie })).status, 200);
    assert.equal((await db.findMany(boards))[0].status, "closed");
  });

  it("still rejects an invalid name, a taken name, and a missing board", async () => {
    let db = await testDatabase();
    let { path, organiserCookie } = await createBoard(db);
    await closeBoard(db, path, organiserCookie);
    for (let name of ["", "   ", "\u200B", "a".repeat(MAX_MEMBER_NAME_LENGTH + 1)]) {
      let response = await call(db, `${path}/join`, { method: "POST", fields: { displayName: name } });
      assert.equal(response.status, 400, JSON.stringify(name));
      // They are told it is view-only even while correcting the name.
      assert.ok((await response.text()).includes('role="note"'));
    }
    assert.equal((await call(db, `${path}/join`, { method: "POST", fields: { displayName: "sam" } })).status, 409);
    assert.equal((await call(db, `/boards/${crypto.randomUUID()}/join`, { method: "POST", fields: { displayName: "Pat" } })).status, 404);
    assert.equal((await db.findMany(members)).length, 1);
  });

  it("does not add a second member when a returning member submits the form again", async () => {
    let db = await testDatabase();
    let { path, organiserCookie } = await createBoard(db);
    await closeBoard(db, path, organiserCookie);
    let first = await call(db, `${path}/join`, { method: "POST", fields: { displayName: "Pat" } });
    let cookie = sessionCookie(first);
    let again = await call(db, `${path}/join`, { method: "POST", cookie, fields: { displayName: "Pat" } });
    let visit = await call(db, `${path}/join`, { cookie });
    assert.equal(again.status, 303);
    assert.equal(visit.status, 303);
    assert.equal((await db.findMany(members, { where: { display_name: "Pat" } })).length, 1);
  });
});

describe("returning to the requested category after joining", () => {
  it("carries a valid category in the form so it survives a submit without JavaScript", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    let [, second] = await categoryIds(db, path);
    let html = await (await call(db, `${path}/join?section=${second}`)).text();
    assert.ok(new RegExp(`<input[^>]*name="section"[^>]*value="${second}"|<input[^>]*value="${second}"[^>]*name="section"`).test(html));
  });

  it("lands on the board and the category they asked for", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    let [, second] = await categoryIds(db, path);
    let response = await call(db, `${path}/join`, { method: "POST", fields: { displayName: "Pat", section: second } });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), `${path}?section=${second}`);
  });

  it("drops a category that is not one of this board's, an unknown one, and an empty one", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db, "Board A");
    let other = await createBoard(db, "Board B");
    let [foreign] = await categoryIds(db, other.path);
    // Each attempt joins as a new person, since a returning member is redirected before joining.
    let attempts = [foreign, "nonsense", "", "../../etc", "x".repeat(500)];
    for (let [index, section] of attempts.entries()) {
      let response = await call(db, `${path}/join`, {
        method: "POST",
        fields: { displayName: `Guest ${index}`, section },
      });
      assert.equal(response.status, 303, section);
      assert.equal(response.headers.get("Location"), path, section); // dropped, not followed
    }
    // And the form never offers a hidden field for an invalid one.
    let html = await (await call(db, `${path}/join?section=${foreign}`)).text();
    assert.ok(!html.includes('name="section"'));
  });

  it("keeps the category when the form is re-shown after an invalid name", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    let [, second] = await categoryIds(db, path);
    let response = await call(db, `${path}/join`, { method: "POST", fields: { displayName: "  ", section: second } });
    assert.equal(response.status, 400);
    assert.ok((await response.text()).includes(`value="${second}"`));
  });

  it("sends a returning member to the board and the category they asked for", async () => {
    let db = await testDatabase();
    let { path, organiserCookie } = await createBoard(db);
    let [, second] = await categoryIds(db, path);
    let response = await call(db, `${path}/join?section=${second}`, { cookie: organiserCookie });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), `${path}?section=${second}`);
  });

  it("is reached with the category already attached when a non-member opens a board or note page", async () => {
    let db = await testDatabase();
    let { path } = await createBoard(db);
    let [, second] = await categoryIds(db, path);
    let board = await call(db, `${path}?section=${second}`);
    assert.equal(board.status, 303);
    assert.equal(board.headers.get("Location"), `${path}/join?section=${second}`);
    let note = await call(db, `${path}/new?category=${second}`);
    assert.equal(note.status, 303);
    assert.equal(note.headers.get("Location"), `${path}/join?section=${second}`);
    // Nothing asked for: nothing attached.
    assert.equal((await call(db, path)).headers.get("Location"), `${path}/join`);
  });
});
