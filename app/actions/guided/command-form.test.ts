import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { CommandError } from "../../models/guided/session.ts";
import { checkCommandForm, readCommandForm } from "./command-form.ts";

const form = (entries: [string, string][]) => {
  let data = new FormData();
  for (let [k, v] of entries) data.append(k, v);
  return data;
};
const rejects = (data: FormData, kind = "ready") => {
  try {
    checkCommandForm(data, kind);
  } catch (error) {
    return error instanceof CommandError && error.code === "invalid" && error.status === 400;
  }
  return false;
};

describe("readCommandForm", () => {
  it("reads the envelope and only the fields that were sent", () => {
    let command = readCommandForm(
      form([["id", "x"], ["revision", "4"], ["kind", "propose"], ["text", "Do it"], ["owner", ""]]),
    );
    assert.deepEqual(command, { id: "x", revision: 4, kind: "propose", text: "Do it", owner: "" });
  });

  it("splits labels by line and keeps every grouped note", () => {
    let command = readCommandForm(
      form([["kind", "configure"], ["labels", " Keep \r\n\nجرّب\n"], ["notes", "a"], ["notes", "b"]]),
    );
    assert.deepEqual(command.labels, ["Keep", "جرّب"]);
    assert.deepEqual(command.notes, ["a", "b"]);
  });

  it("types value, ballot and version", () => {
    assert.equal(readCommandForm(form([["kind", "ready"], ["value", "true"]])).value, true);
    assert.equal(readCommandForm(form([["kind", "ready"], ["value", "false"]])).value, false);
    assert.equal(readCommandForm(form([["kind", "budget"], ["value", "7"]])).value, 7);
    assert.equal(readCommandForm(form([["kind", "outcome"], ["value", "skipped"]])).value, "skipped");
    let numbers = readCommandForm(form([["ballot", "2"], ["version", "3"]]));
    assert.equal(numbers.ballot, 2);
    assert.equal(numbers.version, 3);
  });
});

describe("checkCommandForm", () => {
  it("accepts a well-formed command", () => {
    assert.equal(rejects(form([["revision", "0"], ["notes", "a"], ["notes", "b"]])), false);
  });

  it("rejects a repeated single-value field", () => {
    for (let key of ["id", "kind", "text", "ownerSearch", "labels", "value"])
      assert.equal(rejects(form([["revision", "1"], [key, "a"], [key, "b"]])), true, key);
  });

  it("requires a whole-number revision", () => {
    for (let revision of ["", "-1", "1.5", "abc"])
      assert.equal(rejects(form([["revision", revision]])), true, revision);
    assert.equal(rejects(form([])), true);
  });

  it("exempts conversion, which has no revision yet", () => {
    assert.equal(rejects(form([]), "convert"), false);
  });
});
