import {
  viewerMemberId,
  type Board,
  type Member,
  type Category,
  type Card,
} from "../data/fake-board.ts";
import type { BoardModels } from "./boards.ts";
import { createFakeBoardStore, type FakeBoardStore } from "./fake-board-store.ts";
import { DEFAULT_CATEGORY_LABELS } from "../data/board-defaults.ts";

// Shared between requests in this Worker instance, just like the demo cards.
export const defaultStore = createFakeBoardStore();
export const MAX_CARDS = 5;
export const WINDOW_MS = 60_000;

export function createFakeBoardModels(
  store: FakeBoardStore = defaultStore,
  now: () => number = Date.now,
  resolveViewerMemberId: (
    boardId: string,
  ) => Promise<string | null> = async () => viewerMemberId,
): BoardModels {
  function withVoteCount(card: Card): Card {
    let key = JSON.stringify([card.boardId, card.id]);

    return {
      ...card,
      voteCount: store.votes.get(key)?.size ?? 0,
    };
  }

  return {
    createBoard: async ({ title, organiserDisplayName }) => {
      let boardId = crypto.randomUUID();
      let organiserId = crypto.randomUUID();

      let board: Board = {
        id: boardId,
        title,
        organiserMemberId: organiserId,
        status: "collecting",
        votingOpen: false,
        currentSectionId: null,
      };

      let organiser: Member = {
        id: organiserId,
        boardId,
        displayName: organiserDisplayName,
      };

      let categories: Category[] = DEFAULT_CATEGORY_LABELS.map(
        (label, position) => ({
          id: crypto.randomUUID(),
          boardId,
          label,
          position,
        }),
      );

      store.boards.set(board.id, board);
      store.members.push(organiser);
      store.categories.push(...categories);

      return { board, organiser };
    },

    getBoard: async (id) => store.boards.get(id) ?? null,
    setVotingOpen: async (boardId, votingOpen) => {
      let board = store.boards.get(boardId);
      if (!board) return null;

      board.votingOpen = votingOpen;
      return board;
    },

    setBoardStatus: async (boardId, status) => {
      let board = store.boards.get(boardId);
      if (!board) return null;

      board.status = status;
      if (status === "closed") {
        board.votingOpen = false;
      }

      return board;
    },

    listCategories: async (boardId: string) =>
      store.categories
        .filter((cat) => cat.boardId === boardId)
        .sort((a, b) => a.position - b.position),
    listCards: async (boardId: string) =>
      store.cards.filter((c) => c.boardId === boardId).map(withVoteCount),

    createCard: async (card: Card, submissionId: string) => {
      let key = JSON.stringify([card.boardId, card.memberId, submissionId]);
      let existing = store.submissions.get(key);
      if (existing) return { ok: true, card: existing };

      let currentTime = now();
      let recentCards = store.cards.filter(
        (saved) =>
          saved.boardId === card.boardId &&
          saved.memberId === card.memberId &&
          Date.parse(saved.createdAt) > currentTime - WINDOW_MS,
      );

      if (recentCards.length >= MAX_CARDS) {
        let oldestTime = Math.min(
          ...recentCards.map((saved) => Date.parse(saved.createdAt)),
        );
        let retryAfter = Math.max(
          1,
          Math.ceil((oldestTime + WINDOW_MS - currentTime) / 1000),
        );
        return { ok: false, retryAfter };
      }

      // No await between lookup and insertion: concurrent calls cannot interleave.
      // A database implementation must enforce this with a unique constraint.
      store.cards.push(card);
      store.submissions.set(key, card);
      return { ok: true, card };
    },

    getCard: async (boardId, cardId) => {
      let card = store.cards.find(
        (card) => card.boardId === boardId && card.id === cardId,
      );

      if (!card) {
        return null;
      }

      return withVoteCount(card) ?? null;
    },

    updateCard: async (boardId, cardId, changes) => {
      let card = store.cards.find(
        (saved) => saved.boardId === boardId && saved.id === cardId,
      );
      if (!card) return null;
      // Only editable fields may change, even if a caller supplies extra properties.
      card.body = changes.body;
      card.categoryId = changes.categoryId;
      card.isAnonymous = changes.isAnonymous;
      return card;
    },

    deleteCard: async (boardId, cardId) => {
      let index = store.cards.findIndex(
        (card) => card.boardId === boardId && card.id === cardId,
      );
      if (index === -1) {
        return false;
      }
      store.cards.splice(index, 1);
      return true;
    },
    listMembers: async (boardId: string) =>
      store.members.filter((m) => m.boardId === boardId),

    listViewerVotes: async (boardId: string) => {
      let memberId = await resolveViewerMemberId(boardId);
      if (!memberId) return [];

      return store.cards
        .filter((card) => {
          if (card.boardId !== boardId) {
            return false;
          }
          let key = JSON.stringify([boardId, card.id]);
          return store.votes.get(key)?.has(memberId) ?? false;
        })
        .map((card) => card.id);
    },

    getViewerMemberId: resolveViewerMemberId,

    setCardVote: async (boardId, cardId, memberId, voted) => {
      let card = store.cards.find(
        (c) => c.boardId === boardId && c.id === cardId,
      );

      if (!card) {
        return null;
      }

      let key = JSON.stringify([boardId, cardId]);

      let voters = store.votes.get(key);

      if (!voters) {
        voters = new Set<string>();
        store.votes.set(key, voters);
      }

      if (voted) {
        voters.add(memberId);
      } else {
        voters.delete(memberId);
      }

      return {
        voted: voters.has(memberId),
        count: voters.size,
      };
    },
  };
}
