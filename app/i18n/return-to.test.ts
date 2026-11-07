import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { safeReturnTo } from "./return-to.ts";

const origin = "https://taqyeem.example";

describe("safeReturnTo", () => {
  it("keeps local paths and queries", () => {
    assert.equal(safeReturnTo("/boards/a?section=x%20y", origin), "/boards/a?section=x%20y");
    assert.equal(safeReturnTo("/", origin), "/");
  });

  it("drops fragments", () => {
    assert.equal(safeReturnTo("/boards/a?section=1#top", origin), "/boards/a?section=1");
  });

  it("rejects open-redirect shapes", () => {
    for (let value of [
      "https://evil.example/",
      "//evil.example/path",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "boards/a",
      "/ok\r\nSet-Cookie: x=1",
      "/a\u0000b",
      "",
      null,
      undefined,
      42,
      "/" + "a".repeat(3000),
    ]) {
      assert.equal(safeReturnTo(value, origin), "/", String(value));
    }
  });

  it("never returns to the POST-only locale route", () => {
    assert.equal(safeReturnTo("/locale", origin), "/");
    assert.equal(safeReturnTo("/locale?x=1", origin), "/");
  });
});
