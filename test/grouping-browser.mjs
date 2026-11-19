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
const output = process.env.BROWSER_OUTPUT ?? "/tmp/taqyeem-grouping";
await mkdir(output, { recursive: true });
const checks = [],
  errors = [];
try {
  for (const enhanced of [true, false]) {
    const context = await browser.newContext({
        javaScriptEnabled: enhanced,
        locale: "en-GB",
        viewport: enhanced
          ? { width: 1280, height: 900 }
          : { width: 390, height: 844 },
      }),
      page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    async function click(locator) {
      if (!enhanced)
        await Promise.all([
          page.waitForNavigation({ waitUntil: "domcontentloaded" }),
          locator.click(),
        ]);
      else await locator.click();
    }
    async function commandClick(locator, expectedStatus = 200) {
      if (!enhanced) return click(locator);
      const response = page.waitForResponse(
        (r) => r.url().endsWith("/commands") && r.request().method() === "POST",
      );
      await locator.click();
      let result = await response;
      assert.equal(result.status(), expectedStatus, await result.text());
      await page.waitForFunction(
        () =>
          document.querySelector(".workspace")?.getAttribute("aria-busy") ===
          "false",
      );
    }
    await page.goto(base + "/boards/new");
    await page
      .locator("[name=title]")
      .fill(enhanced ? "Grouping browser checks" : "Native grouping checks");
    await page.locator("[name=organiserDisplayName]").fill("Facilitator");
    await click(page.locator('form[action="/boards/new"] button'));
    await page.locator(".category-setup").waitFor();
    await commandClick(page.locator(".category-setup button.primary"));
    await page.locator(".add-note").waitFor();
    const path = new URL(page.url()).pathname;
    const read = async () =>
      await (await page.request.get(base + path + "/session")).json();
    for (let i = 0; i < 4; i++) {
      await click(page.locator(".add-note"));
      const form = enhanced
        ? page.locator("dialog form")
        : page.locator('form[action$="/new"]');
      await form.locator("[name=text]").fill(`Original evidence ${i}`);
      await click(form.locator("button.primary,button[type=submit]").first());
      if (enhanced)
        await page.locator("dialog[open]").waitFor({ state: "hidden" });
    }
    const source = (await read()).cards;
    await commandClick(
      page.locator("form.command-form:has([name=kind][value=advance]) button"),
    );
    await page.locator(".group-layout").waitFor();
    const create = () =>
      page.locator("form.command-form:has([name=kind][value=theme])");
    const themeCard = (id) =>
      page.locator(`article.topic-card:has(button[name=theme][value="${id}"])`);
    const select = async (i) =>
      page
        .locator(
          `.note-grid input[name=notes][value="${source.find((c) => c.body === `Original evidence ${i}`).id}"]`,
        )
        .check();
    await select(0);
    await create().locator("[name=title]").fill("Delivery");
    await commandClick(create().locator("button"));
    await page.locator("article.topic-card").waitFor();
    const delivery = (await read()).state.themes[0];
    await select(1);
    await create().locator("[name=title]").fill(" DELIVERY ");
    await commandClick(create().locator("button"), 400);
    await page
      .locator("[role=alert]")
      .filter({ hasText: "A theme with this name already exists" })
      .first()
      .waitFor();
    assert.equal((await read()).state.themes.length, 1);
    if (enhanced) {
      assert.equal(
        await page
          .locator(
            `input[name=notes][value="${source.find((c) => c.body === "Original evidence 1").id}"]`,
          )
          .isChecked(),
        true,
      );
      assert.equal(
        await create().locator("[name=title]").inputValue(),
        " DELIVERY ",
      );
      await create().locator("[name=title]").fill("Quality");
      await commandClick(create().locator("button"));
    } else {
      const retry = page.locator("form.command-form");
      assert.equal(
        await retry.locator("[name=title]").inputValue(),
        " DELIVERY ",
      );
      await retry.locator("[name=title]").fill("Quality");
      await click(retry.locator("button.primary"));
    }
    assert.equal((await read()).state.themes.length, 2);
    // A blank new-theme title must not prevent submitting an existing-theme action.
    assert.equal(await create().locator("[name=title]").inputValue(), "");
    await select(2);
    await commandClick(themeCard(delivery.id).locator("button[name=theme]"));
    let state = await read();
    assert.equal(
      state.state.themes.find((t) => t.id === delivery.id).notes.length,
      2,
    );
    assert.equal(
      state.state.themes.find((t) => t.id === delivery.id).title,
      "Delivery",
    );
    await select(3);
    await create().locator("[name=title]").fill("A future theme draft");
    await commandClick(themeCard(delivery.id).locator("button[name=theme]"));
    if (enhanced)
      assert.equal(
        await create().locator("[name=title]").inputValue(),
        "A future theme draft",
      );
    state = await read();
    assert.equal(
      state.state.themes.find((t) => t.id === delivery.id).notes.length,
      3,
    );
    assert.deepEqual(state.cards, source);
    assert.equal(new Set(state.state.themes.flatMap((t) => t.notes)).size, 4);
    let quality = state.state.themes.find((t) => t.title === "Quality");
    const rename = () =>
      themeCard(quality.id).locator("form:has([name=kind][value=rename])");
    await rename().locator("[name=title]").fill("delivery");
    await commandClick(rename().locator("button"), 400);
    await page
      .locator("[role=alert]")
      .filter({ hasText: "A theme with this name already exists" })
      .first()
      .waitFor();
    if (enhanced) {
      await rename().locator("[name=title]").fill("Architecture");
      await commandClick(rename().locator("button"));
    } else {
      await page.locator("form.command-form [name=title]").fill("Architecture");
      await click(page.locator("form.command-form button.primary"));
    }
    state = await read();
    assert.deepEqual(
      state.state.themes.map((t) => t.title),
      ["Delivery", "Architecture"],
    );
    await click(page.locator("[name=locale][value=ar]"));
    await page.waitForFunction(() => document.documentElement.dir === "rtl");
    await click(page.locator("[data-appearance=dark]"));
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    if (enhanced)
      await page.waitForFunction(
        () =>
          document.querySelector(".workspace")?.getAttribute("aria-busy") ===
          "false",
      );
    await themeCard(delivery.id).locator("details.evidence > summary").click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path:
        output +
        `/group-${enhanced ? "enhanced-desktop" : "native-phone"}-ar-dark.png`,
      fullPage: true,
    });
    if (enhanced) {
      const participantContext = await browser.newContext({ locale: "en-GB" }),
        participant = await participantContext.newPage();
      participant.on("pageerror", (error) => errors.push(error.message));
      await participant.goto(base + path + "/join");
      await participant.locator("[name=displayName]").fill("Participant");
      await participant.locator('form[action$="/join"] button').click();
      await participant.locator(".group-layout").waitFor();
      assert.equal(await participant.locator("button[name=theme]").count(), 0);
      assert.equal(await participant.locator("input[name=notes]").count(), 0);
      await participantContext.close();
      // Membership changes advance the shared revision; wait for the normal poll.
      await page.waitForFunction(
        (revision) =>
          Number(
            document.querySelector(".group-layout input[name=revision]")?.value,
          ) >= revision,
        (await read()).revision,
      );
    }
    await commandClick(
      page.locator("form.command-form:has([name=kind][value=advance]) button"),
    );
    assert.equal((await read()).state.stage, "vote");
    checks.push(
      `${enhanced ? "Enhanced desktop" : "Native phone"}: create and rename reject duplicate names with retained fields; selected notes append to an existing stable theme with a blank new title; all source evidence survives; Arabic/dark layout fits`,
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify({ checks, pageErrors: errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, output }, null, 2));
} finally {
  await browser.close();
}
