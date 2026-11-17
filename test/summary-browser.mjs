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
const output = process.env.BROWSER_OUTPUT ?? "/tmp/taqyeem-summary";
await mkdir(output, { recursive: true });
const checks = [],
  errors = [];
let activePage;
try {
  for (const enhanced of [true, false]) {
    for (const count of [0, 1, 3, 4]) {
      const context = await browser.newContext({
          javaScriptEnabled: enhanced,
          locale: "en-GB",
          viewport: { width: 1280, height: 900 },
        }),
        page = await context.newPage();
      activePage = page;
      page.on("pageerror", (error) => errors.push(error.message));
      const created = await page.request.post(base + "/boards/new", {
        maxRedirects: 0,
        headers: { "Accept-Language": "en" },
        form: {
          title: "Release review — meeting summary",
          organiserDisplayName: "Facilitator",
        },
      });
      assert.equal(created.status(), 303);
      const path = created.headers().location;
      const read = async () =>
        await (await page.request.get(base + path + "/session")).json();
      async function api(kind, fields = {}, client = page) {
        const v = await read(),
          r = await client.request.post(base + path + "/commands", {
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
      async function click(locator) {
        if (!enhanced) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: "domcontentloaded" }),
            locator.click(),
          ]);
        } else {
          await locator.click();
        }
      }
      async function command(kind, within = page) {
        const button = within
          .locator(`form.command-form:has([name=kind][value="${kind}"]) button`)
          .first();
        if (!enhanced) {
          return click(button);
        }
        const response = page.waitForResponse(
          (r) =>
            r.url().endsWith("/commands") && r.request().method() === "POST",
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
      await api("configure", { choice: "classic" });
      const initial = await read();
      assert.equal(
        (
          await page.request.post(base + path + "/new", {
            maxRedirects: 0,
            form: {
              submissionId: crypto.randomUUID(),
              text: "Pair reviews made releases more reliable",
              categoryId: initial.categories[0].id,
            },
          })
        ).status(),
        303,
      );
      await api("advance");
      await api("advance");
      let state = await read();
      await api("ballot", {
        ballot: String(state.state.ballot),
        value: "false",
      });
      await api("advance");
      const topic = (await read()).cards[0].id;
      await api("decision", {
        topic,
        text: "Keep paired reviews; make ownership explicit.",
      });
      await api("outcome", { topic, value: "discussed" });
      const participantContext = await browser.newContext({
          javaScriptEnabled: enhanced,
        }),
        participant = await participantContext.newPage();
      assert.equal(
        (
          await participant.request.post(base + path + "/join", {
            maxRedirects: 0,
            form: { displayName: "Participant" },
          })
        ).status(),
        303,
      );
      for (let i = 0; i < count; i++) {
        await api(
          "propose",
          {
            topic,
            text: [
              "Document the release review owner",
              "Try a smaller review checklist",
              "Review the deployment window later",
              "Pair on the next release",
            ][i],
            owner: initial.memberId,
          },
          i === 1 ? participant : page,
        );
        if (i === 2) {
          const proposal = (await read()).state.proposals.at(-1);
          await api("disposition", {
            proposal: proposal.id,
            value: "deferred",
          });
        }
      }
      await api("advance");
      // An old filter URL must not hide a small list in either Actions or Summary.
      await page.goto(base + path + "?filter=completed");
      assert.equal(
        await page.locator("[data-view=filter]").count(),
        count > 3 ? 1 : 0,
      );
      assert.equal(
        await page.locator(".current-action-list > .action-card").count(),
        count > 3 ? 0 : count,
      );
      assert.equal(
        await page.locator(".actions-shown").count(),
        count > 3 ? 1 : 0,
      );
      await command("advance");
      await page.locator(".meeting-record").waitFor();
      const closure = (await read()).state.closure,
        before = JSON.stringify(closure);
      assert.equal(
        await page.locator(".summary-topic-heading h4").innerText(),
        "Pair reviews made releases more reliable",
      );
      assert.equal(
        await page.locator(".summary-decision").innerText(),
        "Keep paired reviews; make ownership explicit.",
      );
      assert.ok(
        (await page.locator(".record-overview").innerText()).includes(
          "Topics: 1",
        ),
      );
      await page.goto(base + path + "?filter=completed");
      assert.equal(
        await page.locator("[data-view=filter]").count(),
        count > 3 ? 1 : 0,
      );
      assert.equal(
        await page.locator(".current-action-list > .action-card").count(),
        count > 3 ? 0 : count,
      );
      if (count > 3) {
        assert.equal(
          await page.locator("[data-view=filter]").inputValue(),
          "completed",
        );
        await click(page.locator(".empty-state a"));
        assert.equal(
          await page.locator(".current-action-list > .action-card").count(),
          count,
        );
      }
      if (enhanced && count === 1) {
        await page.screenshot({
          path: output + "/summary-one-action-desktop.png",
          fullPage: true,
        });
      }
      if (count > 0) {
        assert.equal(await page.locator(".summary-agreement[open]").count(), 0);
        await page.locator(".summary-agreement > summary").click();
        assert.equal(
          await page
            .locator(".historical-actions > .action-card:visible")
            .count(),
          count,
        );
        if (count >= 3) {
          assert.ok(
            (await page.locator(".historical-actions").innerText()).includes(
              "Try a smaller review checklist",
            ),
          );
        }
        await page.locator(".summary-agreement > summary").click();
        if (enhanced) {
          await page.evaluate(() =>
            window.dispatchEvent(new Event("beforeprint")),
          );
          assert.equal(
            await page.locator(".summary-agreement[open]").count(),
            1,
          );
          assert.equal(await page.locator(".evidence[open]").count(), 1);
          await page.evaluate(() =>
            window.dispatchEvent(new Event("afterprint")),
          );
          assert.equal(
            await page.locator(".summary-agreement[open]").count(),
            0,
          );
          assert.equal(await page.locator(".evidence[open]").count(), 0);
        }
        await page.emulateMedia({ media: "print" });
        assert.ok(await page.locator(".historical-actions").isVisible());
        await page.emulateMedia({ media: "screen" });
        await command("complete", page.locator(".current-action-list"));
        assert.equal((await read()).state.proposals[0].completed, true);
        assert.equal(JSON.stringify((await read()).state.closure), before);
        assert.equal(
          await page.locator(".current-action-list > .action-card").count(),
          count,
        );
        if (count > 3) {
          await page.locator("[data-view=filter]").selectOption("completed");
          if (!enhanced) {
            await click(
              page.locator(".actions-toolbar [data-view-form] button"),
            );
          }
          assert.equal(
            await page.locator(".current-action-list > .action-card").count(),
            1,
          );
        }
      }
      if (count === 3) {
        await click(page.locator("[name=locale][value=ar]"));
        await page.waitForFunction(
          () => document.documentElement.dir === "rtl",
        );
        await click(page.locator("[data-appearance=dark]"));
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
            `/summary-three-actions-${enhanced ? "enhanced" : "native"}-phone-ar-dark.png`,
          fullPage: true,
        });
        assert.equal(await page.locator("[data-view=filter]").count(), 0);
        assert.equal(
          await page.locator(".current-action-list > .action-card").count(),
          3,
        );
      }
      checks.push(
        `${enhanced ? "Enhanced" : "Native"}, ${count} items: ${count > 3 ? "working filters and empty-result recovery" : "filters and shown counts absent; stale filter URL ignored"}; meeting decision remains visible; ${count > 0 ? "recorded actions can be inspected and printed, and progress updates preserve the closure" : "empty action list remains clear"}`,
      );
      await participantContext.close();
      await context.close();
    }
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
