import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { canDropOn, notePayload } from "./note-drag.ts";

describe("note drag rules", () => {
  it("binds the drag payload to the board", () => {
    assert.equal(notePayload("b1", "n1"), "b1/n1");
    assert.notEqual(notePayload("b1", "n1"), notePayload("b2", "n1"));
  });

  it("drops only on a different, real category", () => {
    let dragged = { id: "n", fromCategory: "a" };
    assert.equal(canDropOn(dragged, "b"), true);
    assert.equal(canDropOn(dragged, "a"), false);
    assert.equal(canDropOn(dragged, ""), false);
    assert.equal(canDropOn(null, "b"), false);
  });
});
