import {createBoard} from "../app/models/boards/create.ts";
import {createCard} from "../app/models/cards/card.ts";
import {readSession,createSession as createGuidedSession,commandSession,topics,CommandError,readMeetingRecord} from "../app/models/guided/session.ts";
import {createDatabaseSessionStorage} from "../app/session-storage.ts";
import {createSession} from "remix/session";
// Test-only Worker. Never mapped into the application or deployed.
import { column as c, table, and, or, between, inList, notInList, ne, gt, gte, lt, lte, like, ilike, isNull, notNull } from "remix/data-table";
import { createRouter } from "remix/router";
import { openDatabase } from "../bootstrap/database.ts";
import { createD1Driver } from "../bootstrap/d1-driver.ts";
import { loadAppDependencies } from "../app/middleware/dependencies.ts";

const probe = table({
  name: "__connection_probe",
  columns: {
    id: c.integer().primaryKey(),
    body: c.text(),
    enabled: c.boolean().nullable(),
    payload: c.json().nullable(),
  },
});
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export default {
  async fetch(request, env) {
    let db = openDatabase(env.DB);
    check(openDatabase(env.DB) === db, "database service should be cached by binding");
    let router = createRouter({ middleware: [loadAppDependencies({ db, config: { appEnv: "test" }, waitUntil() {} })] });
    router.post("/smoke", async (context) => {
      let db = context.db;
      let driver = createD1Driver(env.DB);
      await db.executeScript('CREATE TABLE "__connection_probe" (id INTEGER PRIMARY KEY, body TEXT NOT NULL, enabled INTEGER, payload TEXT);');
      try {
        let body = "العربية '); DROP TABLE __connection_probe; --";
        let payload = { text: "مرحبا", nested: [1, true, null] };
        let inserted = await db.create(probe, { id: 1, body, enabled: true, payload }, { returnRow: true });
        check(inserted.body === body && inserted.enabled === true, "binding/RETURNING/boolean normalization");
        check(JSON.stringify(inserted.payload) === JSON.stringify(payload), "JSON RETURNING normalization");
        let found = await db.find(probe, 1);
        check(found?.body === body && found.enabled === true, "typed read/binding normalization");
        check(JSON.stringify(found.payload) === JSON.stringify(payload), "typed JSON read");
        let raw = await db.exec('SELECT enabled, payload FROM "__connection_probe" WHERE id = ?', [1]);
        check(raw.rows?.[0].enabled === 1 && raw.rows[0].payload === JSON.stringify(payload), "raw storage encoding");
        let bulk = await db.createMany(probe, [
          { id: 2, body: "two", enabled: false, payload: null },
          { id: 3, body: "three", enabled: null, payload: { a: 1 } },
        ]);
        check(bulk.affectedRows === 2, "bulk insert affected rows");
        let selected = await db.query(probe).where({ id: 1 }).select({ active: probe.enabled, data: probe.payload }).first();
        check(selected?.active === true && JSON.stringify(selected.data) === JSON.stringify(payload), "aliased normalization");
        let filters = [
          and(gte("id", 1), lte("id", 3)), or(gt("id", 2), lt("id", 2)),
          between("id", 1, 2), inList("id", [1, 3]), notInList("id", [2]), ne("id", 2),
          like("body", "t%"), ilike("body", "T%"), isNull("enabled"), notNull("enabled"),
          inList("id", []), notInList("id", []),
        ];
        let expected = [3, 2, 2, 2, 2, 2, 2, 2, 1, 2, 0, 3];
        for (let [index, filter] of filters.entries()) {
          check((await db.findMany(probe, { where: filter })).length === expected[index], `predicate ${index}`);
        }
        check((await db.findMany(probe, { where: { enabled: false } })).length === 1, "boolean predicate binding");
        check((await db.exec("SELECT ? AS flag", [true])).rows?.[0].flag === 1, "raw boolean binding");
        let nullable = await db.find(probe, 3);
        check(nullable?.enabled === null, "nullable boolean");
        let offset = await db.findMany(probe, { offset: 1, orderBy: ["id", "asc"] });
        check(offset.length === 2 && offset[0].enabled === false, "offset without limit/false boolean");
        check(await db.count(probe) === 3 && await db.query(probe).where({ id: 1 }).exists(), "count/exists normalization");
        let updated = await db.update(probe, 2, { enabled: true, payload: { updated: true } });
        check(updated?.enabled === true && JSON.stringify(updated.payload) === '{"updated":true}', "typed update RETURNING");
        let changed = await db.exec('UPDATE "__connection_probe" SET body = ? WHERE id = ? RETURNING id', ["changed", 1]);
        check(changed.affectedRows === 1 && changed.rows?.[0].id === 1, "raw write RETURNING");
        check(await driver.hasTable({ name: "__connection_probe" }), "hasTable");
        check(await driver.hasColumn({ name: "__connection_probe" }, "body"), "hasColumn");
        check(!await driver.hasColumn({ name: "__connection_probe" }, "absent"), "missing column");
        let deleted = await db.delete(probe, 2);
        check(deleted === true && await db.find(probe, 2) === null, "delete normalization");
        let invoked = false;
        let rejected = false;
        try { await db.transaction(async () => { invoked = true; }); } catch { rejected = true; }
        check(rejected && !invoked, "transaction must reject before callback");
        for (let attempt of [
          () => driver.createSavepoint({ id: "not-a-transaction" }, "s"),
          () => driver.rollbackTransaction({ id: "not-a-transaction" }),
          () => driver.wipe(),
          () => db.query(probe).upsert({ id: 1, body: "unsupported" }),
          () => db.query(probe).groupBy("enabled").all(),
        ]) {
          let rejected = false;
          try { await attempt(); } catch { rejected = true; }
          check(rejected, "unsupported capability must fail explicitly");
        }
        // One failed multi-row statement must leave none of its rows behind.
        let failed = false;
        try {
          await db.createMany(probe, [
            { id: 4, body: "should not persist", enabled: true, payload: null },
            { id: 1, body: "duplicate", enabled: true, payload: null },
          ]);
        } catch { failed = true; }
        check(failed && await db.find(probe, 4) === null, "single-statement atomicity");
        // Separate statements have no automatic rollback.
        await db.create(probe, { id: 5, body: "committed", enabled: false, payload: null });
        try { await db.exec('INSERT INTO "__connection_probe" (id, body) VALUES (?, ?)', [5, "duplicate"]); } catch { /* expected */ }
        check((await db.find(probe, 5))?.body === "committed", "earlier statements remain committed");
        return Response.json({ ok: true, capabilities: db.capabilities });
      } finally {
        await db.exec('DROP TABLE "__connection_probe"');
      }
    });
    router.post("/guided-smoke", async () => {
      let exists = (
        await db.exec(
          "SELECT 1 FROM sqlite_master WHERE name='guided_sessions'",
        )
      ).rows?.length;
      check(
        exists,
        "Local Wrangler migrations must be applied before guided smoke",
      );
      let created = await createBoard(db, {
        title: "D1 guided session",
        organiserDisplayName: "Facilitator",
        categoryLabels: ["A", "B", "C", "D"],
      });
      let id = created.board.id,
        actor = created.organiser.id;
      await createGuidedSession(db, id, { requireCategorySetup: true });
      let beforeSetup = (await readSession(db, id))!;
      let blocked = false;
      try {
        await createCard(db, {
          id: crypto.randomUUID(), boardId: id, memberId: actor,
          categoryId: created.categories[0].id, body: "Before setup", isAnonymous: false,
        }, crypto.randomUUID());
      } catch { blocked = true; }
      check(blocked && (await readSession(db, id))!.cards.length === 0, "D1 must reject notes before category setup");
      let setup = {id: crypto.randomUUID(), revision: beforeSetup.revision, kind: "configure", choice: "custom", labels: ["Keep", "Change", "Try", "Appreciate"]};
      let configured = await commandSession(db, id, actor, setup);
      check(configured.categories.map(c => c.label).join(",") === "Keep,Change,Try,Appreciate", "D1 category trigger must replace categories in the setup command");
      check(configured.categories.every((c, i) => c.tone === i), "D1 persists category tones");
      check((await commandSession(db, id, actor, setup)).revision === configured.revision, "D1 category setup retry must be idempotent");
      for (let i = 0; i < 2; i++)
        await createCard(
          db,
          {
            id: crypto.randomUUID(),
            boardId: id,
            memberId: actor,
            categoryId: configured.categories[i].id,
            body: `D1 note ${i}`,
            isAnonymous: false,
          },
          crypto.randomUUID(),
        );
      async function command(
        kind: string,
        fields: Record<string, unknown> = {},
      ) {
        let v = (await readSession(db, id))!;
        return commandSession(db, id, actor, {
          id: crypto.randomUUID(),
          revision: v.revision,
          kind,
          ...fields,
        });
      }
      const moveView = (await readSession(db, id))!;
      const moveNote = moveView.cards[0];
      const moveCommand = {
        id: crypto.randomUUID(),
        revision: moveView.revision,
        kind: "move-note",
        card: moveNote.id,
        fromCategory: moveNote.categoryId,
        categoryId: configured.categories[3].id,
      };
      const moved = await commandSession(db, id, actor, moveCommand);
      check(
        moved.cards[0].categoryId === moveCommand.categoryId,
        "D1 atomically moves the note category",
      );
      check(
        moved.cards[0].body === moveNote.body &&
          moved.cards[0].memberId === moveNote.memberId,
        "D1 preserves note evidence and authorship",
      );
      check(
        (await commandSession(db, id, actor, moveCommand)).revision ===
          moved.revision,
        "D1 category move retry is idempotent",
      );
      await command("advance");
      let source = (await readSession(db, id))!.cards;
      let grouped = await command("theme", {title: "Delivery", notes: [source[0].id]});
      let theme = grouped.state.themes[0];
      let append = {id: crypto.randomUUID(), revision: grouped.revision, kind: "theme", theme: theme.id, notes: [source[1].id]};
      let appended = await commandSession(db, id, actor, append);
      check(appended.state.themes.length === 1 && appended.state.themes[0].notes.length === 2, "D1 appends selected notes to the original theme");
      check((await commandSession(db, id, actor, append)).revision === appended.revision, "D1 append retry must be idempotent");
      await command("ungroup", {theme: theme.id});
      await command("budget", { value: 1 });
      await command("advance");
      let v = (await readSession(db, id))!,
        eligible = topics(v);
      let competing = await Promise.allSettled(
        eligible.map((t) =>
          commandSession(db, id, actor, {
            id: crypto.randomUUID(),
            revision: v.revision,
            kind: "vote",
            topic: t.id,
            ballot: v.state.ballot,
            value: true,
          }),
        ),
      );
      check(
        competing.filter((r) => r.status === "fulfilled").length === 1,
        "D1 compare-and-swap must serialize competing votes",
      );
      check(
        (await readSession(db, id))!.state.votes[actor].length === 1,
        "D1 allowance remains one",
      );
      let beforeClose = (await readSession(db, id))!;
      await command("ballot", {
        ballot: beforeClose.state.ballot,
        value: false,
      });
      let stale = false;
      try {
        await commandSession(db, id, actor, {
          id: crypto.randomUUID(),
          revision: beforeClose.revision,
          kind: "vote",
          topic: eligible[1].id,
          ballot: beforeClose.state.ballot,
          value: true,
        });
      } catch (e) {
        stale = e instanceof CommandError;
      }
      check(stale, "D1 stale ballot rejection");
      await command("advance");
      await command("advance");
      await command("advance");
      let closed = (await readSession(db, id))!;
      check(
        closed.state.closure?.cards.length === 2,
        "D1 immutable closure contains source evidence",
      );
      const firstRecord = JSON.stringify(
        (await readMeetingRecord(db, id, 1))!.closure,
      );
      await command("reopen", { version: 1 });
      check(
        (await readSession(db, id))!.state.stage === "discuss",
        "D1 reopens at Discuss",
      );
      await command("decision", {
        topic: eligible[0].id,
        text: "Revised agreement",
      });
      await command("advance");
      await command("advance");
      check(
        (await readSession(db, id))!.history?.length === 2,
        "D1 preserves two closure versions",
      );
      check(
        JSON.stringify((await readMeetingRecord(db, id, 1))!.closure) ===
          firstRecord,
        "D1 first record remains unchanged after reopening/reclosing",
      );
      let session = createSession();
      session.set(`board-member:${id}`, actor);
      let token = await createDatabaseSessionStorage(db).save(session);
      check(
        (await createDatabaseSessionStorage(db).read(token)).get(
          `board-member:${id}`,
        ) === actor,
        "D1 storage survives fresh instances",
      );
      return Response.json({
        ok: true,
        guided: true,
        competingVotes: 1,
        sourceNotes: 2,
      });
    });
    return router.fetch(request);
  },
} satisfies ExportedHandler<{ DB: D1Database }>;
