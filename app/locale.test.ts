import { testDatabase } from "./test/dependencies.ts";
import { DEMO_BOARD_ID, DEMO_VIEWER_MEMBER_ID, loginAs, seedDemoBoard } from "./test/seed.ts";
import * as assert from "remix/assert";
import { beforeEach, describe, it } from "remix/test";
import type { Database } from "remix/data-table";
import { createAppRouter } from "./router.ts";
import { routes } from "./routes.ts";
import { serializeLocaleCookie } from "./middleware/locale.ts";

const options = {
  sessionSecret: "test-only-session-secret",
  config: { appEnv: "test" },
  waitUntil() {},
};
const origin = "http://localhost";

async function localeCookie(locale: "ar" | "en") {
  return (await serializeLocaleCookie(locale, false)).split(";")[0];
}

// One database per test, seeded with the demo board, shared by every request in the test
// (like the real app, each request still gets a fresh router). Requests are signed in as the
// demo viewer unless the caller already sends a session, e.g. the one a board creator got.
let db: Database;
beforeEach(async () => {
  db = await testDatabase();
  await seedDemoBoard(db);
});

async function app(headers: Record<string, string>) {
  let router = createAppRouter({ ...options, db });
  if (/(?:^|;\s*)taqyeem_session=/.test(headers.Cookie ?? "")) return { router, headers };
  let viewer = await loginAs(router, DEMO_BOARD_ID, DEMO_VIEWER_MEMBER_ID);
  let cookie = [headers.Cookie, viewer].filter(Boolean).join("; ");
  return { router, headers: { ...headers, Cookie: cookie } };
}

async function get(path: string, headers: Record<string, string> = {}) {
  let { router, headers: withViewer } = await app(headers);
  return router.fetch(new Request(origin + path, { headers: withViewer }));
}

async function post(path: string, fields: Record<string, string>, headers: Record<string, string> = {}) {
  let { router, headers: withViewer } = await app(headers);
  return router.fetch(
    new Request(origin + path, { method: "POST", body: new URLSearchParams(fields), headers: withViewer }),
  );
}

function html(text: string) {
  return {
    lang: text.match(/<html[^>]*\blang="([^"]+)"/)?.[1],
    dir: text.match(/<html[^>]*\bdir="([^"]+)"/)?.[1],
    title: text.match(/<title>([^<]*)<\/title>/)?.[1],
  };
}

describe("document language and direction", () => {
  it("defaults to Arabic RTL", async () => {
    let response = await get("/");
    let page = html(await response.text());
    assert.equal(page.lang, "ar");
    assert.equal(page.dir, "rtl");
    assert.equal(page.title, "تقييم");
    assert.equal(response.headers.get("Content-Language"), "ar");
  });

  it("renders English LTR from Accept-Language, including regional variants", async () => {
    for (let header of ["en", "en-GB", "en-US,en;q=0.9,ar;q=0.5"]) {
      let response = await get("/", { "Accept-Language": header });
      let page = html(await response.text());
      assert.equal(page.lang, "en", header);
      assert.equal(page.dir, "ltr", header);
      assert.equal(page.title, "Taqyeem", header);
      assert.equal(response.headers.get("Content-Language"), "en");
    }
  });

  it("lets a valid cookie beat the browser language, and ignores an invalid cookie", async () => {
    let arabic = html(await (await get("/", { "Accept-Language": "en", Cookie: await localeCookie("ar") })).text());
    assert.equal(arabic.lang, "ar");
    let english = html(await (await get("/", { "Accept-Language": "ar", Cookie: await localeCookie("en") })).text());
    assert.equal(english.lang, "en");
    let forged = html(await (await get("/", { "Accept-Language": "en", Cookie: "taqyeem_lang=fr" })).text());
    assert.equal(forged.lang, "en");
    let garbage = html(await (await get("/", { Cookie: "taqyeem_lang=%%%" })).text());
    assert.equal(garbage.lang, "ar");
  });

  it("localizes titles on the new-board and board pages without translating user content", async () => {
    let headers = { Cookie: await localeCookie("en") };
    let newBoard = html(await (await get("/boards/new", headers)).text());
    assert.equal(newBoard.title, "Create a board · Taqyeem");
    let board = html(await (await get("/boards/demo", headers)).text());
    assert.match(board.title ?? "", /مراجعة السبرنت ١٤/);
    assert.match(board.title ?? "", /Taqyeem/);
  });
});

