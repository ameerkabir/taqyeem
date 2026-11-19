import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createSessionStore, type KeyValueStorage } from "./session-store.ts";

function memory(): KeyValueStorage & { data: Map<string, string> } {
  let data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("createSessionStore", () => {
  it("prefixes every key", () => {
    let storage = memory();
    let store = createSessionStore("board:member:", () => storage);
    store.set("note", "x");
    assert.deepEqual([...storage.data.keys()], ["board:member:note"]);
    assert.equal(store.get("note"), "x");
    store.remove("note");
    assert.equal(store.get("note"), null);
  });

  it("returns null for missing or malformed JSON", () => {
    let storage = memory();
    let store = createSessionStore("p:", () => storage);
    assert.equal(store.getJson("viewer"), null);
    storage.setItem("p:viewer", "{not json");
    assert.equal(store.getJson("viewer"), null);
    store.set("viewer", JSON.stringify({ open: true }));
    assert.deepEqual(store.getJson("viewer"), { open: true });
  });

  it("never throws when storage is unavailable", () => {
    let store = createSessionStore("p:", () => {
      throw new DOMException("blocked", "SecurityError");
    });
    assert.equal(store.get("a"), null);
    store.set("a", "b");
    store.remove("a");
    assert.equal(store.getJson("a"), null);
  });
});
