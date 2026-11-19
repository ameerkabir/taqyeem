import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const base = process.env.BROWSER_BASE_URL ?? "http://127.0.0.1:5173";
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
});
const context = await browser.newContext({ locale: "en-GB" }),
  page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const wait = () => page.waitForTimeout(500);
try {
  await page.goto(base + "/boards/new");
  await page.locator("[name=title]").fill("Editor lifecycle checks");
  await page.locator("[name=organiserDisplayName]").fill("Owner");
  await page.locator('form[action="/boards/new"] button').click();
  await page.waitForURL(/\/boards\/[a-f0-9-]+$/);
  await page.locator(".category-setup button.primary").click();
  let path = new URL(page.url()).pathname;
  await page.locator(".workspace[data-enhanced=true]").waitFor();
  // Standalone editor retains the submission key and fields across a real language navigation.
  await page.goto(base + path + "/new");
  await page.locator("textarea").fill("Standalone draft\nwith newline");
  await page.locator("input[name=isAnonymous]").check();
  let submission = await page.locator("[name=submissionId]").inputValue();
  await page.locator("button[name=locale][value=ar]").click();
  await page.waitForFunction(() => document.documentElement.dir === "rtl");
  await wait();
  assert.equal(
    await page.locator("textarea").inputValue(),
    "Standalone draft\nwith newline",
  );
  assert.equal(await page.locator("input[name=isAnonymous]").isChecked(), true);
  assert.equal(
    await page.locator("[name=submissionId]").inputValue(),
    submission,
  );
  await page.locator('form[action$="/new"] button').click();
  await page.waitForURL(base + path + "?section=*");
  await wait();
  let state = await (await page.request.get(base + path + "/session")).json(),
    card = state.cards[0];
  await page.goto(base + path + "/cards/" + card.id + "/edit");
  await page.locator("textarea").fill("Owned draft after a preference change");
  await page.locator("button[name=locale][value=en]").click();
  await page.waitForFunction(() => document.documentElement.dir === "ltr");
  await wait();
  assert.equal(
    await page.locator("textarea").inputValue(),
    "Owned draft after a preference change",
  );
  await page.locator('form[action$="/edit"] button[type=submit]').click();
  await page.waitForURL(base + path + "?section=*");
  await wait();
  // Typing after dispatch belongs to the next draft; success cannot erase it.
  let release;
  const gate = new Promise((r) => (release = r));
  let posted;
  const dispatched = new Promise((r) => (posted = r));
  await page.route("**/boards/*/new", async (route) => {
    if (route.request().method() === "POST") {
      posted();
      await gate;
      await route.continue();
    } else {
      await route.continue();
    }
  });
  await page.locator('.lane[data-active="true"] .add-note').click();
  await page.locator("dialog textarea").fill("The submitted snapshot");
  await page.locator("dialog button.primary").click();
  await dispatched;
  await page.locator("dialog textarea").fill("New typing while saving");
  release();
  await page.waitForTimeout(1800);
  assert.equal(
    await page.locator("dialog[open] textarea").inputValue(),
    "New typing while saving",
  );
  state = await (await page.request.get(base + path + "/session")).json();
  assert.equal(
    state.cards.filter((c) => c.body === "The submitted snapshot").length,
    1,
  );
  assert.equal(
    state.cards.filter((c) => c.body === "New typing while saving").length,
    0,
  );
  // A facilitator progression while writing keeps the actual mounted editor and rejects posting.
  let before = await page.locator("dialog textarea").evaluate((el) => {
    el.dataset.identity = "kept";
    return el.value;
  });
  let v = state;
  let r = await page.request.post(base + path + "/commands", {
    headers: { Accept: "application/json" },
    form: {
      id: crypto.randomUUID(),
      revision: String(v.revision),
      kind: "advance",
    },
  });
  assert.equal(r.status(), 200);
  await page.waitForTimeout(3200);
  assert.equal(
    await page.locator("dialog[open] textarea").inputValue(),
    before,
  );
  assert.equal(
    await page.locator("dialog textarea").getAttribute("data-identity"),
    "kept",
  );
  assert.equal(await page.locator("dialog button.primary").isDisabled(), true);

  await page.locator("dialog .control-row button").first().click();
  let other = await page.request.post(base + "/boards/new", {
    maxRedirects: 0,
    form: {
      title: "Another independent board",
      organiserDisplayName: "Second board owner",
    },
  });
  assert.equal(other.status(), 303);
  let otherPath = other.headers().location;
  async function navigateLink(target, title) {
    await page.evaluate((href) => {
      let a = document.createElement("a");
      a.id = "test-navigation";
      a.href = href;
      a.textContent = "Navigate board";
      document.body.append(a);
    }, target);
    await page.locator("#test-navigation").click();
    await page.waitForURL(base + target);
    await page
      .waitForFunction(
        (expected) =>
          document.querySelector(".board-heading h1")?.textContent === expected,
        title,
        { timeout: 5000 },
      )
      .catch(async (error) => {
        console.log(
          "Navigation diagnostic",
          page.url(),
          await page.title(),
          await page.locator(".board-heading h1").allTextContents(),
          await page.locator("main").count(),
        );
        throw error;
      });
    await page.locator(".workspace[data-enhanced=true]").waitFor();
  }
  await navigateLink(otherPath, "Another independent board");
  assert.equal(
    await page.locator(".board-heading h1").innerText(),
    "Another independent board",
  );
  await page.locator(".category-setup button.primary").click();
  await page.locator('.lane[data-active="true"] .add-note').click();
  assert.equal(await page.locator("dialog textarea").inputValue(), "");
  await page.locator("dialog .control-row button").first().click();
  await navigateLink(path, "Editor lifecycle checks");
  assert.equal(
    await page.locator(".board-heading h1").innerText(),
    "Editor lifecycle checks",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Editor lifecycle passed: standalone and owned drafts across locale navigation, stable submission identity, new typing during slow save, and mounted editor across stage change.",
  );
} catch (error) {
  console.error("Browser errors", errors);
  await page.screenshot({ path: "/tmp/38-editor-failure.png", fullPage: true });
  throw error;
} finally {
  await browser.close();
}
