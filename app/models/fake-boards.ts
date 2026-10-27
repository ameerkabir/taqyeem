import { board, cards, categories, members } from "../data/fake-board.ts";
import type { BoardModels } from "./boards.ts";

export function createFakeBoardModels(): BoardModels {
  return {
    getBoard: async (id) => (board.id === id ? board : null),
    listCategories: async (boardId: string) =>
      categories
        .filter((cat) => cat.boardId === boardId)
        .sort((a, b) => a.position - b.position),
    listCards: async (boardId: string) =>
      cards.filter((c) => c.boardId === boardId),

    listMembers: async (boardId: string) =>
      members.filter((m) => m.boardId === boardId),
  };
}
