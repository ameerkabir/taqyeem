import {
  board,
  cards,
  categories,
  members,
  viewerMemberId,
  viewerVotedCardIds,
  type Card,
} from "../data/fake-board.ts";
import type { BoardModels } from "./boards.ts";

// Shared between requests in this Worker instance, just like the demo cards.
const defaultStore = { cards, submissions: new Map<string, Card>() };

export function createFakeBoardModels(store = defaultStore): BoardModels {
  return {
    getBoard: async (id) => (board.id === id ? board : null),
    listCategories: async (boardId: string) =>
      categories
        .filter((cat) => cat.boardId === boardId)
        .sort((a, b) => a.position - b.position),
    listCards: async (boardId: string) =>
      store.cards.filter((c) => c.boardId === boardId),

    createCard: async (card: Card, submissionId: string) => {
      let key = JSON.stringify([card.boardId, card.memberId, submissionId]);
      let existing = store.submissions.get(key);
      if (existing) return existing;

      // No await between lookup and insertion: concurrent calls cannot interleave.
      // A database implementation must enforce this with a unique constraint.
      store.cards.push(card);
      store.submissions.set(key, card);
      return card;
    },

    listMembers: async (boardId: string) =>
      members.filter((m) => m.boardId === boardId),

    listViewerVotes: async (boardId: string) => [...viewerVotedCardIds],

    // Later a device-cookie middleware identifies the member.
    getViewerMemberId: async (boardId: string) => viewerMemberId,
  };
}
