import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { MAX_MEMBER_NAME_LENGTH } from "../../data/limits.ts";
import { testDatabase } from "../../test/dependencies.ts";
import { insertBoard } from "./board.ts";
import { setBoardStatus } from "./state.ts";
import { createBoard } from "./create.ts";
import { joinBoard } from "./join.ts";
import { loadBoard, loadMembers } from "./load.ts";
import { findMember, MemberNameTakenError } from "../members/member.ts";

const input = {
  title: "Sprint 12",
  organiserDisplayName: "Sam",
  categoryLabels: ["Good", "Bad"],
};

describe("joinBoard", () => {
  it("adds a participant and returns the app's Member shape", async () => {
    let db = await testDatabase();
    let { board } = await createBoard(db, input);
    let result = await joinBoard(db, board.id, "ريم");
    assert.ok(result?.ok);
    assert.deepEqual(result.member, {
      id: result.member.id,
      boardId: board.id,
      displayName: "ريم",
    });
    assert.equal((await findMember(db, result.member.id))?.role, "participant");
  });

  it("trims the name", async () => {
    let db = await testDatabase();
    let { board } = await createBoard(db, input);
    let result = await joinBoard(db, board.id, "  Pat  ");
    assert.ok(result?.ok);
    assert.equal(result.member.displayName, "Pat");
  });

  it("lets many people join, each as a separate member, without touching the organiser", async () => {
    let db = await testDatabase();
    let { board, organiser } = await createBoard(db, input);
    let first = await joinBoard(db, board.id, "Pat");
    let second = await joinBoard(db, board.id, "Pat Two");
    assert.ok(first?.ok && second?.ok);
    assert.notEqual(first.member.id, second.member.id);
    let members = await loadMembers(db, board.id);
    assert.equal(members.length, 3);
    assert.ok(members.some((m) => m.id === organiser.id));
  });

  it("returns null for a board that does not exist or has no organiser", async () => {
    let db = await testDatabase();
    assert.equal(await joinBoard(db, crypto.randomUUID(), "Pat"), null);
    let orphan = await insertBoard(db, "Orphan");
    assert.equal(await joinBoard(db, orphan.id, "Pat"), null);
  });

  it("joins a closed board as an ordinary participant", async () => {
    let db = await testDatabase();
    let { board, organiser } = await createBoard(db, input);
    await setBoardStatus(db, board.id, "closed");
    let result = await joinBoard(db, board.id, "Pat");
    assert.ok(result?.ok);
    assert.equal((await findMember(db, result.member.id))?.role, "participant");
    // The board is still closed and still has the same organiser.
    let reloaded = await loadBoard(db, board.id);
    assert.equal(reloaded?.status, "closed");
    assert.equal(reloaded?.organiserMemberId, organiser.id);
    assert.equal((await loadMembers(db, board.id)).length, 2);
  });

  it("keeps a member's membership when the board is closed and reopened", async () => {
    let db = await testDatabase();
    let { board } = await createBoard(db, input);
    let joined = await joinBoard(db, board.id, "Pat");
    assert.ok(joined?.ok);
    await setBoardStatus(db, board.id, "closed");
    assert.equal((await findMember(db, joined.member.id))?.display_name, "Pat");
    await setBoardStatus(db, board.id, "collecting");
    assert.equal((await findMember(db, joined.member.id))?.role, "participant");
    assert.equal((await loadMembers(db, board.id)).length, 2);
  });

  it("still refuses a taken name, and a blank one, on a closed board", async () => {
    let db = await testDatabase();
    let { board } = await createBoard(db, input);
    await setBoardStatus(db, board.id, "closed");
    assert.deepEqual(await joinBoard(db, board.id, "sam"), { ok: false, reason: "name_taken" });
    await assert.rejects(() => joinBoard(db, board.id, "   "));
    assert.equal((await loadMembers(db, board.id)).length, 1);
  });

  it("returns null for a missing board whatever its state would have been", async () => {
    let db = await testDatabase();
    assert.equal(await joinBoard(db, crypto.randomUUID(), "Pat"), null);
  });

  it("allows joining again after a closed board is reopened", async () => {
    let db = await testDatabase();
    let { board } = await createBoard(db, input);
    await setBoardStatus(db, board.id, "closed");
    await setBoardStatus(db, board.id, "collecting");
    assert.ok((await joinBoard(db, board.id, "Pat"))?.ok);
  });

  it("rejects a blank or over-long name and adds no one", async () => {
    let db = await testDatabase();
    let { board } = await createBoard(db, input);
    for (let name of ["", "   ", "a".repeat(MAX_MEMBER_NAME_LENGTH + 1)]) {
      await assert.rejects(() => joinBoard(db, board.id, name));
    }
    assert.equal((await loadMembers(db, board.id)).length, 1);
  });

  it("stores hostile text as a plain name", async () => {
    let db = await testDatabase();
    let { board } = await createBoard(db, input);
    let name = "x'); DROP TABLE members; --";
    let result = await joinBoard(db, board.id, name);
    assert.ok(result?.ok);
    assert.equal(result.member.displayName, name);
    assert.equal((await loadMembers(db, board.id)).length, 2);
  });

  it("refuses a name another member already has, however it is written", async () => {
    let db = await testDatabase();
    let { board } = await createBoard(db, input); // organiser: Sam
    assert.ok((await joinBoard(db, board.id, "Pat"))?.ok);
    for (let name of ["Pat", "pat", "  PAT  ", "P\u200Bat", "Ｐａｔ", "Sam", "sam", " SAM "]) {
      assert.deepEqual(await joinBoard(db, board.id, name), { ok: false, reason: "name_taken" }, name);
    }
    assert.equal((await loadMembers(db, board.id)).length, 2); // Sam and Pat, nobody else
  });

  it("protects the organiser's name from being taken by a participant", async () => {
    let db = await testDatabase();
    let { board } = await createBoard(db, { ...input, organiserDisplayName: "أحمد" });
    assert.deepEqual(await joinBoard(db, board.id, "احمد"), { ok: false, reason: "name_taken" });
    assert.deepEqual(await joinBoard(db, board.id, "أَحْمَد"), { ok: false, reason: "name_taken" });
  });

  it("allows the same name on different boards", async () => {
    let db = await testDatabase();
    let a = await createBoard(db, { ...input, title: "A" });
    let b = await createBoard(db, { ...input, title: "B" });
    assert.ok((await joinBoard(db, a.board.id, "Pat"))?.ok);
    assert.ok((await joinBoard(db, b.board.id, "Pat"))?.ok);
  });

  it("allows a different name that only looks similar", async () => {
    let db = await testDatabase();
    let { board } = await createBoard(db, input);
    assert.ok((await joinBoard(db, board.id, "Pat"))?.ok);
    assert.ok((await joinBoard(db, board.id, "Pat L"))?.ok);
    assert.ok((await joinBoard(db, board.id, "Patty"))?.ok);
  });

  it("lets only one of two simultaneous joins with the same name win", async () => {
    let db = await testDatabase();
    let { board } = await createBoard(db, input);
    let results = await Promise.all([
      joinBoard(db, board.id, "Pat"),
      joinBoard(db, board.id, "pat"),
      joinBoard(db, board.id, " PAT "),
    ]);
    let winners = results.filter((result) => result?.ok);
    assert.equal(winners.length, 1);
    assert.equal(results.filter((r) => r && !r.ok && r.reason === "name_taken").length, 2);
    assert.equal((await loadMembers(db, board.id)).length, 2);
  });

  it("rejects a name with nothing visible in it and adds no one", async () => {
    let db = await testDatabase();
    let { board } = await createBoard(db, input);
    for (let name of ["\u200B", "\uFEFF \u200E", "\u064B\u0640"]) {
      await assert.rejects(() => joinBoard(db, board.id, name), name);
    }
    assert.equal((await loadMembers(db, board.id)).length, 1);
  });

  it("does not report a genuine failure as a taken name", async () => {
    let db = await testDatabase();
    let { board } = await createBoard(db, input);
    // Too long for the CHECK: a real failure, and no member with this key exists.
    await assert.rejects(
      () => joinBoard(db, board.id, "a".repeat(MAX_MEMBER_NAME_LENGTH + 1)),
      (error: unknown) => !(error instanceof MemberNameTakenError),
    );
  });
});
