import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { isDraftField } from "./draft-fields.ts";

describe("guided draft fields", () => {
  it("never keeps the command id, so a restored form cannot replay a committed command", () => {
    assert.equal(isDraftField("id"), false);
  });

  it("drops per-attempt fields that the server sets", () => {
    for (let name of ["revision", "kind", "ballot", "attachTopic"]) {
      assert.equal(isDraftField(name), false, name);
    }
  });

  it("keeps what the person typed or chose", () => {
    for (let name of ["title", "text", "topic", "owner", "due", "labels", "notes"]) {
      assert.equal(isDraftField(name), true, name);
    }
  });
});
