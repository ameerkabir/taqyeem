import type { Board, Category, Card, Member } from "../data/fake-board.ts";

export type CreateCardResult =
  { ok: true; card: Card } | { ok: false; retryAfter: number };

export interface BoardModels {
  getBoard(id: string): Promise<Board | null>;
  listCategories(boardId: string): Promise<Category[]>;
  listCards(boardId: string): Promise<Card[]>;
  createCard(card: Card, submissionId: string): Promise<CreateCardResult>;
  listMembers(boardId: string): Promise<Member[]>;
  listViewerVotes(boardId: string): Promise<string[]>;
  getViewerMemberId(boardId: string): Promise<string | null>;
}
