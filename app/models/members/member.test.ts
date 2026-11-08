import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { MAX_MEMBER_NAME_LENGTH } from "../../data/limits.ts";
import { boards, members } from "../../data/tables.ts";
import { createTestDatabase } from "../../test/db.ts";
import { insertBoard } from "../boards/board.ts";
import { findMember, insertMember, listMembers, MemberNameTakenError } from "./member.ts";

type TestDb = Awaited<ReturnType<typeof createTestDatabase>>;

async function countMembers(db: TestDb) {
  return (await db.exec("SELECT count(*) AS total FROM members")).rows?.[0].total;
}

async function withDb(run: (db: TestDb) => Promise<void>) {
  let db = await createTestDatabase();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

describe("members model", () => {
  it("creates and reads back a member", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      let member = await insertMember(db, {
        boardId: board.id,
        displayName: "ريم",
        role: "organiser",
      });
      let found = await findMember(db, member.id);
      assert.equal(found?.display_name, "ريم");
      assert.equal(found?.board_id, board.id);
      assert.equal(found?.role, "organiser");
    });
  });

  it("lists only the members of the requested board", async () => {
    await withDb(async (db) => {
      let a = await insertBoard(db, "A");
      let b = await insertBoard(db, "B");
      await insertMember(db, { boardId: a.id, displayName: "Sam", role: "organiser" });
      await insertMember(db, { boardId: a.id, displayName: "Pat", role: "participant" });
      await insertMember(db, { boardId: b.id, displayName: "Lee", role: "organiser" });
      assert.equal((await listMembers(db, a.id)).length, 2);
      assert.equal((await listMembers(db, b.id)).length, 1);
    });
  });

  it("trims the display name", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      let member = await insertMember(db, {
        boardId: board.id,
        displayName: "  Sam  ",
        role: "participant",
      });
      assert.equal(member.display_name, "Sam");
    });
  });

  it("rejects empty and whitespace-only names and writes nothing", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      for (let displayName of ["", "   "]) {
        await assert.rejects(() =>
          insertMember(db, { boardId: board.id, displayName, role: "participant" }),
        );
      }
      assert.equal(await countMembers(db), 0);
    });
  });

  it("accepts the maximum name length and rejects one over", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      await insertMember(db, {
        boardId: board.id,
        displayName: "a".repeat(MAX_MEMBER_NAME_LENGTH),
        role: "participant",
      });
      await assert.rejects(() =>
        insertMember(db, {
          boardId: board.id,
          displayName: "a".repeat(MAX_MEMBER_NAME_LENGTH + 1),
          role: "participant",
        }),
      );
      assert.equal(await countMembers(db), 1);
    });
  });

  it("rejects a member for a board that does not exist", async () => {
    await withDb(async (db) => {
      await assert.rejects(() =>
        insertMember(db, {
          boardId: crypto.randomUUID(),
          displayName: "Sam",
          role: "organiser",
        }),
      );
      assert.equal(await countMembers(db), 0);
    });
  });

  it("rejects an unknown role", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      await assert.rejects(() =>
        db.create(members, {
          id: crypto.randomUUID(),
          board_id: board.id,
          display_name: "Sam",
          name_key: "sam",
          role: "admin" as "organiser",
        }),
      );
      assert.equal(await countMembers(db), 0);
    });
  });

  it("allows only one organiser per board but many participants", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      await insertMember(db, { boardId: board.id, displayName: "Sam", role: "organiser" });
      await assert.rejects(() =>
        insertMember(db, { boardId: board.id, displayName: "Pat", role: "organiser" }),
      );
      await insertMember(db, { boardId: board.id, displayName: "Lee", role: "participant" });
      await insertMember(db, { boardId: board.id, displayName: "Kim", role: "participant" });
      assert.equal(await countMembers(db), 3);
    });
  });

  it("lets the same person organise several boards", async () => {
    await withDb(async (db) => {
      let a = await insertBoard(db, "A");
      let b = await insertBoard(db, "B");
      await insertMember(db, { boardId: a.id, displayName: "Sam", role: "organiser" });
      await insertMember(db, { boardId: b.id, displayName: "Sam", role: "organiser" });
      assert.equal(await countMembers(db), 2);
    });
  });

  it("deletes a board's members with the board, and no one else's", async () => {
    await withDb(async (db) => {
      let a = await insertBoard(db, "A");
      let b = await insertBoard(db, "B");
      await insertMember(db, { boardId: a.id, displayName: "Sam", role: "organiser" });
      await insertMember(db, { boardId: b.id, displayName: "Lee", role: "organiser" });
      assert.equal(await db.delete(boards, a.id), true);
      assert.equal((await listMembers(db, a.id)).length, 0);
      assert.equal((await listMembers(db, b.id)).length, 1);
    });
  });

  it("stores the normalised key next to the display name", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      let member = await insertMember(db, {
        boardId: board.id,
        displayName: "  Élodie  Martin ",
        role: "participant",
      });
      assert.equal(member.display_name, "Élodie  Martin");
      assert.equal(member.name_key, "élodie martin");
    });
  });

  it("refuses a second member whose name has the same key on the same board", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      await insertMember(db, { boardId: board.id, displayName: "Sam", role: "organiser" });
      for (let displayName of ["Sam", "sam", " SAM ", "S\u200Bam", "Ｓａｍ"]) {
        await assert.rejects(
          () => insertMember(db, { boardId: board.id, displayName, role: "participant" }),
          MemberNameTakenError,
          displayName,
        );
      }
      assert.equal(await countMembers(db), 1);
    });
  });

  it("allows the same name on another board", async () => {
    await withDb(async (db) => {
      let a = await insertBoard(db, "A");
      let b = await insertBoard(db, "B");
      await insertMember(db, { boardId: a.id, displayName: "Sam", role: "organiser" });
      await insertMember(db, { boardId: b.id, displayName: "sam", role: "organiser" });
      assert.equal(await countMembers(db), 2);
    });
  });

  it("does not call a different failure a taken name", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      await insertMember(db, { boardId: board.id, displayName: "Sam", role: "organiser" });
      // A second organiser with a free name fails on the one-organiser rule, not on the name.
      await assert.rejects(
        () => insertMember(db, { boardId: board.id, displayName: "Pat", role: "organiser" }),
        (error: unknown) => !(error instanceof MemberNameTakenError),
      );
      // A board that does not exist fails on the foreign key.
      await assert.rejects(
        () => insertMember(db, { boardId: crypto.randomUUID(), displayName: "Pat", role: "participant" }),
        (error: unknown) => !(error instanceof MemberNameTakenError),
      );
    });
  });

  it("rejects a name with no visible characters", async () => {
    await withDb(async (db) => {
      let board = await insertBoard(db, "Retro");
      for (let displayName of ["\u200B", "\uFEFF", "\u064B\u0640"]) {
        await assert.rejects(() =>
          insertMember(db, { boardId: board.id, displayName, role: "participant" }),
        );
      }
      assert.equal(await countMembers(db), 0);
    });
  });
});
