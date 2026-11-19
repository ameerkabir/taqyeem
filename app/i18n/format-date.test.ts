import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { formatDate } from "./format-date.ts";

describe("formatDate", () => {
  it("keeps a due date on its calendar day in every time zone", () => {
    assert.equal(formatDate("en-GB", "2026-03-01", "due"), "1 Mar 2026");
  });

  it("matches Intl for the date-and-time styles", () => {
    let at = "2026-11-17T09:05:00.000Z";
    assert.equal(
      formatDate("en-GB", at, "long-time"),
      new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short" }).format(new Date(at)),
    );
    assert.equal(
      formatDate("ar", at, "medium-time"),
      new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(new Date(at)),
    );
  });
});
