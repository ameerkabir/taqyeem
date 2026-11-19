import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { buildClosure } from "./closure.ts";
import type { SessionView } from "./types.ts";

describe("buildClosure", () => {
  it("snapshots ranked topics and copies everything so later changes cannot leak in", () => {
    let view = {
      cards: [
        { id: "a", body: "A", categoryId: "c" },
        { id: "b", body: "B", categoryId: "c" },
      ],
      categories: [{ id: "c", label: "C" }],
      state: {
        themes: [],
        votes: { m: ["b"] },
        outcomes: { b: "discussed" },
        decisions: { b: "Ship it" },
        proposals: [{ id: "p", completed: false }],
      },
    } as unknown as SessionView;
    let closure = buildClosure(view, view.state, new Date("2026-11-17T12:00:00Z"));
    assert.equal(closure.at, "2026-11-17T12:00:00.000Z");
    assert.deepEqual(closure.topics.map((t) => t.id), ["b", "a"]);
    view.state.proposals[0].completed = true;
    view.state.decisions.b = "Changed";
    view.cards[0].body = "Edited";
    assert.equal(closure.proposals[0].completed, false);
    assert.equal(closure.decisions.b, "Ship it");
    assert.equal(closure.cards[0].body, "A");
  });
});
