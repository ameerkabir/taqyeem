import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const base = process.env.BROWSER_BASE_URL ?? "http://localhost:5173";
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
});
const output = process.env.BROWSER_OUTPUT ?? "/tmp/taqyeem-category-setup";
await mkdir(output, { recursive: true });
const errors = [],
  checks = [];
const context = await browser.newContext({
    locale: "en-GB",
    viewport: { width: 1440, height: 900 },
  }),
  page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
async function create(title) {
  await page.goto(base + "/boards/new");
  await page.locator("[name=title]").fill(title);
  await page.locator("[name=organiserDisplayName]").fill("Facilitator");
  await page.locator('form[action="/boards/new"] button').click();
  await page.waitForURL(/\/boards\/[a-f0-9-]+$/);
  await page.locator(".category-setup").waitFor();
  return new URL(page.url()).pathname;
}
try {
  let path = await create("Team retrospective");
  await page.screenshot({
    path: output + "/choose-categories-desktop.png",
    fullPage: true,
  });
  assert.equal(await page.locator(".add-note").count(), 0);
  const participantContext = await browser.newContext({ locale: "en-GB" }),
    participant = await participantContext.newPage();
  await participant.goto(base + path + "/join");
  await participant.locator("[name=displayName]").fill("Participant");
  await participant.locator('form[action$="/join"] button').click();
  await participant.locator(".setup-waiting").waitFor();
  assert.equal(await participant.locator(".add-note").count(), 0);
  await page.locator("[name=choice][value=custom]").check();
  await page
    .locator("[name=labels]")
    .fill("Keep doing\nChange\nTry next\nAppreciation");
  await page.locator("[data-appearance=dark]").click();
  await page.locator("[name=locale][value=ar]").click();
  await page.waitForFunction(() => document.documentElement.dir === "rtl");
  assert.equal(
    await page.locator("[name=choice][value=custom]").isChecked(),
    true,
  );
  assert.equal(
    await page.locator("[name=labels]").inputValue(),
    "Keep doing\nChange\nTry next\nAppreciation",
  );
  // Simulate a tab draft from before the empty-board migration, with a category
  // that the custom setup will replace. This seeds browser draft data only.
  let before = await (await page.request.get(base + path + "/session")).json();
  await page.addInitScript(
    ({ prefix, categoryId, submissionId }) => {
      if (sessionStorage.getItem(prefix + "seeded")) {
        return;
      }
      sessionStorage.setItem(prefix + "seeded", "yes");
      sessionStorage.setItem(
        prefix + "note",
        JSON.stringify({
          fields: {
            text: "Retained before category setup",
            categoryId,
            submissionId,
            isAnonymous: true,
          },
        }),
      );
      sessionStorage.setItem(
        prefix + "viewer",
        JSON.stringify({ open: true, category: categoryId }),
      );
    },
    {
      prefix: `taqyeem:${before.board.id}:${before.memberId}:`,
      categoryId: before.categories[0].id,
      submissionId: crypto.randomUUID(),
    },
  );
  await page.reload();
  await page.locator(".workspace[data-enhanced=true]").waitFor();
  assert.equal(await page.locator("dialog[open]").count(), 0);
  assert.equal(
    await page.locator("[name=choice][value=custom]").isChecked(),
    true,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: output + "/custom-categories-phone-arabic.png",
    fullPage: true,
  });
  await page.locator(".category-setup button.primary").click();
  await page.locator('.lane[data-active="true"] .add-note').waitFor();
  let data = await (await page.request.get(base + path + "/session")).json();
  assert.deepEqual(
    data.categories.map((c) => c.label),
    ["Keep doing", "Change", "Try next", "Appreciation"],
  );
  assert.equal(data.state.categorySetup.confirmed, true);
  await participant.locator('.lane[data-active="true"] .add-note').waitFor();
  await page.screenshot({
    path: output + "/empty-collect-phone-arabic.png",
    fullPage: true,
  });
  await page.locator('.lane[data-active="true"] .add-note').click();
  assert.equal(
    await page.locator("dialog textarea").inputValue(),
    "Retained before category setup",
  );
  assert.equal(
    await page.locator("dialog [name=categoryId]").inputValue(),
    data.categories[0].id,
  );
  assert.equal(
    await page.locator("dialog [name=isAnonymous]").isChecked(),
    true,
  );
  await page.locator("dialog textarea").fill("An original thought");
  await page.locator("dialog button.primary").click();
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  assert.equal(
    (await (await page.request.get(base + path + "/session")).json()).cards
      .length,
    1,
  );
  checks.push(
    "Facilitator chooses custom categories before notes; participants wait, then see the real configured board",
    "Custom choice and labels survive appearance/language changes; note posts to the confirmed categories",
    "A pre-setup tab draft stays closed during setup, retains text/anonymity, and recovers a valid custom category",
  );
  await page.locator("[name=locale][value=en]").click();
  await page.waitForFunction(() => document.documentElement.dir === "ltr");
  await page.locator("[data-appearance=light]").click();
  path = await create("Classic retrospective");
  await page.locator(".category-setup button.primary").click();
  await page.locator('.lane[data-active="true"] .add-note').waitFor();
  for (const [width, height] of [
    [375, 812],
    [390, 844],
    [768, 1024],
    [1280, 800],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: output + "/empty-collect-desktop.png",
    fullPage: true,
  });
  assert.equal(await page.locator(".lane").count(), 4);
  assert.equal(await page.locator(".lane .feedback-card").count(), 0);
  assert.equal(await page.locator(".lane .add-note").count(), 4);
  checks.push(
    "Classic categories are explicit; empty Collect has four readable lanes, an Add note control in each lane and no page overflow at five viewports",
  );
  // Native fallback creates and confirms a custom board without JavaScript.
  const nativeContext = await browser.newContext({
      javaScriptEnabled: false,
      locale: "en-GB",
      viewport: { width: 390, height: 844 },
    }),
    native = await nativeContext.newPage();
  await native.goto(base + "/boards/new");
  await native.locator("[name=title]").fill("Native categories");
  await native
    .locator("[name=organiserDisplayName]")
    .fill("Native facilitator");
  await Promise.all([
    native.waitForNavigation(),
    native.locator('form[action="/boards/new"] button').click(),
  ]);
  await native.locator("[name=choice][value=custom]").check();
  await native.locator("[name=labels]").fill("Keep\nKeep");
  await Promise.all([
    native.waitForNavigation(),
    native.locator(".category-setup button.primary").click(),
  ]);
  assert.equal(
    await native.locator("[name=labels]").inputValue(),
    "Keep\nKeep",
  );
  await native.locator("[name=labels]").fill("Keep\nImprove");
  await Promise.all([
    native.waitForNavigation(),
    native.locator("form.command-form button.primary").click(),
  ]);
  assert.equal(await native.locator(".lane .add-note").count(), 2);
  assert.equal(await native.locator(".lane h3").count(), 2);
  checks.push(
    "Custom category setup and editable validation recovery work through native forms with JavaScript disabled",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify({ checks, pageErrors: errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, output }, null, 2));
} catch (error) {
  await page.screenshot({ path: output + "/failure.png", fullPage: true });
  throw error;
} finally {
  await browser.close();
}
