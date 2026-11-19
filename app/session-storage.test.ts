import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { sql } from "remix/data-table";
import { createSession } from "remix/session";
import { testDatabase } from "./test/dependencies.ts";
import { createDatabaseSessionStorage } from "./session-storage.ts";
import { createAppRouter } from "./router.ts";

const options = {
  sessionSecret: "test-only-durable-secret",
  config: { appEnv: "test" },
  waitUntil() {},
};
describe("durable browser identity", () => {
  it("restores signed membership across independent routers/storage objects and rejects tampered or expired cookies", async () => {
    let db = await testDatabase(),
      first = createAppRouter({ ...options, db });
    let response = await first.fetch("http://localhost/boards/new", {
      method: "POST",
      body: new URLSearchParams({
        title: "Durable",
        organiserDisplayName: "Owner",
      }),
    });
    let path = response.headers.get("Location")!,
      cookie = response.headers
        .getSetCookie()
        .find((c) => c.startsWith("taqyeem_session="))!
        .split(";")[0];
    let second = createAppRouter({ ...options, db });
    let view = await second.fetch("http://localhost" + path + "/session", {
      headers: { Cookie: cookie },
    });
    assert.equal(view.status, 200);
    let payload = (await view.json()) as {
      memberId: string;
      board: { organiserMemberId: string };
    };
    assert.equal(payload.memberId, payload.board.organiserMemberId);
    let tampered = await second.fetch("http://localhost" + path + "/session", {
      headers: { Cookie: cookie + "x", Accept: "application/json" },
    });
    assert.equal(tampered.status, 403);
    await db.exec(sql`UPDATE browser_sessions SET expires_at=unixepoch()-1`);
    let expired = await second.fetch("http://localhost" + path + "/session", {
      headers: { Cookie: cookie, Accept: "application/json" },
    });
    assert.equal(expired.status, 403);
  });
  it("never trusts unknown session ids, rotates and deletes old sessions, and preserves multiple board memberships", async () => {
    let db = await testDatabase(),
      storage = createDatabaseSessionStorage(db),
      unknown = crypto.randomUUID();
    assert.ok((await storage.read(unknown)).id !== unknown);
    let session = createSession();
    session.set("board-member:a", "organiser-a");
    session.set("board-member:b", "participant-b");
    let old = (await storage.save(session))!;
    let fresh = await createDatabaseSessionStorage(db).read(old);
    assert.equal(fresh.get("board-member:a"), "organiser-a");
    fresh.regenerateId(true);
    let next = (await storage.save(fresh))!;
    assert.ok(next !== old);
    assert.equal(
      (await storage.read(next)).get("board-member:b"),
      "participant-b",
    );
    assert.equal((await storage.read(old)).get("board-member:a"), undefined);
    fresh.destroy();
    assert.equal(await storage.save(fresh), "");
    assert.equal((await storage.read(next)).get("board-member:a"), undefined);
  });
  it("supports a signing-key rotation ring without changing member identity", async () => {
    let db = await testDatabase(),
      old = createAppRouter({ ...options, db });
    let created = await old.fetch("http://localhost/boards/new", {
      method: "POST",
      body: new URLSearchParams({
        title: "Rotation",
        organiserDisplayName: "Owner",
      }),
    });
    let path = created.headers.get("Location")!,
      cookie = created.headers
        .getSetCookie()
        .find((c) => c.startsWith("taqyeem_session="))!
        .split(";")[0];
    let rotated = createAppRouter({
      ...options,
      db,
      sessionSecret: ["replacement-secret", options.sessionSecret],
    });
    let response = await rotated.fetch("http://localhost" + path + "/session", {
      headers: { Cookie: cookie },
    });
    assert.equal(response.status, 200);
    let data = (await response.json()) as {
      memberId: string;
      board: { organiserMemberId: string };
    };
    assert.equal(data.memberId, data.board.organiserMemberId);
  });

  it("never retires an existing identity before its successor is durably written", async () => {
    let db = await testDatabase(),
      storage = createDatabaseSessionStorage(db),
      session = createSession();
    session.set("board-member:a", "owner");
    let id = (await storage.save(session))!;
    let next = await storage.read(id);
    next.regenerateId(true);
    next.set("board-member:b", "new-owner");
    let faulty = new Proxy(db, {
      get(target, property) {
        let value = Reflect.get(target, property, target);
        if (property === "exec") {
          return async (statement: unknown, ...args: unknown[]) => {
            if (
              typeof statement === "object" &&
              statement &&
              "text" in statement &&
              String(statement.text).startsWith("INSERT INTO browser_sessions")
            ) {
              throw new Error("Simulated write failure");
            }
            return Reflect.apply(value, target, [statement, ...args]);
          };
        }
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    let failed = false;
    try {
      await createDatabaseSessionStorage(faulty).save(next);
    } catch {
      failed = true;
    }
    assert.ok(failed);
    assert.equal((await storage.read(id)).get("board-member:a"), "owner");
  });
});
