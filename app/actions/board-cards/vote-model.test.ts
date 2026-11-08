import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { ACCESS_REASON_HEADER, NOT_MEMBER_REASON } from "../../data/access.ts";
import { createVoteModel, VoteRejectedError } from "./public/vote-model.ts";
import { createTranslator } from "../../i18n/translator.ts";
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

describe("vote model fallback errors follow the translator", () => {
  for (let [locale, saveFailed, unconfirmed] of [
    ["ar", "تعذّر حفظ التصويت", "تعذّر تأكيد التصويت"],
    ["en", "Couldn't save your vote", "Couldn't confirm your vote"],
  ] as const) {
    it(`uses ${locale} messages for unexpected server responses`, async () => {
      let t = createTranslator(locale).t;
      let rejected = createVoteModel(async () => Response.json({}, { status: 500 }), t);
      await assert.rejects(() => rejected.save(options()), (error: Error) => error.message === saveFailed);
      let invalid = createVoteModel(async () => Response.json({ voted: true, count: -1 }), t);
      await assert.rejects(() => invalid.save(options()), (error: Error) => error.message === unconfirmed);
    });
  }

  it("surfaces the server's message and reason when it rejects a non-member", async () => {
    let model = createVoteModel(async () =>
      Response.json(
        { error: "Please join the board" },
        { status: 403, headers: { [ACCESS_REASON_HEADER]: NOT_MEMBER_REASON } },
      ),
    );
    let error = await model.save(options(true, server)).then(
      () => undefined,
      (cause: unknown) => cause,
    );
    assert.ok(error instanceof VoteRejectedError);
    assert.equal(error.message, "Please join the board");
    assert.equal(error.reason, NOT_MEMBER_REASON);
    // The optimistic vote is rolled back.
    assert.deepEqual(model.read(server), server);
  });

  it("reports a rejection without a reason header as a rejection with no reason", async () => {
    let model = createVoteModel(async () =>
      Response.json({ error: "Voting is not open" }, { status: 403 }),
    );
    let error = await model.save(options(true, server)).then(
      () => undefined,
      (cause: unknown) => cause,
    );
    assert.ok(error instanceof VoteRejectedError);
    assert.equal(error.reason, null);
  });

  it("does not turn a network failure into a rejection", async () => {
    let model = createVoteModel(async () => {
      throw new TypeError("Failed to fetch");
    });
    let error = await model.save(options(true, server)).then(
      () => undefined,
      (cause: unknown) => cause,
    );
    assert.ok(!(error instanceof VoteRejectedError));
  });
});
