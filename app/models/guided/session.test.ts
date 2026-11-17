import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { sql } from "remix/data-table";
import { testDatabase } from "../../test/dependencies.ts";
import { createBoard } from "../boards/create.ts";
import { createCard } from "../cards/card.ts";
import { joinBoard } from "../boards/join.ts";
import {
  readSession,
  createSession,
  readGuidedStatus,
  applyCommand,
  commandSession,
  topics,
  rankedTopics,
  CommandError,
  readMeetingRecord,
  type Command,
  type SessionView,
} from "./session.ts";
import { viewerPayload } from "../../actions/guided/payload.ts";

async function fixture(count = 6) {
  let db = await testDatabase(),
    created = await createBoard(db, {
      title: "Test",
      organiserDisplayName: "Facilitator",
      categoryLabels: ["A", "B", "C", "D"],
    });
  let id = created.board.id,
    owner = created.organiser.id;
  let joined = await joinBoard(db, id, "Participant");
  assert.ok(joined?.ok);
  let participant = joined.member.id;
  await createSession(db, id);
  for (let i = 0; i < count; i++)
    await createCard(
      db,
      {
        id: crypto.randomUUID(),
        boardId: id,
        memberId: owner,
        categoryId: created.categories[i % 4].id,
        body: `Note ${i}`,
        isAnonymous: i === 0,
      },
      crypto.randomUUID(),
      { maxCards: 100, windowMs: 1000 },
    );
  const read = async () => (await readSession(db, id))!;
  const command = async (
    kind: string,
    fields: Record<string, unknown> = {},
    actor = owner,
  ) => {
    let view = await read();
    return commandSession(db, id, actor, {
      id: crypto.randomUUID(),
      revision: view.revision,
      kind,
      ...fields,
    });
  };
  const reject = async (fn: () => Promise<unknown>, code: string) => {
    try {
      await fn();
      assert.fail("expected rejection");
    } catch (e) {
      assert.ok(e instanceof CommandError);
      assert.equal(e.code, code);
    }
  };
  return { db, id, owner, participant, read, command, reject };
}
describe("guided session authority and atomic invariants", () => {
  it("lets the organiser move another member's anonymous note with an atomic receipt, preserving every other stored field", async () => {
    const f = await fixture(1),
      initial = await f.read();
    const created = await createCard(
      f.db,
      {
        id: crypto.randomUUID(),
        boardId: f.id,
        memberId: f.participant,
        categoryId: initial.categories[0].id,
        body: "Anonymous participant evidence",
        isAnonymous: true,
      },
      crypto.randomUUID(),
    );
    assert.ok(created.ok);
    const before = (
      await f.db.exec("SELECT * FROM cards WHERE id=?", [created.card.id])
    ).rows![0];
    const view = await f.read();
    const command = {
      id: crypto.randomUUID(),
      revision: view.revision,
      kind: "move-note",
      card: created.card.id,
      fromCategory: created.card.categoryId,
      categoryId: view.categories[2].id,
    };
    const moved = await commandSession(f.db, f.id, f.owner, command);
    assert.equal(moved.revision, (await f.read()).revision);
    assert.deepEqual(
      (await f.db.exec("SELECT * FROM cards WHERE id=?", [created.card.id]))
        .rows![0],
      {
        ...before,
        category_id: command.categoryId,
      },
    );
    assert.equal(moved.cards.length, 2);
    assert.deepEqual(moved.categories, view.categories);
    assert.equal(
      viewerPayload(moved, f.owner).cards.find((c) => c.id === command.card)!
        .memberId,
      "",
    );
    assert.equal(
      (
        await f.db.exec(
          "SELECT count(*) AS n FROM guided_command_receipts WHERE command_id=?",
          [command.id],
        )
      ).rows![0].n,
      1,
    );
    await f.command("move-note", {
      card: command.card,
      fromCategory: command.categoryId,
      categoryId: command.fromCategory,
    });
    const changedAgain = await f.read();
    await commandSession(f.db, f.id, f.owner, command);
    assert.deepEqual(await f.read(), changedAgain);
    await f.reject(
      () =>
        commandSession(f.db, f.id, f.owner, {
          ...command,
          categoryId: view.categories[1].id,
        }),
      "invalid",
    );
  });
  it("rejects participant, foreign-board, stale-source and post-Collect moves, including raw forged move receipts", async () => {
    const f = await fixture(1),
      v = await f.read(),
      card = v.cards[0];
    const fields = {
      card: card.id,
      fromCategory: card.categoryId,
      categoryId: v.categories[1].id,
    };
    await f.reject(
      () => f.command("move-note", fields, f.participant),
      "forbidden",
    );
    const other = await fixture(1),
      foreign = await other.read();
    await f.reject(
      () =>
        f.command("move-note", {
          ...fields,
          categoryId: foreign.categories[0].id,
        }),
      "invalid",
    );
    await f.reject(
      () => f.command("move-note", { ...fields, card: foreign.cards[0].id }),
      "invalid",
    );
    await f.reject(
      () =>
        f.command("move-note", { ...fields, fromCategory: v.categories[2].id }),
      "conflict",
    );
    let blocked = false;
    try {
      await f.db.exec(
        "UPDATE guided_sessions SET data=?, revision=revision+1 WHERE board_id=?",
        [
          JSON.stringify({
            ...v.state,
            receipt: {
              id: crypto.randomUUID(),
              member: f.participant,
              fingerprint: "forged",
              kind: "move-note",
              move: fields,
            },
          }),
          f.id,
        ],
      );
    } catch {
      blocked = true;
    }
    assert.ok(blocked);
    assert.deepEqual(await f.read(), v);
    await f.command("advance");
    await f.reject(() => f.command("move-note", fields), "forbidden");
    assert.equal((await f.read()).cards[0].categoryId, card.categoryId);
  });
  it("serializes category moves against other moves and progression, and rolls back receipts and revision when a card update fails", async () => {
    const f = await fixture(1),
      initial = await f.read(),
      card = initial.cards[0];
    const command = {
      id: crypto.randomUUID(),
      revision: initial.revision,
      kind: "move-note",
      card: card.id,
      fromCategory: card.categoryId,
      categoryId: initial.categories[1].id,
    };
    await f.db.exec(
      "CREATE TRIGGER fail_note_move BEFORE UPDATE OF category_id ON cards BEGIN SELECT RAISE(ABORT,'test_move_failure'); END",
    );
    let failed = false;
    try {
      await commandSession(f.db, f.id, f.owner, command);
    } catch {
      failed = true;
    }
    assert.ok(failed);
    assert.deepEqual(await f.read(), initial);
    assert.equal(
      (
        await f.db.exec(
          "SELECT count(*) AS n FROM guided_command_receipts WHERE command_id=?",
          [command.id],
        )
      ).rows![0].n,
      0,
    );
    await f.db.exec("DROP TRIGGER fail_note_move");
    const races = await Promise.allSettled([
      commandSession(f.db, f.id, f.owner, command),
      commandSession(f.db, f.id, f.owner, {
        ...command,
        id: crypto.randomUUID(),
        categoryId: initial.categories[2].id,
      }),
    ]);
    assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
    for (const result of races)
      if (result.status === "rejected") {
        assert.ok(result.reason instanceof CommandError);
        assert.equal(result.reason.code, "conflict");
      }
    const now = await f.read();
    const moveOrAdvance = await Promise.allSettled([
      commandSession(f.db, f.id, f.owner, {
        ...command,
        id: crypto.randomUUID(),
        revision: now.revision,
        fromCategory: now.cards[0].categoryId,
        categoryId: initial.categories[3].id,
      }),
      commandSession(f.db, f.id, f.owner, {
        id: crypto.randomUUID(),
        revision: now.revision,
        kind: "advance",
      }),
    ]);
    assert.equal(
      moveOrAdvance.filter((r) => r.status === "fulfilled").length,
      1,
    );
    const end = await f.read();
    if (end.state.stage === "group") assert.deepEqual(end.cards, now.cards);
    else assert.equal(end.cards[0].categoryId, initial.categories[3].id);
  });
  async function closedFixture() {
    const f = await fixture(2);
    await f.command("advance");
    await f.command("advance");
    let v = await f.read();
    await f.command("ballot", { ballot: v.state.ballot, value: false });
    await f.command("advance");
    v = await f.read();
    const topic = topics(v)[0].id;
    await f.command("decision", { topic, text: "Original agreement" });
    await f.command("propose", {
      topic,
      text: "Original action",
      owner: f.participant,
    });
    await f.command("advance");
    await f.command("advance");
    return { ...f, topic };
  }
  it("reopens only for the facilitator, preserves the dated closure and current progress, and records a distinct second version", async () => {
    const f = await closedFixture(),
      closed = await f.read(),
      original = await readMeetingRecord(f.db, f.id, 1);
    assert.ok(original);
    assert.deepEqual(original.closure, closed.state.closure);
    assert.equal(closed.history!.length, 1);
    await f.reject(
      () => f.command("reopen", { version: 1 }, f.participant),
      "forbidden",
    );
    await f.reject(() => f.command("reopen", { version: 2 }), "conflict");
    await f.command(
      "complete",
      { proposal: closed.state.proposals[0].id, value: true },
      f.participant,
    );
    let before = await f.read(),
      intent = {
        id: crypto.randomUUID(),
        revision: before.revision,
        kind: "reopen",
        version: 1,
      };
    const reopened = await commandSession(f.db, f.id, f.owner, intent);
    assert.equal(reopened.state.stage, "discuss");
    assert.equal(reopened.state.closure, null);
    assert.equal(reopened.state.closureVersion, 1);
    assert.equal(reopened.state.proposals[0].completed, true);
    assert.deepEqual(reopened.cards, closed.cards);
    assert.deepEqual(reopened.categories, closed.categories);
    assert.deepEqual(reopened.state.votes, closed.state.votes);
    assert.deepEqual(reopened.state.decisions, closed.state.decisions);
    assert.deepEqual(await readMeetingRecord(f.db, f.id, 1), original);
    assert.equal(
      (await commandSession(f.db, f.id, f.owner, intent)).revision,
      reopened.revision,
    );
    await f.reject(() => f.command("reopen", { version: 1 }), "locked");
    await f.command("decision", { topic: f.topic, text: "Revised agreement" });
    await f.command("advance");
    await f.command("advance");
    const second = await f.read();
    assert.equal(second.state.closureVersion, 2);
    assert.deepEqual(
      second.history!.map((r) => r.version),
      [2, 1],
    );
    assert.equal(
      (await readMeetingRecord(f.db, f.id, 2))!.closure.decisions[f.topic],
      "Revised agreement",
    );
    assert.deepEqual(await readMeetingRecord(f.db, f.id, 1), original);
    assert.equal(
      (await commandSession(f.db, f.id, f.owner, intent)).state.stage,
      "summary",
    );
    assert.equal((await f.read()).history!.length, 2);
  });
  it("serializes competing reopen commands and forbids archive rewriting, deletion, and arbitrary closure clearing", async () => {
    const f = await closedFixture(),
      v = await f.read();
    for (const statement of [
      "UPDATE guided_closures SET snapshot='{}' WHERE board_id=?",
      "DELETE FROM guided_closures WHERE board_id=?",
      "UPDATE guided_sessions SET data=json_set(data,'$.closure',NULL,'$.stage','discuss') WHERE board_id=?",
      "UPDATE guided_sessions SET data=json_set(data,'$.closureVersion',4) WHERE board_id=?",
    ]) {
      let blocked = false;
      try {
        await f.db.exec(statement, [f.id]);
      } catch {
        blocked = true;
      }
      assert.ok(blocked);
    }
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        commandSession(f.db, f.id, f.owner, {
          id: crypto.randomUUID(),
          revision: v.revision,
          kind: "reopen",
          version: 1,
        }),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (results.find((r) => r.status === "rejected") as PromiseRejectedResult)
        .reason.code,
      "conflict",
    );
    assert.equal((await f.read()).history!.length, 1);
    await f.db.exec("DELETE FROM boards WHERE id=?", [f.id]);
    assert.equal(
      (
        await f.db.exec(
          "SELECT count(*) AS n FROM guided_closures WHERE board_id=?",
          [f.id],
        )
      ).rows![0].n,
      0,
    );
  });
  it("rolls back closure, archive and receipt together when archive storage fails, allowing the identical command to retry", async () => {
    const f = await fixture(1);
    await f.command("advance");
    await f.command("advance");
    let v = await f.read();
    await f.command("ballot", { ballot: v.state.ballot, value: false });
    await f.command("advance");
    await f.command("advance");
    v = await f.read();
    await f.db.executeScript(
      "CREATE TRIGGER fail_archive BEFORE INSERT ON guided_closures BEGIN SELECT RAISE(ABORT,'storage_unavailable'); END;",
    );
    const intent = {
      id: crypto.randomUUID(),
      revision: v.revision,
      kind: "advance",
    };
    let failed = false;
    try {
      await commandSession(f.db, f.id, f.owner, intent);
    } catch {
      failed = true;
    }
    assert.ok(failed);
    const unchanged = await f.read();
    assert.equal(unchanged.revision, v.revision);
    assert.equal(unchanged.state.stage, "actions");
    assert.equal(unchanged.state.closure, null);
    assert.equal(unchanged.history!.length, 0);
    assert.equal(
      (
        await f.db.exec(
          "SELECT count(*) AS n FROM guided_command_receipts WHERE command_id=?",
          [intent.id],
        )
      ).rows![0].n,
      0,
    );
    await f.db.executeScript("DROP TRIGGER fail_archive;");
    assert.equal(
      (await commandSession(f.db, f.id, f.owner, intent)).state.stage,
      "summary",
    );
    assert.equal((await f.read()).history!.length, 1);
  });
  it("adds ungrouped notes to an existing theme without changing its identity or evidence and replays retries once", async () => {
    let f = await fixture(),
      original = await f.read(),
      ids = original.cards.map((c) => c.id);
    await f.command("advance");
    await f.command("theme", { title: "Delivery", notes: [ids[0]] });
    let before = await f.read(),
      theme = before.state.themes[0];
    let append = {
      id: crypto.randomUUID(),
      revision: before.revision,
      kind: "theme",
      theme: theme.id,
      notes: [ids[1], ids[2]],
    };
    let after = await commandSession(f.db, f.id, f.owner, append);
    assert.deepEqual(after.state.themes, [
      { ...theme, notes: ids.slice(0, 3) },
    ]);
    assert.deepEqual(after.cards, original.cards);
    assert.equal(
      (await commandSession(f.db, f.id, f.owner, append)).revision,
      after.revision,
    );
    await f.reject(
      () =>
        f.command("theme", { theme: theme.id, notes: [ids[3]] }, f.participant),
      "forbidden",
    );
    for (const fields of [
      { theme: theme.id, notes: [ids[0]] },
      { theme: theme.id, notes: [] },
      { theme: theme.id, notes: [ids[3], ids[3]] },
      {
        theme: crypto.randomUUID(),
        title: "Cannot fall back to creating",
        notes: [ids[3]],
      },
      { theme: theme.id, notes: [crypto.randomUUID()] },
    ])
      await f.reject(() => f.command("theme", fields), "invalid");
    assert.deepEqual((await f.read()).state.themes, after.state.themes);
    await f.command("advance");
    await f.reject(
      () => f.command("theme", { theme: theme.id, notes: [ids[3]] }),
      "locked",
    );
  });
  it("keeps theme names unique per board on create and rename using normalized names while preserving rejected commands", async () => {
    let f = await fixture(),
      ids = (await f.read()).cards.map((c) => c.id);
    await f.command("advance");
    await f.command("theme", { title: " Delivery  health ", notes: [ids[0]] });
    let first = (await f.read()).state.themes[0];
    for (const title of [
      "Delivery  health",
      "delivery health",
      "  DELIVERY   HEALTH ",
      "Ｄｅｌｉｖｅｒｙ health",
      "Delivery\u200b health",
    ])
      await f.reject(
        () => f.command("theme", { title, notes: [ids[1]] }),
        "duplicateTheme",
      );
    await f.command("theme", { title: "Quality", notes: [ids[1]] });
    let before = await f.read(),
      second = before.state.themes[1];
    await f.reject(
      () => f.command("rename", { theme: second.id, title: "DELIVERY HEALTH" }),
      "duplicateTheme",
    );
    assert.equal((await f.read()).revision, before.revision);
    await f.command("rename", { theme: first.id, title: "delivery health" });
    await f.command("rename", { theme: second.id, title: "Café" });
    await f.reject(
      () => f.command("theme", { title: "Cafe\u0301", notes: [ids[2]] }),
      "duplicateTheme",
    );
    for (const title of ["", "\u200b", "Bad\nname", "x".repeat(161)])
      await f.reject(
        () => f.command("theme", { title, notes: [ids[2]] }),
        "invalid",
      );
    let other = await fixture(1);
    await other.command("advance");
    await other.command("theme", {
      title: "delivery health",
      notes: [(await other.read()).cards[0].id],
    });
    let otherTheme = (await other.read()).state.themes[0].id;
    await f.reject(
      () => f.command("theme", { theme: otherTheme, notes: [ids[2]] }),
      "invalid",
    );
  });
  it("serializes competing grouping commands so a note and a normalized name cannot acquire multiple themes", async () => {
    let f = await fixture(),
      ids = (await f.read()).cards.map((c) => c.id);
    await f.command("advance");
    await f.command("theme", { title: "One", notes: [ids[0]] });
    await f.command("theme", { title: "Two", notes: [ids[1]] });
    let before = await f.read();
    let results = await Promise.allSettled(
      before.state.themes.map((theme) =>
        commandSession(f.db, f.id, f.owner, {
          id: crypto.randomUUID(),
          revision: before.revision,
          kind: "theme",
          theme: theme.id,
          notes: [ids[2]],
        }),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (results.find((r) => r.status === "rejected") as PromiseRejectedResult)
        .reason.code,
      "conflict",
    );
    assert.equal(
      (await f.read()).state.themes
        .flatMap((t) => t.notes)
        .filter((id) => id === ids[2]).length,
      1,
    );
    before = await f.read();
    let commands = ["New theme", " NEW  THEME "].map((title, i) => ({
      id: crypto.randomUUID(),
      revision: before.revision,
      kind: "theme",
      title,
      notes: [ids[3 + i]],
    }));
    results = await Promise.allSettled(
      commands.map((command) => commandSession(f.db, f.id, f.owner, command)),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    let loser = results.findIndex((r) => r.status === "rejected");
    await f.reject(
      () =>
        f.command("theme", {
          title: commands[loser].title,
          notes: commands[loser].notes,
        }),
      "duplicateTheme",
    );
    assert.equal((await f.read()).state.themes.length, 3);
  });
  it("preserves categories and evidence through grouping, ballot, explicit outcomes and immutable closure", async () => {
    let f = await fixture();
    let original = await f.read();
    assert.deepEqual(
      original.categories.map((c) => c.tone),
      [0, 1, 2, 3],
    );
    await f.command("advance");
    await f.command("theme", {
      title: "Theme",
      notes: original.cards.slice(0, 2).map((c) => c.id),
    });
    let grouped = await f.read();
    assert.equal(topics(grouped).length, 5);
    assert.equal(grouped.cards.length, 6);
    await f.reject(
      () =>
        f.command("theme", {
          title: "Duplicate",
          notes: [original.cards[0].id],
        }),
      "invalid",
    );
    await f.command("advance");
    let vote = await f.read();
    let topic = topics(vote)[0].id;
    await f.command(
      "vote",
      { topic, ballot: vote.state.ballot, value: true },
      f.participant,
    );
    let hidden = viewerPayload(await f.read(), f.owner);
    assert.deepEqual(hidden.counts, {});
    assert.equal(Object.keys(hidden.state.votes).length, 1);
    assert.equal(hidden.cards[0].memberId, f.owner);
    assert.equal(
      viewerPayload(await f.read(), f.participant).cards.find(card=>card.isAnonymous)!.memberId,
      "",
    );
    await f.command("ballot", { ballot: vote.state.ballot, value: false });
    await f.command("advance");
    let discussion = await f.read();
    assert.equal(discussion.state.liveTopic, topic);
    assert.deepEqual(discussion.state.outcomes, {});
    await f.command("decision", {
      topic,
      text: "No action needed for this topic.",
    });
    await f.command("outcome", { topic, value: "discussed" });
    await f.command(
      "propose",
      { text: "Pending suggestion", topic },
      f.participant,
    );
    await f.command("propose", {
      text: "Agreed task",
      owner: f.participant,
      topic,
    });
    await f.command("advance");
    await f.command("advance");
    let closed = await f.read();
    assert.equal(closed.state.stage, "summary");
    assert.ok(closed.state.closure);
    assert.equal(closed.state.closure.proposals[0].disposition, "suggested");
    assert.equal(closed.state.closure.cards.length, 6);
    let historical = JSON.stringify(closed.state.closure),
      task = closed.state.proposals[1];
    await f.command(
      "complete",
      { proposal: task.id, value: true },
      f.participant,
    );
    assert.equal((await f.read()).state.proposals[1].completed, true);
    assert.equal(JSON.stringify((await f.read()).state.closure), historical);
    let tampered = structuredClone(closed.state);
    tampered.closure!.decisions[topic] = "Rewrite";
    let blocked = false;
    try {
      await f.db.exec(
        sql`UPDATE guided_sessions SET data=${JSON.stringify(tampered)} WHERE board_id=${f.id}`,
      );
    } catch {
      blocked = true;
    }
    assert.ok(blocked);
  });
  it("enforces budgets/removal, preserves choices on reopen, rejects stale commands and prevents active regrouping", async () => {
    let f = await fixture();
    await f.command("budget", { value: 1 });
    await f.command("advance");
    await f.command("advance");
    let view = await f.read(),
      [a, b] = topics(view),
      ballot = view.state.ballot;
    await f.command(
      "vote",
      { topic: a.id, ballot, value: true },
      f.participant,
    );
    await f.reject(
      () =>
        f.command("vote", { topic: b.id, ballot, value: true }, f.participant),
      "budget",
    );
    await f.command(
      "vote",
      { topic: a.id, ballot, value: false },
      f.participant,
    );
    await f.command(
      "vote",
      { topic: b.id, ballot, value: true },
      f.participant,
    );
    await f.reject(
      () => f.command("theme", { title: "No", notes: [a.id] }),
      "locked",
    );
    await f.command("ballot", { ballot, value: false });
    await f.command("ballot", { ballot, value: true });
    let reopened = await f.read();
    assert.deepEqual(reopened.state.votes[f.participant], [b.id]);
    assert.equal(reopened.state.ballot, ballot + 1);
    await f.reject(
      () =>
        f.command("vote", { topic: a.id, ballot, value: true }, f.participant),
      "conflict",
    );
  });
  it("serializes competing clients without overspending or silently overwriting commands", async () => {
    let f = await fixture();
    await f.command("budget", { value: 1 });
    await f.command("advance");
    await f.command("advance");
    let view = await f.read(),
      [a, b] = topics(view);
    let commands = [a, b].map((topic) => ({
      id: crypto.randomUUID(),
      revision: view.revision,
      kind: "vote",
      topic: topic.id,
      ballot: view.state.ballot,
      value: true,
    }));
    let results = await Promise.allSettled(
      commands.map((c) => commandSession(f.db, f.id, f.participant, c)),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await f.read()).state.votes[f.participant].length, 1);
    // A close command wins; a vote read before it is rejected at CAS rather than resurrecting it.
    view = await f.read();
    let stale = {
      ...commands[0],
      id: crypto.randomUUID(),
      revision: view.revision,
    };
    await f.command("ballot", { ballot: view.state.ballot, value: false });
    await f.reject(
      () => commandSession(f.db, f.id, f.owner, stale),
      "conflict",
    );
  });
  it("deduplicates an acknowledged/lost-response retry but rejects changed payloads or another actor", async () => {
    let f = await fixture(0),
      v = await f.read(),
      c: Command = {
        id: crypto.randomUUID(),
        revision: v.revision,
        kind: "ready",
        value: true,
      };
    let first = await commandSession(f.db, f.id, f.participant, c);
    let retry = await commandSession(f.db, f.id, f.participant, c);
    assert.equal(retry.revision, first.revision);
    await f.reject(
      () => commandSession(f.db, f.id, f.participant, { ...c, value: false }),
      "invalid",
    );
    await f.reject(() => commandSession(f.db, f.id, f.owner, c), "invalid");
  });
  it("allows empty/zero-vote sessions and deterministic original-order ties without manufacturing outcomes", async () => {
    let f = await fixture(3),
      original = await f.read();
    await f.command("advance");
    await f.command("advance");
    let vote = await f.read();
    await f.command("ballot", { ballot: vote.state.ballot, value: false });
    await f.command("advance");
    assert.deepEqual(
      rankedTopics(await f.read()).map((t) => t.id),
      original.cards.map((c) => c.id),
    );
    assert.deepEqual((await f.read()).state.outcomes, {});
    await f.command("advance");
    await f.command("advance");
    assert.deepEqual((await f.read()).state.closure!.outcomes, {});
    let empty = await fixture(0);
    await empty.command("advance");
    await empty.command("advance");
    let e = await empty.read();
    await empty.command("ballot", { ballot: e.state.ballot, value: false });
    await empty.command("advance");
    await empty.command("advance");
    await empty.command("advance");
    assert.equal((await empty.read()).state.closure!.topics.length, 0);
  });
  it("rejects forged authority, cross-board evidence/owners and note changes outside Collect including direct SQL races", async () => {
    let f = await fixture(1);
    await f.reject(() => f.command("advance", {}, f.participant), "forbidden");
    await f.reject(
      () => f.command("ready", { value: true }, crypto.randomUUID()),
      "forbidden",
    );
    await f.command("advance");
    await f.reject(
      () =>
        f.command("theme", { title: "Forged", notes: [crypto.randomUUID()] }),
      "invalid",
    );
    let c = (await f.read()).cards[0];
    for (let statement of [
      sql`UPDATE cards SET body='late' WHERE id=${c.id}`,
      sql`DELETE FROM cards WHERE id=${c.id}`,
      sql`UPDATE boards SET status='closed' WHERE id=${f.id}`,
    ]) {
      let blocked = false;
      try {
        await f.db.exec(statement);
      } catch {
        blocked = true;
      }
      assert.ok(blocked);
    }
    await f.command("advance");
    let vote = await f.read();
    await f.command("ballot", { ballot: vote.state.ballot, value: false });
    await f.command("advance");
    await f.reject(
      () => f.command("propose", { text: "Task", owner: crypto.randomUUID() }),
      "invalid",
    );
  });
  it("authorises proposal edits separately from disposition/execution, validates real owners/dates and locks history", async () => {
    let f = await fixture(1);
    await f.command("advance");
    await f.command("advance");
    let v = await f.read();
    await f.command("ballot", { ballot: v.state.ballot, value: false });
    await f.command("advance");
    await f.command("propose", { text: "Original suggestion" }, f.participant);
    let p = (await f.read()).state.proposals[0];
    await f.command(
      "edit-proposal",
      {
        proposal: p.id,
        text: "Revised suggestion",
        owner: f.owner,
        due: "2026-12-01",
      },
      f.participant,
    );
    await f.reject(
      () =>
        f.command("edit-proposal", {
          proposal: p.id,
          text: "Invalid date",
          due: "2026-02-31",
        }),
      "invalid",
    );
    await f.command("disposition", { proposal: p.id, value: "agreed" });
    await f.reject(
      () =>
        f.command(
          "edit-proposal",
          { proposal: p.id, text: "Participant cannot rewrite agreement" },
          f.participant,
        ),
      "forbidden",
    );
    await f.command("edit-proposal", {
      proposal: p.id,
      text: "Facilitator revised agreement",
    });
    await f.command("advance");
    await f.command("advance");
    await f.reject(
      () =>
        f.command("edit-proposal", { proposal: p.id, text: "Rewrite history" }),
      "locked",
    );
  });
  it("rate limits command spam without counting a lost-response retry twice", async () => {
    let f = await fixture(0),
      v = await f.read();
    let limited = {
      ...v,
      state: {
        ...v.state,
        recent: { [f.participant]: Array(60).fill(Date.now()) },
      },
    };
    await f.reject(
      async () =>
        applyCommand(limited, f.participant, {
          id: crypto.randomUUID(),
          revision: v.revision,
          kind: "ready",
          value: true,
        }),
      "rate",
    );
    await f.command("ready", { value: true }, f.participant);
    assert.equal((await f.read()).state.recent![f.participant].length, 1);
  });
});

