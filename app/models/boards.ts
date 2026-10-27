import type { Board, Category, Card, Member } from "../data/fake-board.ts";

export interface BoardModels {
  getBoard(id: string): Promise<Board | null>;
  listCategories(boardId: string): Promise<Category[]>;
  listCards(boardId: string): Promise<Card[]>;
  listMembers(boardId: string): Promise<Member[]>;
}
