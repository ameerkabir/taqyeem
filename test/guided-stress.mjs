// Separate inspection fixture. This is not the core-journey acceptance test.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
const output = process.env.BROWSER_OUTPUT ?? "/tmp/taqyeem-guided-stress";
await mkdir(output, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), "taqyeem-stress-"));
const results = [],
  errors = [];
const context = await browser.newContext({ locale: "en-GB" }),
  page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const quote = (v) => "'" + String(v).replaceAll("'", "''") + "'";
async function sql(text) {
  let file = join(temp, "fixture.sql");
  await writeFile(file, text);
  let run = spawnSync(
    "./node_modules/.bin/wrangler",
    ["d1", "execute", "DB", "--local", "--file", file],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stdout + run.stderr);
}
try {
  let create = await page.request.post(base + "/boards/new", {
      maxRedirects: 0,
      form: {
        title: "Inspection fixture — 50 notes / 80 members",
        organiserDisplayName: "Fixture facilitator",
      },
    }),
    path = new URL(create.headers().location, base).pathname;
  let data = await (await page.request.get(base + path + "/session")).json(),
    id = data.board.id;
  let configured = await page.request.post(base + path + "/commands", {
    headers: { Accept: "application/json" },
    form: {
      id: crypto.randomUUID(),
      revision: String(data.revision),
      kind: "configure",
      choice: "classic",
    },
  });
  assert.equal(configured.status(), 200);
  data = await configured.json();
  let cats = [...data.categories];
  while (cats.length < 8)
    cats.push({
      id: crypto.randomUUID(),
      boardId: id,
      label: `فئة / Category ${cats.length + 1}`,
      position: cats.length,
      tone: cats.length % 4,
    });
  let members = [{ id: data.memberId, name: "Fixture facilitator" }];
  while (members.length < 79)
    members.push({
      id: crypto.randomUUID(),
      name: `Member ${String(members.length).padStart(2, "0")}`,
    });
  let cards = Array.from({ length: 50 }, (_, i) => ({
    id: crypto.randomUUID(),
    category: cats[i % 8].id,
    member: members[i % 80].id,
    text: `Evidence ${i + 1} — ملاحظات أصلية تستمر عبر المراحل. `
      .repeat(15)
      .slice(0, 500),
  }));
  let commands = cats
    .slice(3)
    .map(
      (c) =>
        `INSERT INTO categories(id,board_id,label,position,tone) VALUES (${quote(c.id)},${quote(id)},${quote(c.label)},${c.position},${c.tone});`,
    )
    .join("\n");
  commands +=
    "\n" +
    members
      .slice(1)
      .map(
        (m) =>
          `INSERT INTO members(id,board_id,display_name,name_key,role) VALUES (${quote(m.id)},${quote(id)},${quote(m.name)},${quote(m.name.toLowerCase())},'participant');`,
      )
      .join("\n");
  commands +=
    "\n" +
    cards
      .map(
        (c, i) =>
          `INSERT INTO cards(id,board_id,category_id,member_id,submission_id,body,is_anonymous,created_at) VALUES (${quote(c.id)},${quote(id)},${quote(c.category)},${quote(c.member)},${quote(crypto.randomUUID())},${quote(c.text)},${i % 3 === 0 ? 1 : 0},${quote("2026-11-16T08:" + String(Math.floor(i / 60)).padStart(2, "0") + ":" + String(i % 60).padStart(2, "0") + ".000Z")});`,
      )
      .join("\n");
  let shared = data.state;
  shared.themes = Array.from({ length: 20 }, (_, i) => ({
    id: crypto.randomUUID(),
    title: `Long theme ${i + 1} — موضوع مبني على الملاحظات الأصلية`,
    notes: cards.slice(i * 2, i * 2 + 2).map((c) => c.id),
  }));
  shared.proposals = Array.from({ length: 30 }, (_, i) => ({
    id: crypto.randomUUID(),
    text: `Action / إجراء ${i + 1}: ${"A concrete follow-up with original context. ".repeat(3)}`,
    topic: shared.themes[i % 20].id,
    author: members[i].id,
    owner: members[(i + 1) % 80].id,
    due: "2026-12-01",
    disposition: ["suggested", "agreed", "deferred", "declined"][i % 4],
    completed: false,
    updatedAt: "2026-11-16T08:00:00.000Z",
  }));
  commands += `\nUPDATE guided_sessions SET data=${quote(JSON.stringify(shared))},revision=revision+1 WHERE board_id=${quote(id)};`;
  await sql(commands);
  const readerContext = await browser.newContext({ locale: "en-GB" }),
    reader = await readerContext.newPage();
  reader.on("pageerror", (e) => errors.push(e.message));
  const joined = await reader.request.post(base + path + "/join", {
    maxRedirects: 0,
    form: { displayName: "Inspection reader" },
  });
  assert.equal(joined.status(), 303);
  const facilitatorState = await (
    await page.request.get(base + path + "/session")
  ).json();
  const participantState = await (
    await reader.request.get(base + path + "/session")
  ).json();
  assert.equal(
    facilitatorState.memberId,
    facilitatorState.board.organiserMemberId,
  );
  assert.notEqual(
    participantState.memberId,
    participantState.board.organiserMemberId,
  );
  assert.equal(facilitatorState.members.length, 80);
  const viewers = [
    { page, context, role: "facilitator" },
    { page: reader, context: readerContext, role: "participant" },
  ];
  const read = async () =>
    await (await page.request.get(base + path + "/session")).json();
  async function command(kind, fields = {}) {
    let v = await read();
    let r = await page.request.post(base + path + "/commands", {
      headers: { Accept: "application/json" },
      form: {
        id: crypto.randomUUID(),
        revision: String(v.revision),
        kind,
        ...fields,
      },
    });
    assert.equal(r.status(), 200, await r.text());
  }
  const dimensions = [
    [375, 812],
    [390, 844],
    [768, 1024],
    [1280, 800],
    [1440, 900],
  ];
  for (let stage of [
    "collect",
    "group",
    "vote",
    "discuss",
    "actions",
    "summary",
  ]) {
    if (stage === "group") await command("advance");
    if (stage === "vote") await command("advance");
    if (stage === "discuss") {
      let v = await read();
      await command("ballot", {
        ballot: String(v.state.ballot),
        value: "false",
      });
      await command("advance");
    }
    if (stage === "actions" || stage === "summary") await command("advance");
    for (const { page, context, role } of viewers)
      for (let language of ["en", "ar"])
        for (let theme of ["light", "dark"])
          for (let [width, height] of dimensions) {
            await context.addCookies([
              {
                name: "taqyeem_lang",
                value: Buffer.from(language).toString("base64"),
                url: base,
              },
              { name: "taqyeem_appearance", value: theme, url: base },
            ]);
            await page.setViewportSize({ width, height });
            await page.goto(base + path);
            await page.locator(".workspace[data-enhanced=true]").waitFor();
            let bounds = await page.evaluate(() => ({
              overflow: document.documentElement.scrollWidth > innerWidth,
              lang: document.documentElement.lang,
              dir: document.documentElement.dir,
              theme: document.documentElement.dataset.theme,
            }));
            assert.equal(
              bounds.overflow,
              false,
              `${stage}/${language}/${theme}/${width}`,
            );
            assert.equal(bounds.lang, language);
            assert.equal(bounds.theme, theme);
            if (stage === "discuss" && width < 768) {
              const sizes = await page.evaluate(() => ({
                layout: document
                  .querySelector(".discussion-layout")
                  .getBoundingClientRect().width,
                subject: document
                  .querySelector(".discussion-subject")
                  .getBoundingClientRect().width,
              }));
              assert.ok(
                Math.abs(sizes.layout - sizes.subject) < 1,
                `Discussion subject fills the phone column: ${language}/${theme}/${role}/${width}`,
              );
            }
            if (stage === "collect") {
              await page
                .locator("[data-view=category]")
                .selectOption(cats[7].id);
              assert.equal(
                await page.locator(".lane[data-active=true] h3").count(),
                1,
              );
            }
            if (stage === "actions") {
              await page
                .locator("[data-view=filter]")
                .selectOption("completed");
              await page.locator(".empty-state :is(a,button)").waitFor();
              await page.locator(".empty-state :is(a,button)").click();
              assert.equal(
                await page.locator(".action-grid>.action-card").count(),
                30,
              );
            }
            results.push({
              stage,
              role,
              language,
              theme,
              width,
              height,
              ...bounds,
            });
            if (
              role === "facilitator" &&
              width === 390 &&
              language === "ar" &&
              theme === "dark" &&
              ["collect", "discuss", "actions"].includes(stage)
            )
              await page.screenshot({
                path: output + `/${stage}-390-ar-dark.png`,
                fullPage: true,
              });
          }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    output + "/results.json",
    JSON.stringify(
      {
        fixture: {
          notes: 50,
          noteLength: 500,
          categories: 8,
          themes: 20,
          members: 80,
          actions: 30,
        },
        states: results,
        pageErrors: errors,
        limitations:
          "Inspection fixture, Chromium emulation, both roles; not 240 completed journeys or real-device/accessibility approval",
      },
      null,
      2,
    ),
  );
  console.log(
    `Passed ${results.length} stress inspection states; results: ${output}`,
  );
} finally {
  await browser.close();
  await rm(temp, { recursive: true, force: true });
}
