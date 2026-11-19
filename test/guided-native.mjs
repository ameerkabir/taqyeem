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
const context = await browser.newContext({
    javaScriptEnabled: false,
    locale: "en-GB",
    viewport: { width: 390, height: 844 },
  }),
  page = await context.newPage();
async function nativeClick(locator) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    locator.click(),
  ]);
}
try {
  await page.goto(base + "/boards/new");
  await page.locator("[name=title]").fill("Native form journey");
  await page.locator("[name=organiserDisplayName]").fill("Native owner");
  await nativeClick(page.locator('form[action="/boards/new"] button'));
  await nativeClick(page.locator(".category-setup button.primary"));
  let path = new URL(page.url()).pathname;
  const read = async () =>
    await (await page.request.get(base + path + "/session")).json();
  await nativeClick(page.locator('.lane[data-active="true"] .add-note'));
  await page
    .locator("textarea[name=text]")
    .fill("A native note\nwithout JavaScript");
  await nativeClick(page.locator('form[action$="/new"] button'));
  assert.equal((await read()).cards.length, 1);
  let category = (await read()).categories[1].id;
  await page.locator("[data-view=category]").selectOption(category);
  await nativeClick(page.locator("[data-view-form] button"));
  assert.equal(new URL(page.url()).searchParams.get("category"), category);
  assert.equal(await page.locator(".lane[data-active=true]").count(), 1);
  const command = (kind) =>
    page
      .locator(
        `form.command-form:has(input[name=kind][value="${kind}"]) button`,
      )
      .first();
  await nativeClick(command("advance"));
  await nativeClick(command("advance"));
  assert.equal((await read()).state.stage, "vote");
  await nativeClick(command("vote"));
  assert.equal((await read()).state.votes[(await read()).memberId].length, 1);
  await nativeClick(command("ballot"));
  await nativeClick(command("advance"));
  await nativeClick(command("outcome"));
  let decision = page.locator("details[data-editor=decision]");
  await decision.locator("summary").click();
  await decision
    .locator("textarea")
    .fill("A decision posted through a native form");
  await nativeClick(decision.locator("button"));
  let action = page.locator("details[data-editor=action]");
  await action.locator("summary").click();
  await action.locator("textarea").fill("Native agreed action");
  await nativeClick(action.locator("button"));
  await nativeClick(command("advance"));
  await nativeClick(command("advance"));
  let record = (await read()).state.closure;
  assert.equal(record.cards.length, 1);
  assert.equal(record.proposals.length, 1);
  assert.equal(
    Object.values(record.decisions)[0],
    "A decision posted through a native form",
  );
  await nativeClick(page.locator("button[name=appearance][value=dark]"));
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await nativeClick(page.locator("button[name=locale][value=ar]"));
  assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  assert.ok(
    (await page.locator("body").innerText()).includes("Native agreed action"),
  );
  console.log(
    "Native phone journey passed: create, post, category navigation, vote, discussion, decision, action, closure and independent appearance/language with JavaScript disabled.",
  );
} finally {
  await browser.close();
}
