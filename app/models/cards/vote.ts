import { sql, type Database } from "remix/data-table";
import { cards, votes } from "../../data/tables.ts";
import type { VoteResult } from "../board-models.ts";

export async function countVotes(db: Database, cardId: string): Promise<number> {
  let result = await db.exec(
    sql`SELECT count(*) AS total FROM votes WHERE card_id = ${cardId}`,
  );
  return Number(result.rows?.[0]?.total ?? 0);
}

/** Vote counts for every card on a board that has at least one vote. */
export async function countVotesByCard(
  db: Database,
  boardId: string,
): Promise<Map<string, number>> {
  let result = await db.exec(
    sql`SELECT card_id, count(*) AS total FROM votes WHERE board_id = ${boardId} GROUP BY card_id`,
  );
  return new Map(
    (result.rows ?? []).map((row) => [String(row.card_id), Number(row.total)]),
  );
}

async function hasVote(db: Database, cardId: string, memberId: string) {
  return (
    (await db.findOne(votes, { where: { card_id: cardId, member_id: memberId } })) !== null
  );
}

/**
 * Idempotent: voting twice leaves one vote, removing a missing vote is a no-op.
 * Returns null when the card does not exist on this board.
 */
export async function setCardVote(
  db: Database,
  boardId: string,
  cardId: string,
  memberId: string,
  voted: boolean,
): Promise<VoteResult | null> {
  let card = await db.findOne(cards, { where: { board_id: boardId, id: cardId } });
  if (!card) return null;

  if (voted) {
    if (!(await hasVote(db, cardId, memberId))) {
      try {
        await db.create(votes, { card_id: cardId, member_id: memberId, board_id: boardId });
      } catch (error) {
        // A concurrent request may have recorded the same vote first; that is fine.
        if (!(await hasVote(db, cardId, memberId))) throw error;
      }
    }
  } else {
    await db.deleteMany(votes, { where: { card_id: cardId, member_id: memberId } });
  }

  return {
    voted: await hasVote(db, cardId, memberId),
    count: await countVotes(db, cardId),
  };
}

/** Ids of the cards on this board that the member has voted for. */
export async function listViewerVotes(
  db: Database,
  boardId: string,
  memberId: string,
): Promise<string[]> {
  let rows = await db.findMany(votes, { where: { board_id: boardId, member_id: memberId } });
  return rows.map((row) => row.card_id);
}
