import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createTestDatabase } from "./db.ts";

describe("SQLite test harness", () => {
  it("replays numbered SQL scripts in order, supports multiple statements, and isolates databases", async () => {
    let directory = await mkdtemp(join(tmpdir(), "taqyeem-migrations-"));
    let url = pathToFileURL(directory + "/");
    try {
      await writeFile(new URL("0002_seed.sql", url), "INSERT INTO probe VALUES (1, 'seed'); INSERT INTO probe VALUES (2, 'second');");
      await writeFile(new URL("0001_create.sql", url), "CREATE TABLE probe (id INTEGER PRIMARY KEY, body TEXT);");
      await writeFile(new URL("README.md", url), "This is not SQL.");
      let first = await createTestDatabase(url);
      let second = await createTestDatabase(url);
      try {
        assert.deepEqual((await first.exec("SELECT * FROM probe ORDER BY id")).rows, [{ id: 1, body: "seed" }, { id: 2, body: "second" }]);
        await first.exec("DELETE FROM probe");
        assert.equal((await second.exec("SELECT count(*) AS total FROM probe")).rows?.[0].total, 2);
        assert.equal((await first.exec("PRAGMA foreign_keys")).rows?.[0].foreign_keys, 1);
      } finally {
        await first.close();
        await second.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects broken migrations instead of returning a partially migrated database", async () => {
    let directory = await mkdtemp(join(tmpdir(), "taqyeem-bad-migration-"));
    try {
      await writeFile(join(directory, "0001_invalid.sql"), "INVALID SQL");
      await assert.rejects(() => createTestDatabase(pathToFileURL(directory + "/")));
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
