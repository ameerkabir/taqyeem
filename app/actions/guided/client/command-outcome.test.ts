import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { commandOutcome, isNotMemberResponse } from "./command-outcome.ts";

describe("commandOutcome", () => {
  it("follows a moved note into its category", () => {
    assert.equal(commandOutcome("move-note").followCategory, true);
    assert.equal(commandOutcome("vote").followCategory, false);
  });

  it("clears the private topic when the live topic changes", () => {
    assert.equal(commandOutcome("live").clearPrivateTopic, true);
    assert.equal(commandOutcome("reopen").clearPrivateTopic, true);
    assert.equal(commandOutcome("theme").clearPrivateTopic, false);
  });

  it("clears drafts only for drafted commands", () => {
    for (let kind of ["theme", "propose", "decision"]) {
      assert.equal(commandOutcome(kind).clearsDraft, true, kind);
    }
    assert.equal(commandOutcome("ready").clearsDraft, false);
  });

  it("keeps a drafted title only when adding to an existing theme", () => {
    assert.equal(commandOutcome("theme", true).keepsTitle, true);
    assert.equal(commandOutcome("theme", false).keepsTitle, false);
    assert.equal(commandOutcome("propose", true).keepsTitle, false);
  });
});

describe("isNotMemberResponse", () => {
  it("matches only a 403 with the not_member reason", () => {
    let headers = { "X-Access-Reason": "not_member" };
    assert.equal(isNotMemberResponse(new Response(null, { status: 403, headers })), true);
    assert.equal(isNotMemberResponse(new Response(null, { status: 403 })), false);
    assert.equal(isNotMemberResponse(new Response(null, { status: 401, headers })), false);
  });
});
