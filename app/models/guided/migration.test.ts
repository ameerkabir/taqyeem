import { loadBoard } from "../boards/load.ts";
import * as assert from "remix/assert";
import { it } from "remix/test";
import { createSqliteDatabase } from "remix/data-table/sqlite";
import { readdir, readFile } from "node:fs/promises";
import { migrationsDirectory } from "../../test/db.ts";
import { createBoard } from "../boards/create.ts";
import { createCard } from "../cards/card.ts";
import { setCardVote } from "../cards/vote.ts";
import { setBoardStatus } from "../boards/state.ts";
import { createSession, initialState } from "./session.ts";
it("additive migrations preserve populated/closed legacy boards, IDs, timestamps, anonymity, votes and reordered category identity", async () => {
  const db = createSqliteDatabase({ filename: ":memory:", foreignKeys: true });
  try {
    const files = (await readdir(migrationsDirectory))
      .filter((f) => /^\d+.*\.sql$/.test(f))
      .sort();
    for (let file of files.filter((f) => f < "0007"))
      await db.executeScript(
        await readFile(new URL(file, migrationsDirectory), "utf8"),
      );
    // Seed the actual pre-feature physical schema; new model declarations include a tone column.
    const board = crypto.randomUUID(),
      member = crypto.randomUUID(),
      category = crypto.randomUUID(),
      card = crypto.randomUUID();
    await db.exec(
      "INSERT INTO boards(id,title,status,voting_open) VALUES (?,?,?,?)",
      [board, "Legacy", "closed", 0],
    );
    await db.exec(
      "INSERT INTO members(id,board_id,display_name,name_key,role) VALUES (?,?,?,?,?)",
      [member, board, "Owner", "owner", "organiser"],
    );
    await db.exec(
      "INSERT INTO categories(id,board_id,label,position) VALUES (?,?,?,?)",
      [category, board, "Original label", 3],
    );
    await db.exec(
      "INSERT INTO cards(id,board_id,category_id,member_id,submission_id,body,is_anonymous) VALUES (?,?,?,?,?,?,?)",
      [
        card,
        board,
        category,
        member,
        crypto.randomUUID(),
        "Original anonymous note",
        1,
      ],
    );
    await db.exec(
      "INSERT INTO votes(board_id,card_id,member_id) VALUES (?,?,?)",
      [board, card, member],
    );
    const before = (await db.exec("SELECT * FROM cards")).rows![0];
    for (let file of files.filter((f) => f >= "0007"))
      await db.executeScript(
        await readFile(new URL(file, migrationsDirectory), "utf8"),
      );
    assert.deepEqual((await db.exec("SELECT * FROM cards")).rows![0], before);
    assert.equal(
      (await db.exec("SELECT count(*) AS n FROM votes")).rows![0].n,
      1,
    );
    assert.equal(
      (await db.exec("SELECT count(*) AS n FROM guided_sessions")).rows![0].n,
      0,
    );
    await db.exec("UPDATE categories SET position=0 WHERE id=?", [category]);
    assert.equal(
      (await db.exec("SELECT tone FROM categories WHERE id=?", [category]))
        .rows![0].tone,
      3,
    );
    let converted = (await createSession(db, board, { legacy: true }))!.view;
    assert.equal(converted.state.stage, "summary");
    assert.equal(converted.state.closure, null);
    assert.deepEqual(converted.state.decisions, {});
    assert.equal(converted.cards[0].voteCount, 1);
    assert.equal(converted.cards[0].isAnonymous, true);
    assert.equal(converted.cards[0].id, card);
  } finally {
    await db.close();
  }
});

