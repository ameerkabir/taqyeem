import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { formDataSignature } from "./form-signature.ts";

describe("formDataSignature", () => {
  it("encodes every value in order, including repeated names", () => {
    let data = new FormData();
    data.append("title", "Release & deploy");
    data.append("notes", "a");
    data.append("notes", "b");
    assert.equal(formDataSignature(data), "title=Release+%26+deploy&notes=a&notes=b");
  });

  it("changes when any value changes", () => {
    let a = new FormData(), b = new FormData();
    a.append("text", "سلام");
    b.append("text", "سلام!");
    assert.notEqual(formDataSignature(a), formDataSignature(b));
  });
});
