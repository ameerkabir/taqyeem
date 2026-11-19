import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { CommandError } from "./errors.ts";
import { commandFingerprint } from "./fingerprint.ts";

describe("commandFingerprint", () => {
  it("ignores the revision so a retry at a newer revision matches", async () => {
    let a = await commandFingerprint({ id: "x", revision: 1, kind: "ready", value: true });
    let b = await commandFingerprint({ id: "x", revision: 9, kind: "ready", value: true });
    assert.equal(a.digest, b.digest);
    assert.match(a.digest, /^[0-9a-f]{64}$/);
    assert.equal(a.raw, JSON.stringify({ id: "x", kind: "ready", value: true }));
  });

  it("differs when the payload differs", async () => {
    let a = await commandFingerprint({ id: "x", revision: 1, kind: "ready", value: true });
    let b = await commandFingerprint({ id: "x", revision: 1, kind: "ready", value: false });
    assert.notEqual(a.digest, b.digest);
  });

  it("rejects oversized commands before hashing", async () => {
    let error: unknown;
    try {
      await commandFingerprint({ id: "x", revision: 1, kind: "decision", text: "x".repeat(70_000) });
    } catch (e) {
      error = e;
    }
    assert.ok(error instanceof CommandError && error.code === "invalid");
  });
});
