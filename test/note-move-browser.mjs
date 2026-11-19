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
const output = process.env.BROWSER_OUTPUT ?? "/tmp/taqyeem-note-move";
await mkdir(output, { recursive: true });
const checks = [],
  errors = [];
let active;
try {
  for (const enhanced of [true, false]) {
    const context = await browser.newContext({
      javaScriptEnabled: enhanced,
      locale: "en-GB",
      viewport: { width: enhanced ? 1440 : 390, height: 1000 },
    });
    const owner = await context.newPage();
    active = owner;
    owner.on("pageerror", (error) => errors.push(error.message));
    const created = await owner.request.post(base + "/boards/new", {
      maxRedirects: 0,
      form: {
        title: "Move feedback, preserve its author",
        organiserDisplayName: "Facilitator",
      },
    });
    assert.equal(created.status(), 303);
    const path = created.headers().location;
    const read = async (client = owner) =>
      await (await client.request.get(base + path + "/session")).json();
    const api = async (kind, fields = {}, client = owner) => {
      const v = await read(client);
      return client.request.post(base + path + "/commands", {
        headers: { Accept: "application/json" },
        form: {
          id: crypto.randomUUID(),
          revision: String(v.revision),
          kind,
          ...fields,
        },
      });
    };
    assert.equal((await api("configure", { choice: "classic" })).status(), 200);
    const initial = await read(),
      [green, peach, cyan] = initial.categories;
    const participantContext = await browser.newContext({
      javaScriptEnabled: enhanced,
      locale: "en-GB",
      viewport: { width: 390, height: 844 },
    });
    const participant = await participantContext.newPage();
    participant.on("pageerror", (error) => errors.push(error.message));
    assert.equal(
      (
        await participant.request.post(base + path + "/join", {
          maxRedirects: 0,
          form: { displayName: "Participant" },
        })
      ).status(),
      303,
    );
    for (const [client, text, anonymous] of [
      [owner, "Keep the original release checklist", false],
      [
        participant,
        "ملاحظة مجهولة — improve the handoff without losing the source",
        true,
      ],
      [participant, "Participant-owned public feedback", false],
    ]) {
      assert.equal(
        (
          await client.request.post(base + path + "/new", {
            maxRedirects: 0,
            form: {
              submissionId: crypto.randomUUID(),
              text,
              categoryId: green.id,
              isAnonymous: String(anonymous),
            },
          })
        ).status(),
        303,
      );
    }
    const original = await read(participant),
      anonymous = original.cards.find((card) => card.isAnonymous),
      publicNote = original.cards.find((card) =>
        card.body.startsWith("Participant-owned"),
      );
    const card = (client = owner) =>
      client.locator(`.feedback-card[data-card-id="${anonymous.id}"]`);
    await owner.goto(base + path);
    await participant.goto(base + path);
    if (enhanced) {
      await owner.locator(".workspace[data-enhanced=true]").waitFor();
    }
    assert.equal(
      await participant
        .locator('.feedback-card[draggable="true"],.note-move')
        .count(),
      0,
    );
    for (const note of [anonymous, publicNote]) {
      assert.equal(
        (
          await api(
            "move-note",
            { card: note.id, fromCategory: green.id, categoryId: peach.id },
            participant,
          )
        ).status(),
        403,
      );
    }
    async function click(locator) {
      if (!enhanced) {
        await Promise.all([
          owner.waitForNavigation({ waitUntil: "domcontentloaded" }),
          locator.click(),
        ]);
      } else {
        await locator.click();
      }
    }
    async function movePicker(categoryId) {
      const details = card().locator(".note-move");
      if ((await details.getAttribute("open")) === null) {
        await details.locator("summary").click();
      }
      await details.locator("select").selectOption(categoryId);
      if (enhanced) {
        const response = owner.waitForResponse(
          (r) =>
            r.url().endsWith("/commands") && r.request().method() === "POST",
        );
        await details.locator("button").click();
        assert.equal((await response).status(), 200);
        await owner.locator('.workspace[aria-busy="false"]').waitFor();
      } else {
        await click(details.locator("button"));
      }
    }
    async function assertCategory(categoryId, tone, color) {
      assert.equal(
        (await read()).cards.find((c) => c.id === anonymous.id).categoryId,
        categoryId,
      );
      await card()
        .locator("xpath=ancestor::section[contains(@class,'lane')]")
        .getAttribute("data-category-id")
        .then((value) => assert.equal(value, categoryId));
      assert.equal(await card().getAttribute("data-tone"), String(tone));
      assert.equal(
        await card().evaluate((node) => getComputedStyle(node).backgroundColor),
        color,
      );
      const saved = (await read(participant)).cards.find(
        (c) => c.id === anonymous.id,
      );
      assert.deepEqual(
        { ...saved, categoryId: anonymous.categoryId },
        anonymous,
      );
      assert.equal(
        (await read()).cards.find((c) => c.id === anonymous.id).memberId,
        "",
      );
    }
    if (enhanced) {
      await owner.locator(".add-note").click();
      const draft = owner.locator("dialog textarea");
      await draft.fill("My draft survives category moves — مسودة محفوظة");
      await draft.evaluate((node) => (node.dataset.identity = "retained-note"));
      await owner
        .getByRole("button", { name: "Close; keep draft", exact: true })
        .click();
      const beforeCancel = await read(),
        sourceBox = await card().boundingBox(),
        targetBox = await owner
          .locator(`.lane[data-category-id="${peach.id}"] h3`)
          .boundingBox();
      await owner.mouse.move(sourceBox.x + 30, sourceBox.y + 30);
      await owner.mouse.down();
      await owner.mouse.move(targetBox.x + 30, targetBox.y + 10, { steps: 10 });
      await owner.keyboard.press("Escape");
      await owner.mouse.up();
      assert.equal((await read()).revision, beforeCancel.revision);
      assert.equal(
        await owner
          .locator('[data-dragging="true"],[data-drop-target="true"]')
          .count(),
        0,
      );
      const response = owner.waitForResponse(
        (r) => r.url().endsWith("/commands") && r.request().method() === "POST",
      );
      await card().dragTo(
        owner.locator(`.lane[data-category-id="${peach.id}"] h3`),
      );
      assert.equal((await response).status(), 200);
      await owner.locator('.workspace[aria-busy="false"]').waitFor();
      assert.equal(
        await draft.inputValue(),
        "My draft survives category moves — مسودة محفوظة",
      );
      assert.equal(await draft.getAttribute("data-identity"), "retained-note");
      await participant.waitForFunction(
        ({ id, destination }) =>
          document
            .querySelector(`.feedback-card[data-card-id="${id}"]`)
            ?.closest(".lane")?.dataset.categoryId === destination,
        { id: anonymous.id, destination: peach.id },
      );
    } else {
      await movePicker(peach.id);
    }
    await assertCategory(peach.id, 1, "rgb(250, 231, 218)");
    await owner.screenshot({
      path: `${output}/move-note-${enhanced ? "desktop" : "native-phone"}.png`,
      fullPage: true,
    });
    await owner.reload();
    await assertCategory(peach.id, 1, "rgb(250, 231, 218)");
    if (enhanced) {
      // A failed request leaves the category untouched and the same form retryable.
      await owner.route("**/commands", (route) => route.abort("failed"));
      await card().dragTo(
        owner.locator(`.lane[data-category-id="${cyan.id}"] h3`),
      );
      await owner.locator(".workspace > .error[role=alert]").waitFor();
      await owner.locator('.workspace[aria-busy="false"]').waitFor();
      assert.equal(
        (await read()).cards.find((c) => c.id === anonymous.id).categoryId,
        peach.id,
      );
      assert.equal(
        await owner
          .locator('[data-dragging="true"],[data-drop-target="true"]')
          .count(),
        0,
      );
      await owner.unroute("**/commands");
    }
    await movePicker(cyan.id);
    await assertCategory(cyan.id, 2, "rgb(224, 240, 245)");
    if (enhanced) {
      let committed;
      await owner.route("**/commands", async (route) => {
        committed = {
          body: route.request().postDataBuffer(),
          type: route.request().headers()["content-type"],
        };
        assert.equal((await route.fetch()).status(), 200);
        await route.abort("failed");
      });
      await card().dragTo(
        owner.locator(`.lane[data-category-id="${green.id}"] h3`),
      );
      await owner.locator(".workspace > .error[role=alert]").waitFor();
      await owner.locator('.workspace[aria-busy="false"]').waitFor();
      await owner.waitForFunction(
        ({ id, destination }) =>
          document
            .querySelector(`.feedback-card[data-card-id="${id}"]`)
            ?.closest(".lane")?.dataset.categoryId === destination,
        { id: anonymous.id, destination: green.id },
      );
      await owner.unroute("**/commands");
      const beforeReplay = await read();
      const replay = await owner.request.post(base + path + "/commands", {
        headers: { Accept: "application/json", "Content-Type": committed.type },
        data: committed.body,
      });
      assert.equal(replay.status(), 200, await replay.text());
      assert.equal((await read()).revision, beforeReplay.revision);
    } else {
      await movePicker(green.id);
    }
    await assertCategory(green.id, 0, "rgb(227, 241, 222)");
    for (const language of ["en", "ar"]) {
      for (const theme of ["light", "dark"]) {
        for (const width of [375, 390, 768, 1280, 1440]) {
          await context.addCookies([
            {
              name: "taqyeem_lang",
              value: Buffer.from(language).toString("base64"),
              url: base,
            },
            { name: "taqyeem_appearance", value: theme, url: base },
          ]);
          await owner.setViewportSize({ width, height: 1000 });
          await owner.goto(base + path + "?category=" + green.id);
          const details = card().locator(".note-move");
          if ((await details.getAttribute("open")) === null) {
            await details.locator("summary").click();
          }
          assert.equal(await details.locator("select").inputValue(), green.id);
          const bounds = await details.evaluate((node) => {
            const box = node.closest(".feedback-card").getBoundingClientRect();
            return {
              overflow: document.documentElement.scrollWidth > innerWidth,
              fieldsFit: [...node.querySelectorAll("select,button")].every(
                (field) => {
                  const r = field.getBoundingClientRect();
                  return r.left >= box.left && r.right <= box.right;
                },
              ),
            };
          });
          assert.equal(bounds.overflow, false);
          assert.equal(bounds.fieldsFit, true);
          if (
            language === "ar" &&
            theme === "dark" &&
            width === (enhanced ? 1440 : 390)
          ) {
            await owner.evaluate(() => window.scrollTo(0, 0));
            await owner.screenshot({
              path: `${output}/move-note-${enhanced ? "desktop" : "native-phone"}-ar-dark.png`,
              fullPage: true,
            });
          }
        }
      }
    }
    assert.equal((await api("advance")).status(), 200);
    await owner.goto(base + path + "?step=collect");
    assert.equal(
      await owner
        .locator('.note-move,.feedback-card[draggable="true"]')
        .count(),
      0,
    );
    assert.equal(
      (
        await api("move-note", {
          card: anonymous.id,
          fromCategory: green.id,
          categoryId: peach.id,
        })
      ).status(),
      403,
    );
    checks.push(
      `${enhanced ? "Enhanced" : "Native"}: organiser moves another member's anonymous note; category, real tint and ownership survive reload; participant moves and post-Collect/review controls are rejected; keyboard/native picker and Arabic/dark layouts fit five widths${enhanced ? "; real drag, draft retention, follower polling, failed writes and replay after a lost response also pass" : ""}`,
    );
    await context.close();
    await participantContext.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify({ checks, pageErrors: errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, output }, null, 2));
} catch (error) {
  if (active) {
    await active
      .screenshot({ path: output + "/failure.png", fullPage: true })
      .catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
}
