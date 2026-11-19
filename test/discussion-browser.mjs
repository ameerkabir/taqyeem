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
const output = process.env.BROWSER_OUTPUT ?? "/tmp/taqyeem-discussion";
await mkdir(output, { recursive: true });
const checks = [],
  errors = [];
let activePage;
try {
  for (const enhanced of [true, false]) {
    const ownerContext = await browser.newContext({
        javaScriptEnabled: enhanced,
        locale: "en-GB",
        viewport: { width: 1440, height: 1000 },
      }),
      owner = await ownerContext.newPage();
    activePage = owner;
    owner.on("pageerror", (error) => errors.push(error.message));
    const created = await owner.request.post(base + "/boards/new", {
      maxRedirects: 0,
      headers: { "Accept-Language": "en" },
      form: {
        title: "A clearer discussion",
        organiserDisplayName: "Facilitator",
      },
    });
    assert.equal(created.status(), 303);
    const path = created.headers().location;
    const read = async () =>
      await (await owner.request.get(base + path + "/session")).json();
    async function api(kind, fields = {}) {
      const v = await read(),
        body = new URLSearchParams({
          id: crypto.randomUUID(),
          revision: String(v.revision),
          kind,
        });
      for (const [key, value] of Object.entries(fields)) {
        for (const item of Array.isArray(value) ? value : [value]) {
          body.append(key, String(item));
        }
      }
      const r = await owner.request.post(base + path + "/commands", {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: body.toString(),
      });
      assert.equal(r.status(), 200, await r.text());
      return r.json();
    }
    async function click(page, locator) {
      if (!enhanced) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "domcontentloaded" }),
          locator.click(),
        ]);
      } else {
        await locator.click();
      }
    }
    async function command(page, kind, within = page) {
      const button = within
        .locator(`form.command-form:has([name=kind][value="${kind}"]) button`)
        .first();
      if (!enhanced) {
        return click(page, button);
      }
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
    async function subject(page, id) {
      await page.locator(`.discussion-subject[data-topic="${id}"]`).waitFor();
      await page
        .locator(".discussion-topic-header h3")
        .waitFor({ state: "visible" });
    }
    async function browse(page, id) {
      const link = page.locator(`.agenda a[href*="?topic=${id}"]`);
      if (await link.isVisible()) {
        await click(page, link);
      } else {
        await page.locator(".agenda select").selectOption(id);
        if (!enhanced) {
          await click(page, page.locator(".agenda [data-view-form] button"));
        }
      }
      await subject(page, id);
    }
    await api("configure", { choice: "classic" });
    const initial = await read(),
      bodies = [
        "Release reviews need a clear owner",
        "Review requests arrive too late",
        "Use a short release checklist",
        "Pairing caught mistakes earlier",
        "Try a smaller weekly release",
      ];
    for (let i = 0; i < bodies.length; i++) {
      assert.equal(
        (
          await owner.request.post(base + path + "/new", {
            maxRedirects: 0,
            form: {
              submissionId: crypto.randomUUID(),
              text: bodies[i],
              categoryId: initial.categories[i % 3].id,
              isAnonymous: String(i === 1),
            },
          })
        ).status(),
        303,
      );
    }
    await api("advance");
    const source = (await read()).cards;
    const themed = await api("theme", {
        title: "Make releases easier to review",
        notes: bodies
          .slice(0, 3)
          .map((body) => source.find((card) => card.body === body).id),
      }),
      theme = themed.state.themes[0];
    await api("advance");
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
    await owner.goto(base + path);
    await command(owner, "ballot");
    await command(owner, "advance");
    await subject(owner, theme.id);
    assert.equal(
      await owner.locator(".discussion-mode").innerText(),
      "Now discussing",
    );
    assert.equal(
      await owner.locator(".discussion-topic-header h3").innerText(),
      theme.title,
    );
    assert.equal(
      await owner.locator(".discussion-subject[data-following=true]").count(),
      1,
    );
    const heading = await owner
      .locator(".discussion-topic-header h3")
      .boundingBox();
    assert.ok(heading && heading.height > 0 && heading.y < 1000);
    assert.equal(
      await owner
        .locator(".discussion-feedback > .note-stack .feedback-card")
        .count(),
      2,
    );
    await owner.locator(".more-notes summary").click();
    assert.equal(
      await owner
        .locator(".discussion-feedback .feedback-card:visible")
        .count(),
      3,
    );
    for (const body of bodies.slice(0, 3)) {
      assert.ok(
        (await owner.locator(".discussion-feedback").innerText()).includes(
          body,
        ),
      );
    }
    await owner.screenshot({
      path:
        output +
        `/discuss-${enhanced ? "enhanced-desktop" : "native-desktop"}.png`,
      fullPage: true,
    });
    const other = source.find((card) => card.body === bodies[3]),
      third = source.find((card) => card.body === bodies[4]);
    await browse(owner, other.id);
    assert.equal(
      await owner.locator(".discussion-context strong").innerText(),
      theme.title,
    );
    assert.equal((await read()).state.liveTopic, theme.id);
    assert.deepEqual((await read()).state.outcomes, {});
    await click(
      owner,
      owner.locator(".discussion-decision .discussion-record-link"),
    );
    const decision = owner.locator("details[data-editor=decision]");
    assert.equal((await decision.getAttribute("open")) !== null, true);
    assert.equal(await decision.locator("[name=topic]").inputValue(), other.id);
    if (enhanced) {
      await decision
        .locator("textarea")
        .fill("Decision draft keeps its intended topic");
      await decision
        .locator("textarea")
        .evaluate((node) => (node.dataset.identity = "decision-kept"));
      await owner.locator(".discussion-actions-heading > a").click();
      const action = owner.locator("details[data-editor=action]");
      assert.equal(await action.locator("[name=topic]").inputValue(), other.id);
      await action
        .locator("textarea")
        .fill("Action draft keeps its intended topic");
      await action
        .locator("textarea")
        .evaluate((node) => (node.dataset.identity = "action-kept"));
      await subject(participant, theme.id);
      await browse(participant, third.id);
      const follower = await participantContext.newPage();
      await follower.goto(base + path);
      await subject(follower, theme.id);
      await command(owner, "live");
      await subject(owner, other.id);
      assert.equal(
        await owner.locator(".discussion-subject[data-following=true]").count(),
        1,
      );
      await subject(follower, other.id);
      await participant.waitForFunction(
        (title) =>
          document.querySelector(".discussion-context strong")?.textContent ===
          title,
        other.body,
      );
      assert.equal(
        await participant
          .locator(".discussion-subject")
          .getAttribute("data-topic"),
        third.id,
      );
      await browse(owner, theme.id);
      await command(owner, "live");
      await subject(follower, theme.id);
      await participant.waitForFunction(
        (title) =>
          document.querySelector(".discussion-context strong")?.textContent ===
          title,
        theme.title,
      );
      assert.deepEqual((await read()).state.outcomes, {});
      assert.deepEqual((await read()).state.decisions, {});
      assert.equal((await read()).state.proposals.length, 0);
      await participant.screenshot({
        path: output + "/discuss-private-phone.png",
        fullPage: true,
      });
      await owner.locator("[name=locale][value=ar]").click();
      await owner.waitForFunction(() => document.documentElement.dir === "rtl");
      await owner.locator("[data-appearance=dark]").click();
      for (const [editor, text, marker] of [
        [decision, "Decision draft keeps its intended topic", "decision-kept"],
        [action, "Action draft keeps its intended topic", "action-kept"],
      ]) {
        assert.equal(await editor.locator("textarea").inputValue(), text);
        assert.equal(
          await editor.locator("textarea").getAttribute("data-identity"),
          marker,
        );
        assert.equal(
          await editor.locator("[name=topic]").inputValue(),
          other.id,
        );
      }
      await participant.locator(".discussion-context > a").click();
      await subject(participant, theme.id);
      assert.equal(await participant.locator(".discussion-context").count(), 0);
      assert.equal(
        await participant.locator("form:has([name=kind][value=live])").count(),
        0,
      );
      assert.equal(
        await participant
          .locator(".discussion-decision .discussion-record-link")
          .count(),
        0,
      );
      await follower.close();
      checks.push(
        "Enhanced discussion appears on stage entry; shared changes reach followers while private reading stays put; live/private labels are explicit; source evidence and both mounted editor drafts keep their topic across shared changes and preferences",
      );
    } else {
      await decision
        .locator("textarea")
        .fill("Decision for the topic I was reading");
      await click(owner, decision.locator("button.primary"));
      assert.equal(
        (await read()).state.decisions[other.id],
        "Decision for the topic I was reading",
      );
      await browse(owner, other.id);
      await click(owner, owner.locator(".discussion-actions-heading > a"));
      const action = owner.locator("details[data-editor=action]");
      assert.equal((await action.getAttribute("open")) !== null, true);
      assert.equal(await action.locator("[name=topic]").inputValue(), other.id);
      await action.locator("textarea").fill("Native action for this topic");
      await click(owner, action.locator("button.primary"));
      assert.equal((await read()).state.proposals[0].topic, other.id);
      await browse(owner, other.id);
      await command(owner, "live");
      assert.equal((await read()).state.liveTopic, other.id);
      assert.equal(
        await owner.locator(".discussion-subject[data-following=true]").count(),
        1,
      );
      await click(owner, owner.locator("[name=locale][value=ar]"));
      await click(owner, owner.locator("[data-appearance=dark]"));
      checks.push(
        "Native forms show the current discussion and full feedback, distinguish private browsing, target decisions/actions to the viewed topic, and return to the shared view after changing it",
      );
    }
    for (const [width, height] of [
      [375, 812],
      [390, 844],
      [768, 1024],
      [1280, 800],
      [1440, 900],
    ]) {
      await owner.setViewportSize({ width, height });
      if (width < 768) {
        const layout = await owner.locator(".discussion-layout").boundingBox(),
          subjectBox = await owner.locator(".discussion-subject").boundingBox(),
          actionsBox = await owner.locator(".discussion-actions").boundingBox();
        assert.ok(
          layout &&
            subjectBox &&
            actionsBox &&
            Math.abs(layout.width - subjectBox.width) < 1 &&
            Math.abs(layout.width - actionsBox.width) < 1,
          `Discussion must use the full phone column at ${width}`,
        );
        assert.ok(
          actionsBox.y >= subjectBox.y + subjectBox.height - 1,
          "Topic actions follow the source feedback on phones",
        );
      }
      assert.equal(
        await owner.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    await owner.setViewportSize({ width: 390, height: 844 });
    await owner.screenshot({
      path:
        output +
        `/discuss-${enhanced ? "enhanced" : "native"}-phone-ar-dark.png`,
      fullPage: true,
    });
    assert.deepEqual((await read()).cards, source);
    await participantContext.close();
    await ownerContext.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify({ checks, pageErrors: errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, output }, null, 2));
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({
      path: output + "/failure.png",
      fullPage: true,
    });
  }
  throw error;
} finally {
  await browser.close();
}
