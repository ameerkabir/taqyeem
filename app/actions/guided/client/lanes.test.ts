import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { laneColumns, laneLayout } from "./lanes.ts";

const categories = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, boardId: "b", label: `C${i}`, position: i }));

describe("laneLayout", () => {
  it("shows every category's lane, however many the board has", () => {
    for (let n of [1, 3, 4, 5, 8]) {
      let all = categories(n);
      assert.deepEqual(laneLayout(all, "c0").lanes, all, String(n));
    }
    assert.equal(laneLayout(categories(8), "c6").current?.id, "c6");
  });

  it("keeps up to four lanes in one row and balances larger boards over two rows", () => {
    assert.deepEqual(
      [1, 2, 3, 4, 5, 6, 7, 8].map(laneColumns),
      [1, 2, 3, 4, 3, 3, 4, 4],
    );
  });

  it("falls back to the first category for an unknown or stale id", () => {
    assert.equal(laneLayout(categories(6), "gone").current?.id, "c0");
  });

  it("copes with a board that has no categories", () => {
    assert.deepEqual(laneLayout([], ""), { current: undefined, lanes: [], columns: 1 });
  });
});