describe("language switcher", () => {
  it("is a native POST form with both endonyms and marks the current language", async () => {
    let text = await (await get("/boards/demo?section=bad", { Cookie: await localeCookie("en") })).text();
    assert.match(text, /<form[^>]*method="post"[^>]*action="\/locale"/);
    assert.match(text, /name="returnTo" value="\/boards\/demo\?section=bad"/);
    assert.match(text, /<button[^>]*lang="ar"[^>]*>العربية<\/button>/);
    assert.match(text, /<button[^>]*aria-current="true"[^>]*lang="en"[^>]*>English<\/button>|<button[^>]*lang="en"[^>]*aria-current="true"[^>]*>English<\/button>/);
    assert.match(text, /aria-label="Language"/);
  });
});

describe("POST /locale", () => {
  it("sets the cookie and redirects back preserving the query", async () => {
    let response = await post(routes.setLocale.href(), { locale: "en", returnTo: "/boards/demo?section=bad" });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/boards/demo?section=bad");
    let cookie = response.headers.getSetCookie().find((value) => value.startsWith("taqyeem_lang="));
    assert.ok(cookie);
    assert.match(cookie, /Max-Age=31536000/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Path=\//);
    assert.doesNotMatch(cookie, /Secure/i);

    // The next request in that language comes back in English.
    let next = await get("/boards/demo?section=bad", { Cookie: cookie.split(";")[0] });
    assert.equal(html(await next.text()).lang, "en");
  });

  it("marks the cookie Secure over https", async () => {
    let response = await createAppRouter({ ...options, db: await testDatabase() }).fetch(
      new Request("https://taqyeem.example/locale", {
        method: "POST",
        body: new URLSearchParams({ locale: "ar" }),
      }),
    );
    assert.match(response.headers.getSetCookie()[0], /Secure/i);
  });

  it("rejects unsupported locales without setting a cookie", async () => {
    for (let locale of ["fr", "EN", "en-GB", "", "ar,en"]) {
      let response = await post("/locale", { locale, returnTo: "/" });
      assert.equal(response.status, 400, locale);
      assert.deepEqual(response.headers.getSetCookie(), []);
    }
    let missing = await post("/locale", { returnTo: "/" });
    assert.equal(missing.status, 400);
  });

  it("returns a localized error body", async () => {
    let response = await post("/locale", { locale: "fr" }, { Cookie: await localeCookie("en") });
    assert.deepEqual(await response.json(), { error: "This language is not supported" });
  });

  it("falls back to / for open-redirect attempts", async () => {
    for (let returnTo of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", ""]) {
      let response = await post("/locale", { locale: "en", returnTo });
      assert.equal(response.status, 303);
      assert.equal(response.headers.get("Location"), "/", returnTo);
    }
  });

  it("is protected by cross-origin protection, localized", async () => {
    let response = await post("/locale", { locale: "en" }, {
      "Sec-Fetch-Site": "cross-site",
      "Accept-Language": "en",
    });
    assert.equal(response.status, 403);
    assert.equal(await response.text(), "Forbidden: this request came from another site");
    assert.deepEqual(response.headers.getSetCookie(), []);
  });

  it("does not touch the session, membership, or board state", async () => {
    let created = await post("/boards/new", { title: "لوحة", organiserDisplayName: "منى" });
    assert.equal(created.status, 303);
    let sessionCookie = created.headers.getSetCookie().find((c) => c.startsWith("taqyeem_session="))!.split(";")[0];
    let boardPath = created.headers.get("Location")!;

    let switched = await post("/locale", { locale: "en", returnTo: boardPath }, { Cookie: sessionCookie });
    assert.ok(!switched.headers.getSetCookie().some((c) => c.startsWith("taqyeem_session=")));

    let cookies = `${sessionCookie}; ${await localeCookie("en")}`;
    let page = await (await get(boardPath, { Cookie: cookies })).text();
    // Still the organiser, and the page chrome is English.
    assert.match(page, /You are the organiser/);
    assert.match(page, /Manage board/);
  });
});

describe("HTTP caching and Vary", () => {
  it("marks responses as private and varying by language", async () => {
    for (let path of ["/", "/boards/demo", "/boards/demo/cards", "/boards/new"]) {
      let response = await get(path);
      assert.equal(response.headers.get("Cache-Control"), "private, no-cache", path);
      let vary = (response.headers.get("Vary") ?? "").toLowerCase();
      assert.ok(vary.includes("cookie") && vary.includes("accept-language"), path);
    }
  });

  it("applies Content-Language to JSON errors and redirects", async () => {
    let json = await post("/boards/demo/status", { status: "nope" }, { Accept: "application/json", Cookie: await localeCookie("en") });
    assert.equal(json.headers.get("Content-Language"), "en");
    let redirect = await post("/locale", { locale: "en" });
    assert.equal(redirect.headers.get("Content-Language"), "ar");
  });
});

describe("localized errors", () => {
  async function newBoard(headers: Record<string, string> = {}) {
    let response = await post("/boards/new", { title: "Retro", organiserDisplayName: "Sam" }, headers);
    return response.headers.get("Location")!;
  }

  it("localizes membership rejection as JSON in both languages", async () => {
    let boardPath = await newBoard();
    let voteUrl = `${boardPath}/cards/some-card/vote`;
    let ar = await post(voteUrl, { voted: "true" }, { Accept: "application/json" });
    assert.equal(ar.status, 403);
    assert.deepEqual(await ar.json(), { error: "يرجى الانضمام إلى اللوحة" });

    let en = await post(voteUrl, { voted: "true" }, { Accept: "application/json", Cookie: await localeCookie("en") });
    assert.equal(en.status, 403);
    assert.deepEqual(await en.json(), { error: "Please join the board" });
  });

  it("localizes membership rejection as an HTML page with lang and dir", async () => {
    let boardPath = await newBoard();
    let response = await post(`${boardPath}/cards/some-card/vote`, { voted: "true" }, { "Accept-Language": "en-GB" });
    assert.equal(response.status, 403);
    let text = await response.text();
    assert.equal(html(text).lang, "en");
    assert.equal(html(text).dir, "ltr");
    assert.match(text, /Please join the board/);
    assert.match(text, /Couldn.t complete the request/);
  });

  it("localizes missing boards and keeps status codes", async () => {
    let ar = await get("/boards/missing");
    let en = await get("/boards/missing", { "Accept-Language": "en" });
    assert.equal(ar.status, 404);
    assert.equal(en.status, 404);
    assert.equal(await ar.text(), "اللوحة غير موجودة");
    assert.equal(await en.text(), "Board not found");
  });

  it("localizes validation errors and keeps the numeric limit", async () => {
    let tooLong = "x".repeat(121);
    let ar = await post("/boards/new", { title: tooLong, organiserDisplayName: "Sam" });
    let en = await post("/boards/new", { title: tooLong, organiserDisplayName: "Sam" }, { "Accept-Language": "en" });
    assert.equal(ar.status, 400);
    assert.equal(en.status, 400);
    assert.match(await ar.text(), /الحد الأقصى لاسم اللوحة ١٢٠ حرفًا/);
    assert.match(await en.text(), /The board name can be at most 120 characters/);
  });

  it("localizes card-management errors with whole sentences", async () => {
    let en = await get("/boards/demo/cards/missing/edit", { "Accept-Language": "en" });
    assert.match(await en.text(), /Note not found/);
  });
});

describe("board creation and category templates", () => {
  async function createdCategories(headers: Record<string, string>) {
    let created = await post("/boards/new", { title: "Retro", organiserDisplayName: "Sam" }, headers);
    let sessionCookie = created.headers.getSetCookie().find((c) => c.startsWith("taqyeem_session="))!.split(";")[0];
    let boardPath = created.headers.get("Location")!;
    // Read it back in the *other* language to prove labels are stored, not translated.
    return { boardPath, sessionCookie };
  }

  it("stores default labels in the creator's language, unchanged for other viewers", async () => {
    let { boardPath, sessionCookie } = await createdCategories({ Cookie: await localeCookie("en") });
    let asArabic = await (await get(boardPath, { Cookie: `${sessionCookie}; ${await localeCookie("ar")}` })).text();
    assert.match(asArabic, /What went well/);
    assert.match(asArabic, /Ideas/);
    assert.doesNotMatch(asArabic, /ما سار بشكل جيد/);

    let arabicBoard = await createdCategories({});
    let asEnglish = await (await get(arabicBoard.boardPath, { Cookie: `${arabicBoard.sessionCookie}; ${await localeCookie("en")}` })).text();
    assert.match(asEnglish, /ما سار بشكل جيد/);
    assert.doesNotMatch(asEnglish, /What went well/);
  });

  it("previews the templates in the active language", async () => {
    let en = await (await get("/boards/new", { "Accept-Language": "en" })).text();
    assert.match(en, /What went well/);
    let ar = await (await get("/boards/new")).text();
    assert.match(ar, /ما سار بشكل جيد/);
  });

  it("leaves the demo board untouched in English", async () => {
    let text = await (await get("/boards/demo", { Cookie: await localeCookie("en") })).text();
    assert.match(text, /ما سار بشكل جيد/);
    assert.match(text, /Manage board|Sections/);
  });
});

describe("Frames and hydrated text", () => {
  it("renders the cards fragment in the same language as the document", async () => {
    for (let locale of ["ar", "en"] as const) {
      let headers = { Cookie: await localeCookie(locale) };
      let board = await (await get("/boards/demo", headers)).text();
      let cards = await get("/boards/demo/cards?section=good", headers);
      let fragment = await cards.text();
      assert.equal(cards.headers.get("Content-Language"), locale);
      assert.equal(html(board).lang, locale);
      // Zero-vote demo cards: the accessible vote label uses the active locale's plural form.
      let label = locale === "en" ? /aria-label="0 votes"/ : /aria-label="لا أصوات"/;
      assert.match(fragment, label);
      assert.match(fragment, new RegExp(`"locale":"${locale}"`));
    }
  });

  it("passes the locale to hydrated entries and labels votes accessibly", async () => {
    let text = await (await get("/boards/demo/cards?section=good", { "Accept-Language": "en" })).text();
    assert.match(text, /aria-label="\d+ votes?"/);
    assert.match(text, /"locale":"en"/);
  });

  it("renders plural tab text for screen readers", async () => {
    let text = await (await get("/boards/demo", { "Accept-Language": "en" })).text();
    assert.match(text, /\d+ notes?/);
  });
});

describe("card forms in English", () => {
  const en = { "Accept-Language": "en" };

  it("renders the new-note page with localized labels, counter and escaped text", async () => {
    let text = await (await get("/boards/demo/new?category=good", en)).text();
    assert.equal(html(text).lang, "en");
    assert.match(text, /Add a note/);
    assert.match(text, /Choose a section/);
    assert.match(text, /Your note/);
    assert.match(text, /0 \/ 500 characters/);
    assert.match(text, /Post without my name/);
    assert.match(text, /Post note/);
    assert.match(text, /"locale":"en"/);
    // Limits and field names are language-neutral.
    assert.match(text, /maxLength="500"|maxlength="500"/i);
    assert.match(text, /name="categoryId"/);
    assert.match(text, /name="submissionId"/);
  });

  it("renders the Arabic counter with Arabic-Indic digits", async () => {
    let text = await (await get("/boards/demo/new?category=good")).text();
    assert.match(text, /٠ \/ ٥٠٠ حرف/);
  });

  it("renders edit and delete pages in English", async () => {
    let edit = await (await get("/boards/demo/cards/c1/edit", en)).text();
    // The demo viewer may not be allowed to edit while voting is on; either way the chrome is English.
    assert.equal(html(edit).lang, "en");
    let del = await (await get("/boards/demo/cards/c1/delete", en)).text();
    assert.equal(html(del).lang, "en");
    assert.doesNotMatch(del, /إلغاء/);
  });

  it("localizes the rate-limit JSON error without changing the status", async () => {
    // One router for all attempts, so the limit accumulates; signed in as the demo viewer.
    let { router, headers: viewerHeaders } = await app({});
    let status = 0;
    let message = "";
    for (let i = 0; i < 8; i++) {
      let response = await router.fetch(
        new Request(origin + "/boards/demo/new", {
          method: "POST",
          headers: { ...viewerHeaders, Accept: "application/json", "Accept-Language": "en" },
          body: new URLSearchParams({
            submissionId: crypto.randomUUID(),
            text: `note ${i}`,
            categoryId: "good",
          }),
        }),
      );
      if (response.status === 429) {
        status = 429;
        message = ((await response.json()) as { error: string }).error;
        assert.ok(response.headers.get("Retry-After"));
        break;
      }
    }
    assert.equal(status, 429);
    assert.equal(message, "You have posted too many notes. Please wait a moment");
  });
});