it("category setup migration gates only empty collecting guided boards and preserves existing contributions and categories", async () => {
  const db = createSqliteDatabase({ filename: ":memory:", foreignKeys: true });
  try {
    const files = (await readdir(migrationsDirectory))
      .filter((f) => /^\d+.*\.sql$/.test(f))
      .sort();
    for (const file of files.filter((f) => f < "0010"))
      await db.executeScript(
        await readFile(new URL(file, migrationsDirectory), "utf8"),
      );
    const empty = await createBoard(db, {
      title: "Empty",
      organiserDisplayName: "Owner",
      categoryLabels: ["One", "Two"],
    });
    const populated = await createBoard(db, {
      title: "Populated",
      organiserDisplayName: "Owner",
      categoryLabels: ["Existing"],
    });
    const later = await createBoard(db, {
      title: "Later",
      organiserDisplayName: "Owner",
      categoryLabels: ["Existing"],
    });
    const legacy = await createBoard(db, {
      title: "Legacy",
      organiserDisplayName: "Owner",
      categoryLabels: ["Existing"],
    });
    for (const board of [empty, populated, later])
      await db.exec("INSERT INTO guided_sessions(board_id,data) VALUES (?,?)", [
        board.board.id,
        JSON.stringify(initialState((await loadBoard(db, board.board.id))!)),
      ]);
    await createCard(
      db,
      {
        id: crypto.randomUUID(),
        boardId: populated.board.id,
        memberId: populated.organiser.id,
        categoryId: populated.categories[0].id,
        body: "Keep this note",
        isAnonymous: true,
      },
      crypto.randomUUID(),
    );
    await db.exec(
      "UPDATE guided_sessions SET data=json_set(data,'$.stage','group') WHERE board_id=?",
      [later.board.id],
    );
    const beforeCategories = (
      await db.exec("SELECT * FROM categories ORDER BY id")
    ).rows;
    const beforeCards = (await db.exec("SELECT * FROM cards ORDER BY id")).rows;
    const beforePopulated = (
      await db.exec("SELECT * FROM guided_sessions WHERE board_id=?", [
        populated.board.id,
      ])
    ).rows;
    const beforeLater = (
      await db.exec("SELECT * FROM guided_sessions WHERE board_id=?", [
        later.board.id,
      ])
    ).rows;
    await db.executeScript(
      await readFile(
        new URL("0010_category_setup.sql", migrationsDirectory),
        "utf8",
      ),
    );
    assert.deepEqual(
      (await db.exec("SELECT * FROM cards ORDER BY id")).rows,
      beforeCards,
    );
    assert.deepEqual(
      (await db.exec("SELECT * FROM categories ORDER BY id")).rows,
      beforeCategories,
    );
    assert.deepEqual(
      (
        await db.exec("SELECT * FROM guided_sessions WHERE board_id=?", [
          populated.board.id,
        ])
      ).rows,
      beforePopulated,
    );
    assert.deepEqual(
      (
        await db.exec("SELECT * FROM guided_sessions WHERE board_id=?", [
          later.board.id,
        ])
      ).rows,
      beforeLater,
    );
    assert.equal(
      (
        await db.exec(
          "SELECT json_extract(data,'$.categorySetup.confirmed') AS confirmed FROM guided_sessions WHERE board_id=?",
          [empty.board.id],
        )
      ).rows![0].confirmed,
      0,
    );
    assert.equal(
      (
        await db.exec("SELECT * FROM guided_sessions WHERE board_id=?", [
          legacy.board.id,
        ])
      ).rows!.length,
      0,
    );
  } finally {
    await db.close();
  }
});

it("versioned-record migration preserves real closures and evidence, invents no legacy records, and prevents raw archive replacement or reopening", async () => {
  const db = createSqliteDatabase({ filename: ":memory:", foreignKeys: true });
  try {
    const files = (await readdir(migrationsDirectory))
      .filter((f) => /^\d+.*\.sql$/.test(f))
      .sort();
    for (const file of files.filter((f) => f < "0011"))
      await db.executeScript(
        await readFile(new URL(file, migrationsDirectory), "utf8"),
      );
    const closed = await createBoard(db, {
        title: "Existing closed meeting",
        organiserDisplayName: "Owner",
        categoryLabels: ["Original"],
      }),
      open = await createBoard(db, {
        title: "Still open",
        organiserDisplayName: "Owner",
        categoryLabels: ["Original"],
      });
    const note = await createCard(
      db,
      {
        id: crypto.randomUUID(),
        boardId: closed.board.id,
        memberId: closed.organiser.id,
        categoryId: closed.categories[0].id,
        body: "Keep the original evidence",
        isAnonymous: true,
      },
      crypto.randomUUID(),
    );
    assert.ok(note.ok);
    const closure = {
      at: "2026-11-16T10:15:00.000Z",
      topics: [
        { id: note.card.id, title: note.card.body, notes: [note.card.id] },
      ],
      outcomes: {},
      decisions: {},
      proposals: [],
      cards: [note.card],
      categories: closed.categories,
    };
    await db.exec("INSERT INTO guided_sessions(board_id,data) VALUES (?,?)", [
      closed.board.id,
      JSON.stringify({
        ...initialState((await loadBoard(db, closed.board.id))!),
        stage: "summary",
        closure,
      }),
    ]);
    await db.exec("INSERT INTO guided_sessions(board_id,data) VALUES (?,?)", [
      open.board.id,
      JSON.stringify(initialState((await loadBoard(db, open.board.id))!)),
    ]);
    const cardsBefore = (await db.exec("SELECT * FROM cards")).rows,
      categoriesBefore = (await db.exec("SELECT * FROM categories ORDER BY id"))
        .rows;
    await db.executeScript(
      await readFile(
        new URL("0011_versioned_meeting_records.sql", migrationsDirectory),
        "utf8",
      ),
    );
    const archive = (await db.exec("SELECT * FROM guided_closures")).rows!;
    assert.equal(archive.length, 1);
    assert.equal(archive[0].version, 1);
    assert.equal(archive[0].closed_at, closure.at);
    assert.deepEqual(JSON.parse(String(archive[0].snapshot)), closure);
    assert.deepEqual((await db.exec("SELECT * FROM cards")).rows, cardsBefore);
    assert.deepEqual(
      (await db.exec("SELECT * FROM categories ORDER BY id")).rows,
      categoriesBefore,
    );
    for (const statement of [
      "UPDATE guided_closures SET snapshot='{}'",
      "DELETE FROM guided_closures",
      "UPDATE guided_sessions SET data=json_set(data,'$.closure',NULL,'$.stage','discuss') WHERE board_id=?",
    ]) {
      let blocked = false;
      try {
        await db.exec(
          statement,
          statement.includes("?") ? [closed.board.id] : [],
        );
      } catch {
        blocked = true;
      }
      assert.ok(blocked);
    }
    assert.equal(
      (await db.exec("SELECT count(*) AS n FROM guided_closures")).rows![0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
