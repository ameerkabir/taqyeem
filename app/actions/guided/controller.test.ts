import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { sql } from "remix/data-table";
import { createAppRouter } from "../../router.ts";
import { testDatabase } from "../../test/dependencies.ts";
import { categories, cards } from "../../data/tables.ts";
import type { ViewerPayload } from "./payload.ts";
import { redactMeetingRecord } from "./payload.ts";
import { readMeetingRecord } from "../../models/guided/session.ts";
const options = {
  sessionSecret: "guided-test-secret",
  config: { appEnv: "test" },
  waitUntil() {},
};
async function setup(autoConfigure = true) {
  let db = await testDatabase();
  const request = (
    path: string,
    cookie?: string,
    fields?: Record<string, string>,
    json = true,
  ) =>
    createAppRouter({ ...options, db }).fetch("http://localhost" + path, {
      method: fields ? "POST" : "GET",
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(json
          ? { Accept: "application/json", "Accept-Language": "en" }
          : {}),
      },
      body: fields ? new URLSearchParams(fields) : undefined,
    });
  let created = await request("/boards/new", undefined, {
    title: "Real session",
    organiserDisplayName: "Owner",
  });
  assert.equal(created.status, 303);
  const cookie = (r: Response) =>
    r.headers
      .getSetCookie()
      .find((c) => c.startsWith("taqyeem_session="))!
      .split(";")[0];
  let owner = cookie(created),
    path = created.headers.get("Location")!;
  let joined = await request(path + "/join", undefined, {
      displayName: "Reader",
    }),
    participant = cookie(joined);
  const read = async (who = owner) =>
    (await (await request(path + "/session", who)).json()) as ViewerPayload;
  const command = async (
    kind: string,
    fields: Record<string, string> = {},
    who = owner,
    native = false,
  ) => {
    let view = await read(who);
    return request(
      path + "/commands",
      who,
      {
        id: crypto.randomUUID(),
        revision: String(view.revision),
        kind,
        ...fields,
      },
      !native,
    );
  };
  if (autoConfigure)
    assert.equal(
      (await command("configure", { choice: "classic" })).status,
      200,
    );
  return { db, path, owner, participant, request, read, command };
}
describe("guided route boundary", () => {
  it("prevents participants bypassing move permissions through Edit while preserving their text/anonymity edits", async () => {
    const f = await setup(),
      initial = await f.read();
    await f.request(f.path + "/new", f.participant, {
      submissionId: crypto.randomUUID(),
      text: "Participant note",
      categoryId: initial.categories[0].id,
      isAnonymous: "true",
    });
    const card = (await f.read(f.participant)).cards[0],
      edit = f.path + "/cards/" + card.id + "/edit";
    let html = await (
      await f.request(edit, f.participant, undefined, false)
    ).text();
    assert.ok(
      html.includes('name="categoryId" value="' + card.categoryId + '"'),
    );
    assert.ok(!html.includes('type="radio"'));
    assert.equal(
      (
        await f.request(edit, f.participant, {
          text: "Forged move",
          categoryId: initial.categories[1].id,
          isAnonymous: "true",
        })
      ).status,
      403,
    );
    assert.equal(
      (await f.read(f.participant)).cards[0].body,
      "Participant note",
    );
    assert.equal(
      (
        await f.request(edit, f.participant, {
          text: "Edited original note",
          categoryId: card.categoryId,
          isAnonymous: "false",
        })
      ).status,
      303,
    );
    const saved = (await f.read(f.participant)).cards[0];
    assert.equal(saved.categoryId, card.categoryId);
    assert.equal(saved.body, "Edited original note");
    assert.equal(saved.isAnonymous, false);
  });
  it("moves another member's note only as organiser, with native recovery, private payloads and no post-Collect controls", async () => {
    const f = await setup(),
      initial = await f.read();
    await f.request(f.path + "/new", f.participant, {
      submissionId: crypto.randomUUID(),
      text: "Participant anonymous note",
      categoryId: initial.categories[0].id,
      isAnonymous: "true",
    });
    const view = await f.read(),
      note = view.cards[0];
    const fields = {
      card: note.id,
      fromCategory: note.categoryId,
      categoryId: view.categories[1].id,
    };
    assert.equal(
      (await f.command("move-note", fields, f.participant)).status,
      403,
    );
    let html = await (
      await f.request(f.path, f.participant, undefined, false)
    ).text();
    assert.ok(!html.includes('class="note-move"'));
    html = await (await f.request(f.path, f.owner, undefined, false)).text();
    assert.ok(html.includes('class="note-move"'));
    assert.ok(html.includes('draggable="true"'));
    const invalid = await f.command(
      "move-note",
      { ...fields, categoryId: "invalid" },
      f.owner,
      true,
    );
    assert.equal(invalid.status, 400);
    html = await invalid.text();
    assert.ok(html.includes('name="categoryId" value="invalid"'));
    const native = await f.command("move-note", fields, f.owner, true);
    assert.equal(native.status, 303);
    assert.equal(
      native.headers.get("Location"),
      f.path + "?category=" + fields.categoryId,
    );
    const moved = await f.read();
    assert.equal(moved.cards[0].categoryId, fields.categoryId);
    assert.equal(moved.cards[0].memberId, "");
    assert.equal(moved.cards[0].body, note.body);
    assert.equal(moved.cards[0].isAnonymous, true);
    assert.equal((await f.command("move-note", fields)).status, 409);
    await f.command("advance");
    assert.equal(
      (
        await f.command("move-note", {
          ...fields,
          fromCategory: fields.categoryId,
          categoryId: fields.fromCategory,
        })
      ).status,
      403,
    );
    html = await (
      await f.request(f.path + "?step=collect", f.owner, undefined, false)
    ).text();
    assert.ok(!html.includes('class="note-move"'));
    assert.ok(!html.includes('draggable="true"'));
  });
  it("reviews completed steps without writes, blocks future steps, and serves board-scoped anonymous-safe versioned records", async () => {
    const f = await setup(),
      initial = await f.read();
    await f.request(f.path + "/new", f.owner, {
      submissionId: crypto.randomUUID(),
      text: "Anonymous original evidence",
      categoryId: initial.categories[0].id,
      isAnonymous: "true",
    });
    await f.command("advance");
    let before = await f.read();
    const future = await f.request(
      f.path + "?step=vote",
      f.owner,
      undefined,
      false,
    );
    assert.equal(future.status, 303);
    assert.equal(future.headers.get("Location"), f.path);
    assert.equal((await f.read()).revision, before.revision);
    await f.command("advance");
    let v = await f.read();
    await f.command("ballot", {
      ballot: String(v.state.ballot),
      value: "false",
    });
    await f.command("advance");
    const topic = (await f.read()).cards[0].id;
    await f.command("decision", { topic, text: "Original recorded decision" });
    await f.command("advance");
    await f.command("advance");
    before = await f.read();
    for (const step of ["collect", "group", "vote", "discuss", "actions"]) {
      let r = await f.request(
        f.path + "?step=" + step,
        f.owner,
        undefined,
        false,
      );
      assert.equal(r.status, 200);
      let html = await r.text();
      assert.ok(html.includes('data-review="true"'));
      assert.ok(!html.includes('class="primary add-note"'));
      assert.ok(!html.includes('class="reopen-meeting"'));
      assert.equal((await f.read()).revision, before.revision);
    }
    assert.equal((await f.request(f.path + "?record=99", f.owner)).status, 404);
    assert.equal(
      (await f.request(f.path + "?record=abc", f.owner)).status,
      404,
    );
    let html = await (
      await f.request(f.path + "?record=1", f.participant, undefined, false)
    ).text();
    assert.ok(html.includes("Original recorded decision"));
    assert.ok(html.includes('data-review="true"'));
    assert.ok(!html.includes('class="current-progress-heading"'));
    assert.ok(!html.includes('class="reopen-meeting"'));
    const archive = (await readMeetingRecord(f.db, before.board.id, 1))!;
    assert.equal(
      redactMeetingRecord(
        archive.closure,
        (await f.read(f.participant)).memberId,
      ).cards[0].memberId,
      "",
    );
    assert.equal(
      redactMeetingRecord(archive.closure, before.memberId).cards[0].memberId,
      before.memberId,
    );
    assert.equal(
      (await f.command("reopen", { version: "1" }, f.participant)).status,
      403,
    );
    assert.equal((await f.command("reopen", { version: "2" })).status, 409);
    assert.equal(
      (await f.command("reopen", { version: "1" }, f.owner, true)).status,
      303,
    );
    assert.equal((await f.read()).state.stage, "discuss");
    assert.equal(
      (
        await f.request(f.path + "/new", f.owner, {
          submissionId: crypto.randomUUID(),
          text: "Cannot alter old feedback",
          categoryId: initial.categories[0].id,
        })
      ).status,
      403,
    );
    html = await (
      await f.request(f.path + "?record=1", f.owner, undefined, false)
    ).text();
    assert.ok(html.includes("Original recorded decision"));
    assert.ok(!html.includes('class="reopen-meeting"'));
    assert.equal(
      (await f.request(f.path + "?step=summary", f.owner, undefined, false))
        .status,
      303,
    );
    assert.equal(
      (await f.request(f.path + "?record=1", undefined)).status,
      403,
    );
  });
  it("reports duplicate theme names and supports adding selected notes to an existing theme through native and enhanced commands", async () => {
    let f = await setup(),
      initial = await f.read();
    for (let i = 0; i < 3; i++)
      assert.equal(
        (
          await f.request(f.path + "/new", f.owner, {
            submissionId: crypto.randomUUID(),
            text: `Group note ${i}`,
            categoryId: initial.categories[0].id,
          })
        ).status,
        303,
      );
    await f.command("advance");
    let ids = (await f.read()).cards.map((c) => c.id);
    assert.equal(
      (await f.command("theme", { title: "Delivery", notes: ids[0] })).status,
      200,
    );
    let theme = (await f.read()).state.themes[0];
    let duplicate = await f.command("theme", {
      title: " DELIVERY ",
      notes: ids[1],
    });
    assert.equal(duplicate.status, 400);
    assert.equal(
      ((await duplicate.json()) as { code: string }).code,
      "duplicateTheme",
    );
    let native = await f.command(
      "theme",
      { title: "delivery", notes: ids[1] },
      f.owner,
      true,
    );
    assert.equal(native.status, 400);
    let html = await native.text();
    assert.ok(html.includes('name="title"'));
    assert.ok(html.includes('value="delivery"'));
    assert.ok(html.includes(ids[1]));
    assert.equal(
      (
        await f.command(
          "theme",
          { theme: theme.id, title: "", notes: ids[1] },
          f.owner,
          true,
        )
      ).status,
      303,
    );
    assert.equal(
      (
        await f.command(
          "theme",
          { theme: theme.id, notes: ids[2] },
          f.participant,
        )
      ).status,
      403,
    );
    let grouped = await f.read();
    assert.deepEqual(grouped.state.themes, [
      { ...theme, notes: ids.slice(0, 2) },
    ]);
    assert.equal(grouped.cards.length, 3);
    html = await (await f.request(f.path, f.owner, undefined, false)).text();
    assert.ok(html.includes("formnovalidate"));
    assert.ok(html.includes(`value="${theme.id}"`));
    let participantHtml = await (
      await f.request(f.path, f.participant, undefined, false)
    ).text();
    assert.ok(!participantHtml.includes("formnovalidate"));
  });
  it("completes a real native/enhanced journey with isolated identities and hidden ballots", async () => {
    let f = await setup(),
      initial = await f.read(),
      category = initial.categories[0].id;
    let note = await f.request(f.path + "/new", f.participant, {
      submissionId: crypto.randomUUID(),
      text: "Anonymous source",
      categoryId: category,
      isAnonymous: "true",
    });
    assert.equal(note.status, 303);
    let source = (await f.db.findMany(cards))[0];
    let own = await f.read(f.participant),
      other = await f.read();
    assert.equal(own.cards[0].memberId, own.memberId);
    assert.equal(other.cards[0].memberId, "");
    assert.equal((await f.command("advance", {}, f.participant)).status, 403);
    let native = await f.command("advance", {}, f.owner, true);
    assert.equal(native.status, 303);
    assert.equal(native.headers.get("Location"), f.path);
    let late = await f.request(f.path + "/new", f.participant, {
      submissionId: crypto.randomUUID(),
      text: "Kept draft",
      categoryId: category,
    });
    assert.equal(late.status, 403);
    assert.equal(
      (await f.command("theme", { title: "A theme", notes: source.id })).status,
      200,
    );
    await f.command("advance");
    let ballot = await f.read(),
      topic = ballot.state.themes[0].id;
    await f.command(
      "vote",
      { topic, ballot: String(ballot.state.ballot), value: "true" },
      f.participant,
    );
    let hidden = await f.read();
    assert.deepEqual(hidden.counts, {});
    assert.deepEqual(hidden.state.votes[hidden.memberId], []);
    assert.deepEqual(hidden.state.receipts, {});
    await f.command("ballot", {
      ballot: String(ballot.state.ballot),
      value: "false",
    });
    assert.equal((await f.read()).counts[topic], 1);
    await f.command("advance");
    await f.command("decision", { topic, text: "No action needed" });
    await f.command("outcome", { topic, value: "discussed" });
    await f.command(
      "propose",
      { topic, text: "Suggestion remains unresolved" },
      f.participant,
    );
    await f.command("advance");
    await f.command("advance");
    let summary = await f.read();
    assert.equal(summary.state.stage, "summary");
    assert.equal(summary.state.closure!.proposals[0].disposition, "suggested");
    assert.equal(summary.state.closure!.cards[0].memberId, "");
    let html = await (
      await f.request(f.path, f.owner, undefined, false)
    ).text();
    assert.ok(html.includes("No action needed"));
    assert.ok(html.includes("Suggestion remains unresolved"));
  });
  it("rejects visitor/cross-board commands, stale native forms, forged owner names and legacy endpoint bypasses", async () => {
    let f = await setup(),
      another = await setup();
    assert.equal((await f.request(f.path + "/session", undefined)).status, 403);
    assert.equal(
      (
        await f.request(f.path + "/commands", another.owner, {
          kind: "advance",
        })
      ).status,
      403,
    );
    assert.equal(
      (await f.request(f.path + "/status", f.owner, { status: "closed" }))
        .status,
      409,
    );
    let view = await f.read(),
      fields = {
        kind: "ready",
        value: "true",
        id: crypto.randomUUID(),
        revision: String(view.revision),
      };
    await f.command("ready", { value: "true" });
    let conflict = await f.request(
      f.path + "/commands",
      f.owner,
      fields,
      false,
    );
    assert.equal(conflict.status, 409);
    assert.ok((await conflict.text()).includes('name="value"'));
    assert.equal(
      (
        await f.command("propose", {
          text: "No",
          ownerSearch: "Unknown member",
        })
      ).status,
      400,
    );
  });
  it("does not silently convert legacy stages, votes or category identity", async () => {
    let f = await setup(),
      id = f.path.split("/").pop()!;
    await f.db.exec(sql`DELETE FROM guided_sessions WHERE board_id=${id}`);
    assert.equal((await f.request(f.path + "/session", f.owner)).status, 404);
    assert.equal(
      (await f.request(f.path + "/status", f.owner, { status: "meeting" }))
        .status,
      303,
    );
    assert.equal(
      (
        await f.request(f.path + "/commands", f.participant, {
          kind: "convert",
        })
      ).status,
      403,
    );
    assert.equal(
      (await f.request(f.path + "/commands", f.owner, { kind: "convert" }))
        .status,
      200,
    );
    // The board is now guided; converting it again is a conflict, not a reset.
    assert.equal(
      (await f.request(f.path + "/commands", f.owner, { kind: "convert" }))
        .status,
      409,
    );
    let view = await f.read();
    assert.equal(view.state.stage, "discuss");
    assert.equal(view.state.legacy, true);
    assert.deepEqual(view.counts, {});
    assert.deepEqual(
      view.categories.map((c) => c.tone),
      [0, 1, 2],
    );
  });
  it("edits proposals through an authorised native route, preserves invalid fields and denies agreed-action edits to participants", async () => {
    let f = await setup();
    await f.command("advance");
    await f.command("advance");
    let v = await f.read();
    await f.command("ballot", {
      ballot: String(v.state.ballot),
      value: "false",
    });
    await f.command("advance");
    await f.command(
      "propose",
      { text: "Participant suggestion" },
      f.participant,
    );
    v = await f.read();
    let proposal = v.state.proposals[0],
      edit = f.path + "/actions/" + proposal.id + "/edit";
    let page = await f.request(edit, f.participant, undefined, false);
    assert.equal(page.status, 200);
    await page.text();
    let invalid = await f.request(
      edit,
      f.participant,
      {
        id: crypto.randomUUID(),
        revision: String(v.revision),
        text: "Preserve these fields",
        ownerSearch: "Not a member",
        due: "2026-12-01",
        topic: "",
      },
      false,
    );
    assert.equal(invalid.status, 400);
    assert.ok((await invalid.text()).includes("Preserve these fields"));
    let saved = await f.request(
      edit,
      f.participant,
      {
        id: crypto.randomUUID(),
        revision: String(v.revision),
        text: "Updated suggestion",
        ownerSearch: "Reader",
        due: "2026-12-01",
        topic: "",
      },
      false,
    );
    assert.equal(saved.status, 303);
    assert.equal(
      (await f.read()).state.proposals[0].text,
      "Updated suggestion",
    );
    await f.command("disposition", { proposal: proposal.id, value: "agreed" });
    let forbidden = await f.request(edit, f.participant, undefined, false);
    assert.equal(forbidden.status, 403);
  });

  it("uses private revision validators without exposing other ballots or command receipts", async () => {
    let f = await setup(),
      url = "http://localhost" + f.path + "/session";
    const request = (cookie: string, tag?: string) =>
      createAppRouter({ ...options, db: f.db }).fetch(url, {
        headers: {
          Cookie: cookie,
          Accept: "application/json",
          ...(tag ? { "If-None-Match": tag } : {}),
        },
      });
    let first = await request(f.owner),
      tag = first.headers.get("ETag")!;
    assert.ok(tag);
    assert.ok(!(await first.text()).includes("fingerprint"));
    assert.equal((await request(f.owner, tag)).status, 304);
    assert.equal((await request(f.participant, tag)).status, 200);
    await f.command("ready", { value: "true" }, f.participant);
    let changed = await request(f.owner, tag);
    assert.equal(changed.status, 200);
    assert.ok(changed.headers.get("ETag") !== tag);
    let payload = (await changed.json()) as ViewerPayload;
    assert.equal(payload.doneCount, 1);
    assert.equal(Object.keys(payload.state.ready).length, 1);
    assert.equal(Object.keys(payload.state.receipts).length, 0);
  });
  it("uses viewer-scoped revision validation for polling without leaking receipts or other ballots", async () => {
    let f = await setup(),
      router = createAppRouter({ ...options, db: f.db });
    let first = await router.fetch("http://localhost" + f.path + "/session", {
      headers: { Cookie: f.owner },
    });
    assert.equal(first.status, 200);
    let tag = first.headers.get("ETag")!;
    assert.ok(tag);
    let body = await first.text();
    assert.ok(!body.includes("fingerprint"));
    let unchanged = await router.fetch(
      "http://localhost" + f.path + "/session",
      { headers: { Cookie: f.owner, "If-None-Match": tag } },
    );
    assert.equal(unchanged.status, 304);
    assert.equal(await unchanged.text(), "");
    let other = await router.fetch("http://localhost" + f.path + "/session", {
      headers: { Cookie: f.participant, "If-None-Match": tag },
    });
    assert.equal(other.status, 200);
    await other.text();
    await f.command("ready", { value: "true" });
    let changed = await router.fetch("http://localhost" + f.path + "/session", {
      headers: { Cookie: f.owner, "If-None-Match": tag },
    });
    assert.equal(changed.status, 200);
    assert.ok(changed.headers.get("ETag") !== tag);
    await changed.text();
  });
  it("requires facilitator category confirmation before notes or progression and supports custom labels atomically", async () => {
    let f = await setup(false),
      initial = await f.read();
    assert.equal(initial.state.categorySetup?.confirmed, false);
    let html = await (
      await f.request(f.path, f.owner, undefined, false)
    ).text();
    assert.ok(html.includes('value="classic"'));
    assert.ok(html.includes('value="custom"'));
    assert.ok(!html.includes('class="primary add-note"'));
    assert.equal(
      (await f.command("configure", { choice: "classic" }, f.participant))
        .status,
      403,
    );
    assert.equal((await f.command("advance")).status, 409);
    let noteFields = {
      submissionId: crypto.randomUUID(),
      text: "Not yet",
      categoryId: initial.categories[0].id,
    };
    assert.equal(
      (await f.request(f.path + "/new", f.owner, noteFields)).status,
      403,
    );
    assert.equal(
      (
        await f.command("configure", {
          choice: "custom",
          labels: " Keep doing \nChange\nجرّب",
        })
      ).status,
      200,
    );
    let configured = await f.read();
    assert.deepEqual(
      configured.categories.map((c) => c.label),
      ["Keep doing", "Change", "جرّب"],
    );
    assert.deepEqual(
      configured.categories.map((c) => c.tone),
      [0, 1, 2],
    );
    assert.equal(configured.state.categorySetup?.confirmed, true);
    assert.equal(
      (
        await f.request(f.path + "/new", f.owner, {
          ...noteFields,
          categoryId: configured.categories[0].id,
        })
      ).status,
      303,
    );
    assert.equal(
      (await f.command("configure", { choice: "classic" })).status,
      409,
    );
    assert.equal((await f.read()).cards.length, 1);
  });
  it("validates category names without changing the board, preserves classic ids, and deduplicates setup retries", async () => {
    let f = await setup(false),
      original = await f.read();
    for (let labels of [
      "",
      "A\nA",
      "x".repeat(121),
      Array(9)
        .fill(0)
        .map((_, i) => String(i))
        .join("\n"),
      "\u200b",
      // Names that only differ by spacing or invisible characters read as one category.
      "Went well\nWent  well",
      "Ideas\nIdeas\u200b",
      "Ideas\nＩｄｅａｓ",
    ]) {
      assert.equal(
        (await f.command("configure", { choice: "custom", labels })).status,
        400,
      );
      assert.deepEqual((await f.read()).categories, original.categories);
    }
    let command = {
      id: crypto.randomUUID(),
      revision: String(original.revision),
      kind: "configure",
      choice: "classic",
    };
    assert.equal(
      (await f.request(f.path + "/commands", f.owner, command)).status,
      200,
    );
    let first = await f.read();
    assert.deepEqual(
      first.categories.map((c) => c.id),
      original.categories.map((c) => c.id),
    );
    assert.equal(
      (await f.request(f.path + "/commands", f.owner, command)).status,
      200,
    );
    assert.equal((await f.read()).revision, first.revision);
  });
  it("serializes competing category choices and guards direct note writes before setup", async () => {
    let f = await setup(false),
      view = await f.read(),
      blocked = false;
    try {
      await f.db.exec(
        sql`INSERT INTO cards(id,board_id,category_id,member_id,submission_id,body,is_anonymous) VALUES (${crypto.randomUUID()},${view.board.id},${view.categories[0].id},${view.memberId},${crypto.randomUUID()},'blocked',0)`,
      );
    } catch {
      blocked = true;
    }
    assert.ok(blocked);
    let common = { revision: String(view.revision), kind: "configure" };
    let results = await Promise.all([
      f.request(f.path + "/commands", f.owner, {
        ...common,
        id: crypto.randomUUID(),
        choice: "classic",
      }),
      f.request(f.path + "/commands", f.owner, {
        ...common,
        id: crypto.randomUUID(),
        choice: "custom",
        labels: "One\nTwo",
      }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    let final = await f.read();
    assert.equal(final.state.categorySetup?.confirmed, true);
    assert.ok(final.categories.length === 2 || final.categories.length === 3);
  });
  it("answers a JSON command with the committed session, matching what a later poll returns", async () => {
    let f = await setup(),
      before = await f.read();
    let response = await f.command("ready", { value: "true" });
    assert.equal(response.status, 200);
    let committed = (await response.json()) as ViewerPayload;
    assert.equal(committed.revision, before.revision + 1);
    let polled = await f.read();
    assert.equal(polled.revision, committed.revision);
    assert.deepEqual(polled.state, committed.state);
    assert.deepEqual(polled.cards, committed.cards);
  });
  it("gives a failed native command a retry form carrying the board's current revision", async () => {
    let f = await setup(),
      current = await f.read();
    let response = await f.request(
      f.path + "/commands",
      f.owner,
      {
        id: crypto.randomUUID(),
        revision: String(current.revision + 50),
        kind: "advance",
      },
      false,
    );
    assert.equal(response.status, 409);
    let html = await response.text();
    assert.ok(
      html.includes(`name="revision" value="${current.revision}"`),
      "retry form uses the stored revision, not the stale submitted one",
    );
  });
});
