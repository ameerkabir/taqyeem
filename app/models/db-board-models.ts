import type { Database } from "remix/data-table";
import type { Member } from "../data/board.ts";
import { loadBoard, loadCategories, loadMembers } from "./boards/load.ts";
import { setBoardStatus, setVotingOpen } from "./boards/state.ts";
import type { BoardModels } from "./board-models.ts";
import {
  createCard,
  deleteCard,
  getCard,
  listCards,
  updateCard,
} from "./cards/card.ts";
import { createBoard } from "./boards/create.ts";
import { listViewerVotes, setCardVote } from "./cards/vote.ts";

/**
 * The BoardModels the controllers use, backed by a Database. Each method delegates to the
 * model functions that own the queries and rules; this is the one place that adapts the
 * interface to them.
 *
 * `resolveViewerMemberId` says who the current request is on a board (from the session).
 */
export function createDbBoardModels(
  db: Database,
  resolveViewerMemberId: (boardId: string) => Promise<string | null>,
): BoardModels {
  return {
    async createBoard(input) {
      let created = await createBoard(db, input);
      let board = await loadBoard(db, created.board.id);
      // createBoard has just written the organiser, so the board is live.
      if (!board) throw new Error("A newly created board could not be loaded");
      let organiser: Member = {
        id: created.organiser.id,
        boardId: created.organiser.board_id,
        displayName: created.organiser.display_name,
      };
      return { board, organiser };
    },

    getBoard: (id) => loadBoard(db, id),
    setVotingOpen: (boardId, votingOpen) => setVotingOpen(db, boardId, votingOpen),
    setBoardStatus: (boardId, status) => setBoardStatus(db, boardId, status),

    listCategories: (boardId) => loadCategories(db, boardId),
    listMembers: (boardId) => loadMembers(db, boardId),

    listCards: (boardId) => listCards(db, boardId),
    getCard: (boardId, cardId) => getCard(db, boardId, cardId),
    updateCard: (boardId, cardId, changes) => updateCard(db, boardId, cardId, changes),
    deleteCard: (boardId, cardId) => deleteCard(db, boardId, cardId),

    // The interface passes a full Card; createdAt and voteCount are not inputs because
    // the database stamps the time and votes are counted.
    createCard: (card, submissionId) =>
      createCard(
        db,
        {
          id: card.id,
          boardId: card.boardId,
          categoryId: card.categoryId,
          memberId: card.memberId,
          body: card.body,
          isAnonymous: card.isAnonymous,
        },
        submissionId,
      ),

    getViewerMemberId: resolveViewerMemberId,
    async listViewerVotes(boardId) {
      let memberId = await resolveViewerMemberId(boardId);
      return memberId ? listViewerVotes(db, boardId, memberId) : [];
    },
    setCardVote: (boardId, cardId, memberId, voted) =>
      setCardVote(db, boardId, cardId, memberId, voted),
  };
}
