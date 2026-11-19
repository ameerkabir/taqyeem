import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { CommandError } from "./errors.ts";
import { commandsPerMinute, recordCommand } from "./rate-limit.ts";

describe("recordCommand", () => {
  it("records a command without touching other members", () => {
    let recent = recordCommand({ other: [1] }, "m", 1000);
    assert.deepEqual(recent, { other: [1], m: [1000] });
  });

  it("refuses the 61st command in a minute and forgets older ones", () => {
    let full = { m: Array.from({ length: commandsPerMinute }, (_, i) => 100_000 + i) };
    let error: unknown;
    try {
      recordCommand(full, "m", 100_100);
    } catch (e) {
      error = e;
    }
    assert.ok(error instanceof CommandError && error.code === "rate" && error.status === 429);
    // A minute later the old timestamps have expired.
    assert.deepEqual(recordCommand(full, "m", 160_100).m, [
      ...full.m.filter((at) => at > 100_100),
      160_100,
    ]);
  });
});
