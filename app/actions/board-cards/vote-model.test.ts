import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createVoteModel } from "./public/vote-model.ts";

const server = { voted: false, count: 3 };
function options(voted = true, previous = server) {
  let body = new FormData();
  body.set("voted", String(voted));
  return {
    action: "/boards/demo/cards/card/vote", body, previous,
    signal: new AbortController().signal, update() {},
  };
}

describe("optimistic vote model", () => {
  it("shows the vote before saving, adopts the server count, and resets to fresh props", async () => {
    let resolve!: (response: Response) => void;
    let model = createVoteModel(async (_url, init) => {
      assert.equal(init?.method, "POST");
      assert.equal((init?.body as FormData).get("voted"), "true");
      return new Promise<Response>((done) => { resolve = done; });
    });
    let saving = model.save(options());
    assert.deepEqual(model.read(server), { voted: true, count: 4 });
    resolve(Response.json({ voted: true, count: 7 }));
    await saving;
    assert.deepEqual(model.read(server), { voted: true, count: 7 });
    model.reset();
    assert.deepEqual(model.read({ voted: true, count: 8 }), { voted: true, count: 8 });
  });

  it("optimistically removes a vote", async () => {
    let model = createVoteModel(async () => Response.json({ voted: false, count: 2 }));
    let saving = model.save(options(false, { voted: true, count: 3 }));
    assert.deepEqual(model.read(server), { voted: false, count: 2 });
    await saving;
  });

  for (let failure of ["rejection", "network", "invalid response"] as const) {
    it(`rolls back after ${failure}`, async () => {
      let model = createVoteModel(async () => {
        if (failure === "network") throw new Error("offline");
        return failure === "rejection"
          ? Response.json({ error: "التصويت مغلق" }, { status: 403 })
          : Response.json({ voted: true, count: -1 });
      });
      let failed = false;
      try { await model.save(options()); } catch { failed = true; }
      assert.ok(failed);
      assert.deepEqual(model.read(server), server);
      // A rollback must not freeze an old server snapshot.
      assert.deepEqual(model.read({ voted: false, count: 9 }), { voted: false, count: 9 });
    });
  }

  it("retains a confirmed vote until a successful refresh, including after a failed retry", async () => {
    let requests = 0;
    let model = createVoteModel(async () => {
      if (++requests === 1) return Response.json({ voted: true, count: 4 });
      throw new Error("offline");
    });
    await model.save(options());
    // A failed Frame refresh does not reset the model.
    let confirmed = model.read(server);
    assert.deepEqual(confirmed, { voted: true, count: 4 });
    try { await model.save(options(false, confirmed)); } catch {}
    assert.deepEqual(model.read(server), confirmed);
  });
});
