import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createAppRouter } from "../../router.ts";
import { testDatabase } from "../../test/dependencies.ts";
const options = {
  sessionSecret: "preference-test-secret",
  config: { appEnv: "test" },
  waitUntil() {},
};
describe("appearance preference", () => {
  it("has a native cookie fallback independent of identity, validates values/return paths and preserves theme through locale changes", async () => {
    let db = await testDatabase();
    const request = (path: string, init?: RequestInit) =>
      createAppRouter({ ...options, db }).fetch(
        "http://localhost" + path,
        init,
      );
    let result = await request("/appearance", {
      method: "POST",
      body: new URLSearchParams({
        appearance: "dark",
        returnTo: "https://other.example/",
      }),
    });
    assert.equal(result.status, 303);
    assert.equal(result.headers.get("Location"), "/");
    assert.equal(
      result.headers
        .getSetCookie()
        .some((c) => c.startsWith("taqyeem_session=")),
      false,
    );
    let cookie = result.headers.getSetCookie()[0].split(";")[0];
    assert.equal(cookie, "taqyeem_appearance=dark");
    let page = await request("/", {
        headers: { Cookie: cookie, "Accept-Language": "ar" },
      }),
      html = await page.text();
    assert.ok(html.includes('data-theme="dark"'));
    assert.ok(html.includes('dir="rtl"'));
    let invalid = await request("/appearance", {
      method: "POST",
      body: new URLSearchParams({ appearance: "purple" }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.headers.getSetCookie().length, 0);
    let denied = await request("/appearance", {
      method: "POST",
      headers: { Origin: "https://other.example" },
      body: new URLSearchParams({ appearance: "light" }),
    });
    assert.equal(denied.status, 403);
  });
});
