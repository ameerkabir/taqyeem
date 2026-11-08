import { testDatabase } from "./test/dependencies.ts";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createAppRouter, type AppContext } from "./router.ts";
import { appConfigContext, waitUntilContext, databaseContext } from "./middleware/dependencies.ts";
import { createRequestOptions } from "../server.ts";
import type { Database } from "remix/data-table";

async function setup(appEnv = "test", db?: Database) {
  let pending: Promise<unknown>[] = [];
  let execution = {
    waitUntil(work: Promise<unknown>) {
      assert.equal(this, execution);
      pending.push(work);
    },
  };
  let options = createRequestOptions({ APP_ENV: appEnv, SESSION_SECRET: "test-only-session-secret" }, execution, db ?? (await testDatabase()));
  return { router: createAppRouter(options), pending, options };
}

describe("request dependency boundary", () => {
  it("publishes accurately typed configuration and bound execution helpers", async () => {
    let { router, pending, options } = await setup();
    let work = Promise.resolve();
    router.get("/dependencies", async (context) => {
      let typed: AppContext = context;
      assert.equal(typed.db, options.db);
      assert.equal(context.get(databaseContext), options.db);
      assert.equal((await typed.db.exec("SELECT ? AS answer", [42])).rows?.[0].answer, 42);
      assert.equal(typed.config, options.config);
      assert.equal(context.get(appConfigContext), options.config);
      assert.equal(context.get(waitUntilContext), context.waitUntil);
      context.waitUntil(work);
      return new Response(context.config.appEnv);
    });
    assert.equal(await (await router.fetch("http://localhost/dependencies")).text(), "test");
    assert.deepEqual(pending, [work]);
  });

  it("keeps consecutive and overlapping requests tied to their own execution helper", async () => {
    let first = await setup("first");
    let second = await setup("second");
    let release!: () => void;
    let gate = new Promise<void>((resolve) => { release = resolve; });
    let work = [Promise.resolve(1), Promise.resolve(2)];
    for (let [index, item] of [first, second].entries()) {
      item.router.get("/execution", async (context) => {
        await gate;
        context.waitUntil(work[index]);
        return new Response(context.config.appEnv);
      });
    }
    let responses = [first.router.fetch("http://localhost/execution"), second.router.fetch("http://localhost/execution")];
    release();
    assert.deepEqual(await Promise.all(responses.map(async (r) => (await r).text())), ["first", "second"]);
    await second.router.fetch("http://localhost/execution");
    await first.router.fetch("http://localhost/execution");
    assert.deepEqual(first.pending, [work[0], work[0]]);
    assert.deepEqual(second.pending, [work[1], work[1]]);
  });

  it("preserves boards and signed organiser sessions across fresh routers and native forms", async () => {
    // One database for every request: boards now live in it, not in module memory.
    let db = await testDatabase();
    async function request(path: string, init?: RequestInit) {
      return (await setup("test", db)).router.fetch(`http://localhost${path}`, init);
    }
    let created = await request("/boards/new", {
      method: "POST",
      body: new URLSearchParams({ title: "لوحة اختبار", organiserDisplayName: "منظم" }),
    });
    assert.equal(created.status, 303);
    let location = created.headers.get("Location")!;
    let cookie = created.headers.get("Set-Cookie")!.split(";")[0];
    assert.match(cookie, /^taqyeem_session=/);
    let owner = await request(location, { headers: { Cookie: cookie } });
    assert.equal(owner.status, 200);
    assert.match(await owner.text(), /لوحة اختبار/);
    assert.equal((await request(`${location}/new`, { headers: { Cookie: cookie } })).status, 200);
    // Not a member: page navigations go to the join form.
    let outsider = await request(`${location}/new`);
    assert.equal(outsider.status, 303);
    assert.equal(outsider.headers.get("Location"), `${location}/join`);
    assert.equal((await request(`${location}/status`, {
      method: "POST", headers: { Cookie: cookie, Origin: "https://other.example" },
      body: new URLSearchParams({ status: "closed" }),
    })).status, 403);
  });
});