describe("guided session storage", () => {
  async function board() {
    let db = await testDatabase(),
      created = await createBoard(db, {
        title: "Storage",
        organiserDisplayName: "Facilitator",
        categoryLabels: ["A", "B"],
      });
    const rows = async () =>
      Number(
        (
          await db.exec(
            sql`SELECT count(*) AS n FROM guided_sessions WHERE board_id=${created.board.id}`,
          )
        ).rows![0].n,
      );
    return { db, id: created.board.id, rows };
  }

  it("reads without writing: a board with no guided session stays a legacy board", async () => {
    let { db, id, rows } = await board();
    assert.equal(await readSession(db, id), null);
    assert.equal(await readGuidedStatus(db, id), null);
    assert.equal(await rows(), 0);
    assert.equal(await readSession(db, crypto.randomUUID()), null);
  });

  it("creates a session once and reports a repeated create without overwriting it", async () => {
    let { db, id, rows } = await board();
    let first = await createSession(db, id, { requireCategorySetup: true });
    assert.equal(first?.created, true);
    assert.equal(first?.view.state.categorySetup?.confirmed, false);
    let configured = await commandSession(db, id, first!.view.board.organiserMemberId, {
      id: crypto.randomUUID(),
      revision: first!.view.revision,
      kind: "configure",
      choice: "classic",
    });
    let again = await createSession(db, id, { legacy: true });
    assert.equal(again?.created, false);
    assert.equal(again?.view.revision, configured!.revision);
    assert.equal(again?.view.state.legacy, false);
    assert.equal(again?.view.state.categorySetup?.confirmed, true);
    assert.equal(await rows(), 1);
    assert.equal(await createSession(db, crypto.randomUUID()), null);
  });

  it("reports stage, revision and pending category setup in one light read", async () => {
    let { db, id } = await board();
    let { view } = (await createSession(db, id, { requireCategorySetup: true }))!;
    assert.deepEqual(await readGuidedStatus(db, id), {
      stage: "collect",
      revision: view.revision,
      categorySetupRequired: true,
    });
    let next = await commandSession(db, id, view.board.organiserMemberId, {
      id: crypto.randomUUID(),
      revision: view.revision,
      kind: "configure",
      choice: "classic",
    });
    assert.deepEqual(await readGuidedStatus(db, id), {
      stage: "collect",
      revision: next!.revision,
      categorySetupRequired: false,
    });
  });

  it("returns the committed view from a command so callers need not read it again", async () => {
    let { db, id } = await board();
    let { view } = (await createSession(db, id))!;
    let result = await commandSession(db, id, view.board.organiserMemberId, {
      id: crypto.randomUUID(),
      revision: view.revision,
      kind: "ready",
      value: true,
    });
    let reread = (await readSession(db, id))!;
    assert.equal(result!.revision, reread.revision);
    assert.deepEqual(result!.state.ready, reread.state.ready);
    assert.deepEqual(result!.cards, reread.cards);
  });
});
