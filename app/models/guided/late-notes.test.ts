import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { sql } from "remix/data-table";
import { testDatabase } from "../../test/dependencies.ts";
import { createBoard } from "../boards/create.ts";
import { createCard } from "../cards/card.ts";
import { joinBoard } from "../boards/join.ts";
import {
  commandSession,
  createSession,
  readGuidedStatus,
  readSession,
  topics,
  CommandError,
} from "./session.ts";

async function fixture() {
  let db = await testDatabase();
  let created = await createBoard(db, {
    title: "Late notes",
    organiserDisplayName: "Facilitator",
    categoryLabels: ["A", "B"],
  });
  let id = created.board.id,
    owner = created.organiser.id,
    category = created.categories[0].id;
  let joined = await joinBoard(db, id, "Participant");
  assert.ok(joined?.ok);
  let participant = joined.member.id;
  await createSession(db, id);
  const read = async () => (await readSession(db, id))!;
  const command = async (
    kind: string,
    fields: Record<string, unknown> = {},
    actor = owner,
  ) =>
    commandSession(db, id, actor, {
      id: crypto.randomUUID(),
      revision: (await read()).revision,
      kind,
      ...fields,
    });
  const add = async (body: string, memberId = owner) => {
    let cardId = crypto.randomUUID();
    await createCard(
      db,
      { id: cardId, boardId: id, memberId, categoryId: category, body, isAnonymous: false },
      crypto.randomUUID(),
      { maxCards: 100, windowMs: 1000 },
    );
    return cardId;
  };
  const rejects = async (fn: () => Promise<unknown>, code?: string) => {
    try {
      await fn();
    } catch (error) {
      if (code) {
        assert.ok(error instanceof CommandError, String(error));
        assert.equal(error.code, code);
      }
      return;
    }
    assert.fail("expected rejection");
  };
  return { db, id, owner, participant, read, command, add, rejects };
}

/** Collect two notes, group them, run an empty ballot and enter Discuss. */
async function toDiscuss(f: Awaited<ReturnType<typeof fixture>>) {
  let grouped = [await f.add("First"), await f.add("Second")];
  let loose = await f.add("Loose");
  await f.command("advance");
  await f.command("theme", { title: "Pair", notes: grouped });
  await f.command("advance");
  await f.command("ballot", { ballot: (await f.read()).state.ballot, value: false });
  await f.command("advance");
  let theme = (await f.read()).state.themes[0];
  return { theme, loose };
}

describe("reopened note-taking after Collect", () => {
  it("lets only the facilitator reopen notes in Group or Discuss, and any stage change closes them", async () => {
    let f = await fixture();
    await f.add("Collected");
    await f.rejects(() => f.command("notes", { value: true }), "locked");
    await f.command("advance");
    await f.rejects(() => f.add("Too late"));
    await f.rejects(
      () => f.command("notes", { value: true }, f.participant),
      "forbidden",
    );
    await f.rejects(() => f.command("notes", { value: "yes" }), "invalid");
    await f.command("notes", { value: true });
    assert.equal((await readGuidedStatus(f.db, f.id))?.notesOpen, true);

    let late = await f.add("Late idea", f.participant);
    assert.ok((await f.read()).cards.some((c) => c.id === late));
    assert.ok(topics(await f.read()).some((t) => t.id === late));
    // Only adding is reopened: edits and deletes stay Collect-only.
    for (let statement of [
      sql`UPDATE cards SET body='changed' WHERE id=${late}`,
      sql`DELETE FROM cards WHERE id=${late}`,
    ]) {
      await f.rejects(() => f.db.exec(statement));
    }

    await f.command("advance");
    assert.equal((await f.read()).state.notesOpen, false);
    await f.rejects(() => f.add("During the ballot"));
    await f.rejects(() => f.command("notes", { value: true }), "locked");
  });

  it("rejects a forged notesOpen in Vote at the database guard", async () => {
    let f = await fixture();
    await f.add("Collected");
    await f.command("advance");
    await f.command("advance");
    let view = await f.read();
    await f.db.exec(
      sql`UPDATE guided_sessions SET data=${JSON.stringify({ ...view.state, notesOpen: true })} WHERE board_id=${f.id}`,
    );
    await f.rejects(() => f.add("Smuggled"));
  });

  it("attaches a note added in Discuss to a theme, or turns an ungrouped topic into a theme with the same id", async () => {
    let f = await fixture();
    let { theme, loose } = await toDiscuss(f);
    await f.command("decision", { topic: loose, text: "Keep it" });
    await f.command("notes", { value: true });

    let forTheme = await f.add("More on the pair", f.participant);
    await f.command("attach-note", { card: forTheme, topic: theme.id }, f.participant);
    let view = await f.read();
    assert.deepEqual(
      view.state.themes.find((t) => t.id === theme.id)?.notes,
      [...theme.notes, forTheme],
    );
    assert.ok(!topics(view).some((t) => t.id === forTheme));

    let forLoose = await f.add("More on loose", f.participant);
    await f.command("attach-note", { card: forLoose, topic: loose }, f.participant);
    view = await f.read();
    let promoted = view.state.themes.find((t) => t.id === loose);
    assert.deepEqual(promoted, { id: loose, title: "Loose", notes: [loose, forLoose] });
    assert.equal(view.state.decisions[loose], "Keep it");
    assert.equal(topics(view).filter((t) => t.id === loose).length, 1);
    assert.ok(!topics(view).some((t) => t.id === forLoose));
  });

  it("refuses to attach someone else's note, a note twice, a note to itself, or while notes are closed", async () => {
    let f = await fixture();
    let { theme } = await toDiscuss(f);
    await f.command("notes", { value: true });
    let mine = await f.add("Mine", f.participant);
    await f.rejects(
      () => f.command("attach-note", { card: mine, topic: theme.id }),
      "invalid",
    );
    await f.rejects(
      () => f.command("attach-note", { card: mine, topic: mine }, f.participant),
      "invalid",
    );
    await f.command("attach-note", { card: mine, topic: theme.id }, f.participant);
    await f.rejects(
      () => f.command("attach-note", { card: mine, topic: theme.id }, f.participant),
      "conflict",
    );
    let other = await f.add("Other", f.participant);
    await f.command("notes", { value: false });
    await f.rejects(
      () => f.command("attach-note", { card: other, topic: theme.id }, f.participant),
      "locked",
    );
    await f.rejects(() => f.add("Closed again"));
  });
});
