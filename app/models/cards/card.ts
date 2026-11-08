import { sql, type Database } from "remix/data-table";
import type { Card } from "../../data/board.ts";
import { MAX_CARDS, WINDOW_MS } from "../../data/limits.ts";
import { cards } from "../../data/tables.ts";
import type { CreateCardResult } from "../board-models.ts";
import { countVotes, countVotesByCard } from "./vote.ts";

interface CardRow {
  id: string;
  board_id: string;
  category_id: string;
  member_id: string;
  body: string;
  is_anonymous: number;
  created_at: string;
}

/** Storage rows are snake_case; the app works with Card. This is the one conversion. */
function toCard(row: CardRow, voteCount: number): Card {
  return {
    id: row.id,
    boardId: row.board_id,
    categoryId: row.category_id,
    memberId: row.member_id,
    body: row.body,
    isAnonymous: row.is_anonymous === 1,
    voteCount,
    createdAt: row.created_at,
  };
}

/** createdAt and voteCount are not inputs: the database sets the time, votes are counted. */
export interface NewCard {
  id: string;
  boardId: string;
  categoryId: string;
  memberId: string;
  body: string;
  isAnonymous: boolean;
}

export interface CardLimits {
  maxCards: number;
  windowMs: number;
}

const defaultLimits: CardLimits = { maxCards: MAX_CARDS, windowMs: WINDOW_MS };

function findBySubmission(
  db: Database,
  boardId: string,
  memberId: string,
  submissionId: string,
) {
  return db.findOne(cards, {
    where: { board_id: boardId, member_id: memberId, submission_id: submissionId },
  });
}

/**
 * Idempotent per (board, member, submissionId): a repeat returns the original card, and is
 * not counted against the rate limit. The limit is count-then-insert, so two truly
 * concurrent requests can overshoot it by a card; that is accepted (it is spam protection,
 * not an invariant). Duplicates, by contrast, are prevented by a unique constraint.
 *
 * The window is compared in SQL against the database clock (the same clock that stamps
 * created_at), so no JavaScript clock is involved.
 */
export async function createCard(
  db: Database,
  card: NewCard,
  submissionId: string,
  limits: CardLimits = defaultLimits,
): Promise<CreateCardResult> {
  let existing = await findBySubmission(db, card.boardId, card.memberId, submissionId);
  if (existing) return { ok: true, card: toCard(existing, await countVotes(db, existing.id)) };

  let windowSeconds = limits.windowMs / 1000;
  let usage = await db.exec(sql`
    SELECT count(*) AS recent,
           CAST((julianday(min(created_at)) - julianday('now')) * 86400.0
                + ${windowSeconds} + 0.999 AS INTEGER) AS retry_after
    FROM cards
    WHERE board_id = ${card.boardId}
      AND member_id = ${card.memberId}
      AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ${`-${windowSeconds} seconds`})
  `);
  let { recent, retry_after } = usage.rows?.[0] ?? {};
  if (Number(recent) >= limits.maxCards) {
    return { ok: false, retryAfter: Math.max(1, Number(retry_after)) };
  }

  try {
    let row = await db.create(
      cards,
      {
        id: card.id,
        board_id: card.boardId,
        category_id: card.categoryId,
        member_id: card.memberId,
        submission_id: submissionId,
        body: card.body.trim(),
        is_anonymous: card.isAnonymous ? 1 : 0,
      },
      { returnRow: true },
    );
    return { ok: true, card: toCard(row, 0) };
  } catch (error) {
    // A concurrent request may have inserted the same submission first.
    let winner = await findBySubmission(db, card.boardId, card.memberId, submissionId);
    if (winner) return { ok: true, card: toCard(winner, await countVotes(db, winner.id)) };
    throw error; // not a duplicate: a real failure
  }
}

export async function listCards(db: Database, boardId: string): Promise<Card[]> {
  let rows = await db.findMany(cards, {
    where: { board_id: boardId },
    orderBy: [["created_at", "asc"], ["id", "asc"]],
  });
  let counts = await countVotesByCard(db, boardId);
  return rows.map((row) => toCard(row, counts.get(row.id) ?? 0));
}

/** Always scoped to the board: another board's card id is "not found". */
export async function getCard(
  db: Database,
  boardId: string,
  cardId: string,
): Promise<Card | null> {
  let row = await db.findOne(cards, { where: { board_id: boardId, id: cardId } });
  return row ? toCard(row, await countVotes(db, row.id)) : null;
}

/** Only these fields can change, even if a caller supplies extra properties. */
export async function updateCard(
  db: Database,
  boardId: string,
  cardId: string,
  changes: Pick<Card, "body" | "categoryId" | "isAnonymous">,
): Promise<Card | null> {
  let result = await db.updateMany(
    cards,
    {
      body: changes.body.trim(),
      category_id: changes.categoryId,
      is_anonymous: changes.isAnonymous ? 1 : 0,
    },
    { where: { board_id: boardId, id: cardId } },
  );
  if (result.affectedRows === 0) return null;
  return getCard(db, boardId, cardId);
}

/** The card's votes are deleted with it (foreign key cascade). */
export async function deleteCard(
  db: Database,
  boardId: string,
  cardId: string,
): Promise<boolean> {
  let result = await db.deleteMany(cards, { where: { board_id: boardId, id: cardId } });
  return result.affectedRows > 0;
}
