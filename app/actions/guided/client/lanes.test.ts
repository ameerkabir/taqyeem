import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { laneLayout } from "./lanes.ts";

const categories = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, boardId: "b", label: `C${i}`, position: i }));

describe("laneLayout", () => {
  it("shows every lane for four or fewer categories", () => {
    let all = categories(4);
    assert.deepEqual(laneLayout(all, "c3").lanes, all);
    assert.equal(laneLayout(all, "c3").current?.id, "c3");
  });

  it("pages larger boards in shelves of three around the chosen category", () => {
    let all = categories(8);
    assert.deepEqual(laneLayout(all, "c4").lanes.map((c) => c.id), ["c3", "c4", "c5"]);
    assert.equal(laneLayout(all, "c4").shelf, 1);
    assert.deepEqual(laneLayout(all, "c7").lanes.map((c) => c.id), ["c6", "c7"]);
  });

  it("falls back to the first category for an unknown or stale id", () => {
    let all = categories(6);
    let layout = laneLayout(all, "gone");
    assert.equal(layout.current?.id, "c0");
    assert.deepEqual(layout.lanes.map((c) => c.id), ["c0", "c1", "c2"]);
  });

  it("copes with a board that has no categories", () => {
    assert.deepEqual(laneLayout([], ""), { current: undefined, shelf: 0, lanes: [] });
  });
});
