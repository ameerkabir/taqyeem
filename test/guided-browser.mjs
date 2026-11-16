// Run against the local Worker after local migrations. No production endpoint is used.
// Set PLAYWRIGHT_MODULE to an already installed Playwright index.mjs if it is not local.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const base = process.env.BROWSER_BASE_URL ?? "http://127.0.0.1:5173";
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
});
const output = process.env.BROWSER_OUTPUT ?? "/tmp/taqyeem-guided-browser";
await mkdir(output, { recursive: true });
const checks = [],
  errors = [];
const ownerContext = await browser.newContext({
  locale: "en-GB",
  viewport: { width: 1280, height: 800 },
});
const memberContext = await browser.newContext({
  locale: "en-GB",
  viewport: { width: 390, height: 844 },
});
const owner = await ownerContext.newPage(),
  member = await memberContext.newPage();
for (const page of [owner, member])
  page.on("pageerror", (e) => errors.push(e.message));
const pause = () => new Promise((r) => setTimeout(r, 400));
async function commandForm(page, kind) {
  return page.locator(
    `form.command-form:has(input[name=kind][value="${kind}"])`,
  );
}
async function clickCommand(page, kind) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let form = await commandForm(page, kind);
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/commands") && r.request().method() === "POST",
    );
    await form.locator("button").first().click();
    let result = await response;
    if (result.status() === 409) {
      await page.waitForTimeout(3000);
      continue;
    }
    assert.equal(result.status(), 200, await result.text());
    await page.waitForFunction(
      () =>
        document.querySelector(".workspace")?.getAttribute("aria-busy") ===
        "false",
    );
    await pause();
    return;
  }
  throw new Error("Could not reconcile command " + kind);
}
async function state(page, path) {
  let r = await page.request.get(base + path + "/session");
  assert.equal(r.status(), 200);
  return r.json();
}
async function api(page, path, kind, fields = {}) {
  let view = await state(page, path);
  let r = await page.request.post(base + path + "/commands", {
    headers: { Accept: "application/json" },
    form: {
      id: crypto.randomUUID(),
      revision: String(view.revision),
      kind,
      ...fields,
    },
  });
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
async function add(page, text, anonymous = false, categoryIndex) {
  await page.locator(".add-note").click();
  await page.locator("dialog[open]").waitFor();
  assert.equal(
    await page.locator("dialog [name=categoryId]").inputValue(),
    await page.locator("[data-view=category]").inputValue(),
  );
  if (categoryIndex !== undefined)
    await page
      .locator("dialog [name=categoryId]")
      .selectOption({ index: categoryIndex });
  await page.locator("dialog textarea").fill(text);
  if (anonymous) await page.locator("dialog input[type=checkbox]").check();
  await page.locator("dialog button.primary").click();
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  await pause();
}
try {
  await owner.goto(base);
  await owner.locator('a[href="/boards/new"]').click();
  await owner.locator("[name=title]").fill("A real browser retrospective");
  await owner.locator("[name=organiserDisplayName]").fill("Facilitator");
  await owner.locator('form[action="/boards/new"] button').click();
  await owner.waitForURL(/\/boards\/[a-f0-9-]+$/);
  let path = new URL(owner.url()).pathname;
  await owner.locator(".category-setup button.primary").click();
  await owner.locator(".add-note").waitFor();
  await pause();
  await member.goto(base + path + "/join");
  await member.locator("[name=displayName]").fill("Participant");
  await member.locator('form[action$="/join"] button').click();
  await member.waitForURL(base + path);
  await pause();
  await add(owner, "First source note", false, 1);
  await add(member, "ملاحظة مجهولة في اجتماع حقيقي", true);
  await add(owner, "Third original source");
  checks.push(
    "Created board, invited distinct member, posted original anonymous and mixed-script evidence through real UI",
  );
  // Stable mounted editor across an unrelated shared command and real polling.
  await member.locator(".add-note").click();
  let field = member.locator("dialog textarea");
  await field.fill("Draft survives updates\nand mobile Enter");
  await field.evaluate((el) => {
    el.dataset.identity = "retained";
    el.focus();
    el.setSelectionRange(6, 14);
  });
  await member.locator("dialog input[type=checkbox]").check();
  await api(owner, path, "ready", { value: "true" });
  await member.waitForTimeout(3200);
  assert.equal(await field.getAttribute("data-identity"), "retained");
  assert.equal(
    await field.inputValue(),
    "Draft survives updates\nand mobile Enter",
  );
  assert.deepEqual(
    await field.evaluate((el) => [el.selectionStart, el.selectionEnd]),
    [6, 14],
  );
  await member
    .locator("dialog button")
    .filter({ hasText: "Close; keep draft" })
    .click();
  await member.locator("[data-appearance=dark]").click();
  await member.locator(".add-note").click();
  assert.equal(
    await field.inputValue(),
    "Draft survives updates\nand mobile Enter",
  );
  assert.equal(
    await member.locator("dialog input[type=checkbox]").isChecked(),
    true,
  );
  await member
    .locator("dialog button")
    .filter({ hasText: "Close; keep draft" })
    .click();
  await member.locator("button[name=locale][value=ar]").click();
  await member.waitForFunction(() => document.documentElement.dir === "rtl");
  await member.locator(".add-note").click();
  assert.equal(
    await field.inputValue(),
    "Draft survives updates\nand mobile Enter",
  );
  assert.equal(await member.locator("html").getAttribute("dir"), "rtl");
  assert.equal(await member.locator("html").getAttribute("data-theme"), "dark");
  await member.screenshot({ path: output + "/arabic-phone-draft.png" });
  await member
    .locator("dialog button")
    .filter({ hasText: "إغلاق مع حفظ المسودة" })
    .click();
  checks.push(
    "Draft text/category/anonymity, node identity and caret survive polling, dismissal, appearance and Arabic navigation",
  );
  // Lost response after a successful server commit; retry must return the original note.
  await owner.route("**/boards/*/new", async (route) => {
    if (route.request().method() === "POST") {
      await route.fetch();
      await route.abort("failed");
      await owner.unroute("**/boards/*/new");
    } else await route.continue();
  });
  await owner.locator(".add-note").click();
  await owner
    .locator("dialog textarea")
    .fill("Saved once despite a lost response");
  await owner.locator("dialog button.primary").click();
  await owner.locator("dialog .error").waitFor();
  assert.equal(
    await owner.locator("dialog textarea").inputValue(),
    "Saved once despite a lost response",
  );
  await owner.locator("dialog button.primary").click();
  await owner.locator("dialog[open]").waitFor({ state: "hidden" });
  assert.equal(
    (await state(owner, path)).cards.filter(
      (c) => c.body === "Saved once despite a lost response",
    ).length,
    1,
  );
  checks.push(
    "Lost-response retry retains fields and commits no duplicate note",
  );
  await owner.screenshot({
    path: output + "/collect-desktop.png",
    fullPage: true,
  });
  await clickCommand(owner, "advance");
  assert.equal((await state(owner, path)).state.stage, "group");
  await owner.locator("input[form][name=notes]").nth(0).check();
  await owner.locator("input[form][name=notes]").nth(1).check();
  let theme = await commandForm(owner, "theme");
  await theme.locator("[name=title]").fill("Theme backed by original notes");
  await theme.locator("button").click();
  await owner.waitForFunction(
    () => document.querySelectorAll(".group-layout .topic-card").length === 1,
  );
  await pause();
  await clickCommand(owner, "advance");
  await member.waitForTimeout(3200);
  let choice = member.locator(".topic-card .command-form button").first();
  await choice.click();
  await pause();
  let visible = await state(owner, path);
  assert.deepEqual(visible.counts, {});
  assert.equal(Object.keys(visible.state.votes).length, 1);
  await clickCommand(owner, "ballot");
  await clickCommand(owner, "advance");
  assert.equal((await state(owner, path)).state.stage, "discuss");
  let live = (await state(owner, path)).state.liveTopic;
  await owner
    .locator(
      `.discussion-subject[data-topic="${live}"] .discussion-topic-header h3`,
    )
    .waitFor({ state: "visible" });
  assert.equal(
    await owner.locator(".discussion-mode").innerText(),
    "Now discussing",
  );
  assert.ok(
    (await owner
      .locator(".discussion-feedback > .note-stack .feedback-card")
      .count()) > 0,
  );
  await member.waitForTimeout(3200);
  await member.locator(".agenda select").selectOption({ index: 1 });
  await pause();
  assert.equal(await member.locator(".discussion-context").count(), 1);
  assert.equal(
    await member.locator(".discussion-context strong").innerText(),
    await owner.locator(".discussion-topic-header h3").innerText(),
  );
  assert.equal((await state(owner, path)).state.liveTopic, live);
  assert.deepEqual((await state(owner, path)).state.outcomes, {});
  checks.push(
    "Grouping preserves evidence, vote aggregates stay hidden, private browsing never changes live topic/outcomes",
  );
  await clickCommand(owner, "outcome");
  let decision = owner.locator("details[data-editor=decision]");
  await decision.locator("summary").click();
  await decision
    .locator("textarea")
    .fill("Keep the current approach; no action required for this decision.");
  await decision.locator("button").click();
  await pause();
  let capture = owner.locator("details[data-editor=action]");
  await capture.locator("summary").click();
  await capture.locator("textarea").fill("Agree the next release checklist");
  await capture.locator("[name=ownerSearch]").fill("Participant");
  await capture.locator("button").click();
  await pause();
  let pending = member.locator("details[data-editor=action]");
  await pending.locator("summary").click();
  await pending.locator("textarea").fill("Unresolved participant suggestion");
  await pending.locator("button").click();
  await pause();
  // Native form requests can race with polling; review/retry remains explicit, without losing text.
  if (await member.locator(".error").count()) {
    await member.waitForTimeout(3000);
    await pending.locator("button").click();
    await pause();
  }
  await owner.waitForTimeout(3000);
  await clickCommand(owner, "advance");
  assert.equal((await state(owner, path)).state.stage, "actions");
  await owner.screenshot({
    path: output + "/actions-desktop.png",
    fullPage: true,
  });
  await clickCommand(owner, "advance");
  let closed = await state(owner, path);
  assert.equal(closed.state.stage, "summary");
  assert.equal(
    closed.state.closure.proposals.some((p) => p.disposition === "suggested"),
    true,
  );
  let history = JSON.stringify(closed.state.closure);
  await api(owner, path, "complete", {
    proposal: closed.state.proposals.find((p) => p.disposition === "agreed").id,
    value: "true",
  });
  assert.equal(
    JSON.stringify((await state(owner, path)).state.closure),
    history,
  );
  checks.push(
    "Explicit outcomes and no-action decision, agreed action and unresolved suggestion survive closure; later progress preserves history",
  );
  for (let width of [375, 390, 768, 1280, 1440]) {
    await owner.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await owner.reload();
    await owner.locator(".meeting-record").waitFor();
    let overflow = await owner.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.equal(overflow, false, `overflow ${width}`);
  }
  await member.waitForTimeout(3200);
  await member.screenshot({
    path: output + "/summary-arabic-phone-dark.png",
    fullPage: true,
  });
  checks.push(
    "Summary bounds checked at all five widths; Arabic/dark phone screenshot captured",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify(
      {
        checks,
        pageErrors: errors,
        limitations: [
          "Chromium emulation only; no physical keyboard, native Arabic review, screen-reader or production release claim",
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks, output }, null, 2));
} catch (error) {
  await owner
    .screenshot({ path: output + "/failure-owner.png", fullPage: true })
    .catch(() => {});
  await member
    .screenshot({ path: output + "/failure-member.png", fullPage: true })
    .catch(() => {});
  console.error("Browser errors", errors);
  throw error;
} finally {
  await browser.close();
}
