import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { categories } from "../../data/tables.ts";
import { createAppRouter } from "../../router.ts";
import { testDatabase } from "../../test/dependencies.ts";

const options = {
  sessionSecret: "test-only-session-secret",
  config: { appEnv: "test" },
  waitUntil() {},
};

function cookieOf(response: Response) {
  return response.headers.getSetCookie().find((c) => c.startsWith("taqyeem_session="))!.split(";")[0];
}

async function boardWithTwoNotes() {
  let db = await testDatabase();
  let call = (path: string, init: RequestInit & { cookie?: string; fields?: Record<string, string> } = {}) => {
    let { cookie, fields, ...rest } = init;
    let headers = new Headers(rest.headers);
    if (cookie) headers.set("Cookie", cookie);
    return createAppRouter({ ...options, db }).fetch(
      new Request("http://localhost" + path, { ...rest, headers, body: fields ? new URLSearchParams(fields) : undefined }),
    );
  };
  let created = await call("/boards/new", { method: "POST", fields: { title: "Board", organiserDisplayName: "Sam" } });
  let organiser = cookieOf(created);
  let path = created.headers.get("Location")!;
  let participant = cookieOf(await call(`${path}/join`, { method: "POST", fields: { displayName: "Pat" } }));
  let [category] = await db.findMany(categories, { where: { board_id: path.split("/").pop()! } });
  async function note(cookie: string, text: string, isAnonymous: boolean) {
    let response = await call(`${path}/new`, {
      method: "POST",
      cookie,
      fields: { submissionId: crypto.randomUUID(), text, categoryId: category.id, isAnonymous: String(isAnonymous) },
    });
    assert.equal(response.status, 303);
  }
  return { call, path, categoryId: category.id, organiser, participant, note };
}

describe("organiser badge on notes", () => {
  it("marks the organiser's named notes and nobody else's", async () => {
    let w = await boardWithTwoNotes();
    await w.note(w.organiser, "organiser note", false);
    await w.note(w.participant, "participant note", false);
    let html = await (await w.call(`${w.path}/cards?section=${w.categoryId}`, { cookie: w.participant, headers: { "Accept-Language": "en" } })).text();
    // One badge, directly after the organiser's name and never after the participant's.
    assert.equal((html.match(/>Organiser</g) ?? []).length, 1);
    assert.match(html, /Sam(?:<!--[^>]*-->)?\s*<span[^>]*>Organiser<\/span>/);
    assert.doesNotMatch(html, /Pat(?:<!--[^>]*-->)?\s*<span[^>]*>Organiser<\/span>/);
  });

  it("does not reveal the organiser on an anonymous note", async () => {
    let w = await boardWithTwoNotes();
    await w.note(w.organiser, "secret organiser note", true);
    let html = await (await w.call(`${w.path}/cards?section=${w.categoryId}`, { cookie: w.participant, headers: { "Accept-Language": "en" } })).text();
    assert.ok(html.includes("secret organiser note"));
    assert.ok(!html.includes(">Organiser<"));
    assert.ok(!html.includes("Sam"));
  });

  it("is shown in Arabic", async () => {
    let w = await boardWithTwoNotes();
    await w.note(w.organiser, "ملاحظة المنظم", false);
    let html = await (await w.call(`${w.path}/cards?section=${w.categoryId}`, { cookie: w.participant })).text();
    assert.ok(html.includes(">المنظم<"));
  });
});
