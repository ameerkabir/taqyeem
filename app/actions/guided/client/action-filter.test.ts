import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import type { Proposal } from "../../../models/guided/session.ts";
import {
  canFilterActions,
  matchesActionFilter,
  parseActionFilter,
} from "./action-filter.ts";

const proposal = (overrides: Partial<Proposal>): Proposal => ({
  id: "p",
  text: "Do it",
  topic: "",
  author: "a",
  owner: "",
  due: "",
  disposition: "suggested",
  completed: false,
  updatedAt: "",
  ...overrides,
});

describe("action filters", () => {
  it("shows filters only for four or more records", () => {
    assert.equal(canFilterActions(3), false);
    assert.equal(canFilterActions(4), true);
  });

  it("falls back to all for unknown or missing values", () => {
    assert.equal(parseActionFilter("open"), "open");
    assert.equal(parseActionFilter("bogus"), "all");
    assert.equal(parseActionFilter(undefined), "all");
  });

  it("separates open and completed agreed actions", () => {
    let open = proposal({ disposition: "agreed" });
    let done = proposal({ disposition: "agreed", completed: true });
    assert.equal(matchesActionFilter(open, "open", "m"), true);
    assert.equal(matchesActionFilter(done, "open", "m"), false);
    assert.equal(matchesActionFilter(done, "completed", "m"), true);
    assert.equal(matchesActionFilter(proposal({ completed: true }), "completed", "m"), false);
  });

  it("matches by disposition, by owner for mine, and everything for all", () => {
    let mine = proposal({ owner: "m", disposition: "deferred" });
    assert.equal(matchesActionFilter(mine, "deferred", "m"), true);
    assert.equal(matchesActionFilter(mine, "declined", "m"), false);
    assert.equal(matchesActionFilter(mine, "mine", "m"), true);
    assert.equal(matchesActionFilter(mine, "mine", "other"), false);
    assert.equal(matchesActionFilter(mine, "all", "other"), true);
  });
});
