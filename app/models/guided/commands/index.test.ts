import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { handlerFor, handlers } from "./index.ts";

describe("command handlers", () => {
  it("knows every kind the workspace sends", () => {
    for (let kind of [
      "move-note", "configure", "ready", "budget", "theme", "rename", "ungroup",
      "ballot", "vote", "live", "outcome", "decision", "propose", "edit-proposal",
      "disposition", "complete", "advance", "reopen",
    ])
      assert.ok(handlerFor(kind), kind);
  });

  it("treats unknown kinds and inherited object keys as unknown", () => {
    assert.equal(handlerFor("convert"), undefined);
    assert.equal(handlerFor("toString"), undefined);
    assert.equal(handlerFor("__proto__"), undefined);
  });

  it("limits participants to readiness, voting and their own action work", () => {
    let open = Object.entries(handlers)
      .filter(([, handler]) => !handler.facilitatorOnly)
      .map(([kind]) => kind)
      .sort();
    assert.deepEqual(open, ["complete", "edit-proposal", "propose", "ready", "vote"]);
  });

  it("re-reads after commands whose triggers write other rows", () => {
    let rereads = Object.entries(handlers)
      .filter(([, handler]) => handler.changesEvidence)
      .map(([kind]) => kind)
      .sort();
    assert.deepEqual(rereads, ["configure", "move-note", "reopen"]);
  });
});
