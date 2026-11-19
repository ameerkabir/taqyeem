import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { resolveOwner } from "./owner.ts";
import { CommandError } from "./session.ts";

const models = {
  listMembers: async (boardId: string) => [
    { id: "m1", boardId, displayName: "Owner" },
    { id: "m2", boardId, displayName: "سارة" },
  ],
};

describe("resolveOwner", () => {
  it("matches a member by their display name, ignoring surrounding spaces", async () => {
    assert.equal(await resolveOwner(models, "b", "  سارة "), "m2");
  });

  it("treats a blank or missing name as unassigned without loading members", async () => {
    let unused = {
      listMembers: async () => {
        throw new Error("should not load members");
      },
    };
    assert.equal(await resolveOwner(unused, "b", ""), "");
    assert.equal(await resolveOwner(unused, "b", "   "), "");
    assert.equal(await resolveOwner(unused, "b", null), "");
  });

  it("rejects a name that is not a member of this board", async () => {
    let error: unknown;
    try {
      await resolveOwner(models, "b", "Stranger");
    } catch (e) {
      error = e;
    }
    assert.ok(error instanceof CommandError);
    assert.equal(error.code, "invalid");
    assert.equal(error.status, 400);
  });
});
