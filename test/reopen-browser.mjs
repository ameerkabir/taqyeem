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
const output = process.env.BROWSER_OUTPUT ?? "/tmp/taqyeem-reopen";
await mkdir(output, { recursive: true });
const checks = [],
  errors = [];
let active;
try {
  for (const enhanced of [true, false]) {
    const context = await browser.newContext({
        javaScriptEnabled: enhanced,
        locale: "en-GB",
        viewport: { width: 1440, height: 1000 },
      }),
      page = await context.newPage();
    active = page;
    page.on("pageerror", (error) => errors.push(error.message));
    const created = await page.request.post(base + "/boards/new", {
      maxRedirects: 0,
      headers: { "Accept-Language": "en" },
      form: {
        title: "Continue a meeting, keep its history",
        organiserDisplayName: "Facilitator",
      },
    });
    assert.equal(created.status(), 303);
    const path = created.headers().location;
    const read = async () =>
      await (await page.request.get(base + path + "/session")).json();
    async function api(kind, fields = {}) {
      const v = await read(),
        r = await page.request.post(base + path + "/commands", {
          headers: { Accept: "application/json" },
          form: {
            id: crypto.randomUUID(),
            revision: String(v.revision),
            kind,
            ...fields,
          },
        });
      assert.equal(r.status(), 200, await r.text());
      return r.json();
    }
    async function click(client, locator) {
      if (!enhanced)
        await Promise.all([
          client.waitForNavigation({ waitUntil: "domcontentloaded" }),
          locator.click(),
        ]);
      else await locator.click();
    }
    async function command(kind, within = page) {
      const button = within
        .locator(`form.command-form:has([name=kind][value="${kind}"]) button`)
        .first();
      if (!enhanced) return click(page, button);
      const response = page.waitForResponse(
        (r) => r.url().endsWith("/commands") && r.request().method() === "POST",
      );
      await button.click();
      const r = await response;
      assert.equal(r.status(), 200, await r.text());
      await page.waitForFunction(
        () =>
          document.querySelector(".workspace")?.getAttribute("aria-busy") ===
          "false",
      );
    }
    async function current() {
      await click(page, page.locator(".review-banner > a"));
      await page.locator(".workspace[data-review=false]").waitFor();
    }
    async function record(client, version) {
      await client
        .locator(".history-navigation select")
        .selectOption(String(version));
      if (!enhanced)
        await click(client, client.locator(".history-navigation button"));
      await client.waitForURL(
        (url) => url.searchParams.get("record") === String(version),
      );
      await client.locator(".workspace[data-review=true]").waitFor();
    }
    await api("configure", { choice: "classic" });
    const initial = await read();
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await page.request.post(base + path + "/new", {
            maxRedirects: 0,
            form: {
              submissionId: crypto.randomUUID(),
              categoryId: initial.categories[i].id,
              text: i
                ? "Make review ownership explicit"
                : "Pairing made releases safer",
              isAnonymous: String(!i),
            },
          })
        ).status(),
        303,
      );
    await api("advance");
    await api("advance");
    let v = await read();
    const topic = v.cards[0].id,
      second = v.cards[1].id;
    await api("vote", { topic, ballot: String(v.state.ballot), value: "true" });
    await api("ballot", { ballot: String(v.state.ballot), value: "false" });
    await api("advance");
    await api("decision", {
      topic,
      text: "Original agreement: keep paired reviews.",
    });
    await api("propose", {
      topic,
      text: "Original action: document ownership",
      owner: initial.memberId,
    });
    const participantContext = await browser.newContext({
        javaScriptEnabled: enhanced,
        locale: "en-GB",
        viewport: { width: 390, height: 844 },
      }),
      participant = await participantContext.newPage();
    participant.on("pageerror", (error) => errors.push(error.message));
    await participant.goto(base + path + "/join");
    await participant.locator("[name=displayName]").fill("Participant");
    await click(
      participant,
      participant.locator('form[action$="/join"] button'),
    );
    await page.goto(base + path);
    const action = page.locator("details[data-editor=action]"),
      decision = page.locator("details[data-editor=decision]");
    if (enhanced) {
      for (const [editor, text, marker] of [
        [action, "An unfinished action draft", "action-kept"],
        [decision, "An unfinished decision draft", "decision-kept"],
      ]) {
        await editor.locator("summary").click();
        await editor.locator("[name=topic]").selectOption(second);
        await editor.locator("textarea").fill(text);
        await editor
          .locator("textarea")
          .evaluate((node, marker) => (node.dataset.identity = marker), marker);
      }
    }
    const beforeReview = await read();
    for (const step of ["collect", "group", "vote"]) {
      await click(page, page.locator(`.stage-rail a[href="?step=${step}"]`));
      await page.waitForURL((url) => url.searchParams.get("step") === step);
      await page
        .locator(
          `.workspace[data-stage=${step}][data-review=true][data-shared-stage=discuss]`,
        )
        .waitFor();
      assert.equal(await page.locator("form.command-form:visible").count(), 0);
      assert.equal(await page.locator(".add-note").count(), 0);
      assert.equal(
        await page.locator('.feedback-card a[href$="/edit"]').count(),
        0,
      );
      assert.equal((await read()).revision, beforeReview.revision);
      if (step === "collect") {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({
          path:
            output +
            `/review-collect-${enhanced ? "enhanced" : "native"}-phone.png`,
          fullPage: true,
        });
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
      await current();
    }
    assert.equal(
      (
        await page.request.get(base + path + "?step=actions", {
          maxRedirects: 0,
        })
      ).status(),
      303,
    );
    assert.equal(
      await page.locator(".stage-rail li[data-state=upcoming] a").count(),
      0,
    );
    if (enhanced)
      for (const [editor, text, marker] of [
        [action, "An unfinished action draft", "action-kept"],
        [decision, "An unfinished decision draft", "decision-kept"],
      ]) {
        assert.equal(await editor.locator("textarea").inputValue(), text);
        assert.equal(
          await editor.locator("textarea").getAttribute("data-identity"),
          marker,
        );
        assert.equal(await editor.locator("[name=topic]").inputValue(), second);
      }
    await command("advance");
    await command("advance");
    await page.locator(".reopen-meeting").waitFor();
    assert.equal(await page.locator(".capture-editors").isVisible(), false);
    const first = await read(),
      firstRecord = JSON.stringify(first.state.closure);
    assert.equal(first.state.closureVersion, 1);
    assert.equal(first.history.length, 1);
    await participant.goto(base + path);
    assert.equal(await participant.locator(".reopen-meeting").count(), 0);
    await command("complete", page.locator(".current-action-list"));
    assert.equal((await read()).state.proposals[0].completed, true);
    assert.equal(JSON.stringify((await read()).state.closure), firstRecord);
    await record(page, 1);
    assert.equal(await page.locator(".reopen-meeting").count(), 0);
    assert.equal(await page.locator(".current-progress-heading").count(), 0);
    assert.equal(await page.locator("form.command-form:visible").count(), 0);
    await current();
    await command("reopen");
    await page
      .locator(".workspace[data-stage=discuss][data-review=false]")
      .waitFor();
    assert.equal(await page.locator(".capture-editors").isVisible(), true);
    v = await read();
    assert.equal(v.state.closure, null);
    assert.equal(v.state.proposals[0].completed, true);
    assert.deepEqual(v.cards, first.cards);
    assert.deepEqual(v.state.votes, first.state.votes);
    assert.equal(v.history.length, 1);
    if (enhanced)
      for (const [editor, text, marker] of [
        [action, "An unfinished action draft", "action-kept"],
        [decision, "An unfinished decision draft", "decision-kept"],
      ]) {
        assert.equal(await editor.locator("textarea").inputValue(), text);
        assert.equal(
          await editor.locator("textarea").getAttribute("data-identity"),
          marker,
        );
        assert.equal(await editor.locator("[name=topic]").inputValue(), second);
      }
    await api("decision", {
      topic,
      text: "Revised agreement: keep pairing and a smaller checklist.",
    });
    await api("edit-proposal", {
      proposal: v.state.proposals[0].id,
      text: "Revised action: publish the review checklist",
      owner: initial.memberId,
      due: "",
    });
    if (enhanced)
      await page.waitForFunction(
        (revision) =>
          Number(
            document.querySelector(".stage-heading input[name=revision]")
              ?.value,
          ) >= revision,
        (await read()).revision,
      );
    else await page.reload();
    await command("advance");
    await command("advance");
    const secondClose = await read();
    assert.equal(secondClose.state.closureVersion, 2);
    assert.equal(secondClose.history.length, 2);
    assert.equal(
      secondClose.state.closure.decisions[topic],
      "Revised agreement: keep pairing and a smaller checklist.",
    );
    await page.screenshot({
      path:
        output +
        `/meeting-version-two-${enhanced ? "enhanced" : "native"}-desktop.png`,
      fullPage: true,
    });
    await record(page, 1);
    assert.ok(
      (await page.locator(".summary-decision").first().innerText()).includes(
        "Original agreement",
      ),
    );
    await page.locator(".summary-agreement summary").click();
    assert.ok(
      (await page.locator(".historical-actions").innerText()).includes(
        "Original action",
      ),
    );
    assert.ok(
      !(await page.locator(".historical-actions").innerText()).includes(
        "Revised action",
      ),
    );
    assert.equal(await page.locator("form.command-form:visible").count(), 0);
    await record(participant, 1);
    await participant.locator(".evidence summary").first().click();
    const footer = await participant
      .locator(".evidence .feedback-card footer")
      .first()
      .innerText();
    assert.ok(footer.includes("Anonymous"));
    assert.ok(!footer.includes("Facilitator"));
    assert.ok(!footer.includes("Yours"));
    await click(page, page.locator("[name=locale][value=ar]"));
    await page.waitForFunction(() => document.documentElement.dir === "rtl");
    await click(page, page.locator("[data-appearance=dark]"));
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
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
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path:
        output +
        `/saved-version-one-${enhanced ? "enhanced" : "native"}-phone-ar-dark.png`,
      fullPage: true,
    });
    await current();
    await command("reopen");
    assert.equal((await read()).state.stage, "discuss");
    const participantBefore = await participant
      .locator(".summary-decision")
      .first()
      .innerText();
    if (enhanced)
      await participant.waitForFunction(
        () =>
          document
            .querySelector(".workspace")
            ?.getAttribute("data-shared-stage") === "discuss",
      );
    else await participant.reload();
    assert.equal(
      await participant.locator(".summary-decision").first().innerText(),
      participantBefore,
    );
    const fresh = await browser.newContext({
        javaScriptEnabled: enhanced,
        storageState: await context.storageState(),
      }),
      freshPage = await fresh.newPage();
    await freshPage.goto(base + path + "?record=1");
    assert.ok(
      (
        await freshPage.locator(".summary-decision").first().innerText()
      ).includes("Original agreement"),
    );
    assert.equal(
      await freshPage.locator(".current-progress-heading").count(),
      0,
    );
    await fresh.close();
    checks.push(
      `${enhanced ? "Enhanced" : "Native"}: past-step GET reviews do not mutate or expose editing; future steps stay disabled; only the facilitator reopens; current progress and evidence survive; two closures remain distinct/read-only after another reopen and a fresh browser context; anonymous authors stay redacted; dated history fits five widths`,
    );
    await participantContext.close();
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify({ checks, pageErrors: errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, output }, null, 2));
} catch (error) {
  if (active && !active.isClosed())
    await active.screenshot({ path: output + "/failure.png", fullPage: true });
  throw error;
} finally {
  await browser.close();
}
