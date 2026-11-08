import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createAppRouter } from "../router.ts";
import { routes } from "../routes.ts";
import { testDatabase } from "../test/dependencies.ts";

const options = {
  sessionSecret: "test-only-session-secret",
  config: { appEnv: "test" },
  waitUntil() {},
};

async function request(path: string, init: RequestInit = {}) {
  return createAppRouter({ ...options, db: await testDatabase() }).fetch(
    new Request("http://localhost" + path, init),
  );
}

const missing = () => `/boards/${crypto.randomUUID()}`;

describe("board not found page", () => {
  it("shows a page with a way forward, not bare text", async () => {
    let response = await request(missing(), { headers: { "Accept-Language": "en" } });
    assert.equal(response.status, 404);
    assert.match(response.headers.get("Content-Type") ?? "", /text\/html/);
    let html = await response.text();
    assert.match(html, /<html[\s>]/);
    assert.ok(html.includes("Board not found"));
    assert.ok(html.includes("may have been removed"));
    // The primary action starts a new board; the secondary goes home.
    assert.ok(html.includes(`href="${routes.newBoard.index.href()}"`));
    assert.ok(html.includes("Create a new board"));
    assert.ok(html.includes(`href="${routes.home.href()}"`));
  });

  it("is in Arabic and right-to-left by default", async () => {
    let html = await (await request(missing())).text();
    assert.match(html, /<html[^>]*\blang="ar"/);
    assert.match(html, /<html[^>]*\bdir="rtl"/);
    assert.ok(html.includes("اللوحة غير موجودة"));
    assert.ok(html.includes("إنشاء لوحة جديدة"));
  });

  it("is used for the join page too, on both GET and POST", async () => {
    let path = `${missing()}/join`;
    let get = await request(path);
    assert.equal(get.status, 404);
    assert.ok((await get.text()).includes(`href="${routes.newBoard.index.href()}"`));
    let post = await request(path, { method: "POST", body: new URLSearchParams({ displayName: "Pat" }) });
    assert.equal(post.status, 404);
    assert.ok((await post.text()).includes(`href="${routes.newBoard.index.href()}"`));
  });

  it("offers no form and no hint about whether other boards exist", async () => {
    let html = await (await request(missing(), { headers: { "Accept-Language": "en" } })).text();
    // The language switcher is a form on every page; nothing else may be one.
    let forms = html.match(/<form[^>]*>/g) ?? [];
    assert.ok(forms.every((form) => form.includes(`action="${routes.setLocale.href()}"`)), forms.join(" "));
    assert.ok(!html.includes('name="displayName"'));
    assert.ok(!html.includes("/join"));
  });

  it("still answers JSON clients with JSON", async () => {
    let response = await request(missing(), { headers: { Accept: "application/json", "Accept-Language": "en" } });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Board not found" });
  });

  it("keeps the plain 404 for the cards fragment, which is embedded in another page", async () => {
    let response = await request(`${missing()}/cards`, { headers: { "Accept-Language": "en" } });
    assert.equal(response.status, 404);
    assert.equal(await response.text(), "Board not found");
  });
});
