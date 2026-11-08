import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { migrationsDirectory, createTestDatabase } from "../../test/db.ts";
import { insertMember, MemberNameTakenError } from "./member.ts";

// 0006 runs against a production database that already holds members, so it is tested on one:
// build the schema up to 0005, insert rows the old way, then apply 0006.

async function legacyDatabase() {
  let directory = await mkdtemp(join(tmpdir(), "taqyeem-legacy-"));
  try {
    let source = new URL(".", migrationsDirectory).pathname;
    for (let file of await readdir(source)) {
      if (/^000[1-5].*\.sql$/.test(file)) await cp(join(source, file), join(directory, file));
    }
    let db = await createTestDatabase(pathToFileURL(directory + "/"));
    return db;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function applyNameKeyMigration(db: Awaited<ReturnType<typeof createTestDatabase>>) {
  let sql = await readFile(new URL("0006_member_name_key.sql", migrationsDirectory), "utf8");
  await db.executeScript(sql);
}

async function rows(db: Awaited<ReturnType<typeof createTestDatabase>>) {
  return (await db.exec("SELECT id, board_id, display_name, name_key FROM members ORDER BY rowid")).rows as {
    id: string;
    board_id: string;
    display_name: string;
    name_key: string | null;
  }[];
}

describe("0006_member_name_key on existing data", () => {
  it("fills a key for every existing member", async () => {
    let db = await legacyDatabase();
    try {
      await db.exec("INSERT INTO boards (id, title) VALUES ('b1', 'Board')");
      await db.exec("INSERT INTO members (id, board_id, display_name, role) VALUES ('m1', 'b1', 'Sam', 'organiser'), ('m2', 'b1', '  Pat  ', 'participant')");
      await applyNameKeyMigration(db);
      assert.deepEqual(
        (await rows(db)).map((r) => [r.id, r.display_name, r.name_key]),
        [["m1", "Sam", "sam"], ["m2", "  Pat  ", "pat"]],
      );
    } finally {
      await db.close();
    }
  });

  it("does not fail when a board already has two members with the same name", async () => {
    let db = await legacyDatabase();
    try {
      await db.exec("INSERT INTO boards (id, title) VALUES ('b1', 'Board'), ('b2', 'Other')");
      await db.exec(`INSERT INTO members (id, board_id, display_name, role) VALUES
        ('m1', 'b1', 'Pat', 'organiser'),
        ('m2', 'b1', 'pat', 'participant'),
        ('m3', 'b1', ' PAT ', 'participant'),
        ('m4', 'b2', 'Pat', 'organiser')`);
      await applyNameKeyMigration(db); // would throw on the unique index without the de-duplication
      let all = await rows(db);
      // The first holder keeps the plain key; later duplicates get an id-suffixed key.
      assert.deepEqual(
        all.map((r) => [r.id, r.name_key]),
        [["m1", "pat"], ["m2", "pat#m2"], ["m3", "pat#m3"], ["m4", "pat"]],
      );
      // Nobody is renamed or removed.
      assert.deepEqual(all.map((r) => r.display_name), ["Pat", "pat", " PAT ", "Pat"]);
      assert.equal(new Set(all.map((r) => `${r.board_id}:${r.name_key}`)).size, 4);
    } finally {
      await db.close();
    }
  });

  it("enforces uniqueness for new members once applied, including against old rows", async () => {
    let db = await legacyDatabase();
    try {
      await db.exec("INSERT INTO boards (id, title) VALUES ('b1', 'Board')");
      await db.exec("INSERT INTO members (id, board_id, display_name, role) VALUES ('m1', 'b1', 'Sam', 'organiser')");
      await applyNameKeyMigration(db);
      await assert.rejects(
        () => insertMember(db, { boardId: "b1", displayName: "SAM", role: "participant" }),
        MemberNameTakenError,
      );
      await insertMember(db, { boardId: "b1", displayName: "Pat", role: "participant" });
      assert.equal((await rows(db)).length, 2);
    } finally {
      await db.close();
    }
  });

  it("leaves the cards and votes of existing members in place", async () => {
    let db = await legacyDatabase();
    try {
      await db.exec("INSERT INTO boards (id, title) VALUES ('b1', 'Board')");
      await db.exec("INSERT INTO members (id, board_id, display_name, role) VALUES ('m1', 'b1', 'Sam', 'organiser')");
      await db.exec("INSERT INTO categories (id, board_id, label, position) VALUES ('c1', 'b1', 'Good', 0)");
      await db.exec("INSERT INTO cards (id, board_id, category_id, member_id, submission_id, body) VALUES ('k1', 'b1', 'c1', 'm1', 's1', 'Note')");
      await db.exec("INSERT INTO votes (card_id, member_id, board_id) VALUES ('k1', 'm1', 'b1')");
      await applyNameKeyMigration(db);
      assert.equal((await db.exec("SELECT count(*) AS n FROM cards")).rows?.[0].n, 1);
      assert.equal((await db.exec("SELECT count(*) AS n FROM votes")).rows?.[0].n, 1);
    } finally {
      await db.close();
    }
  });
});
