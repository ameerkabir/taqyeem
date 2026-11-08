import type { Board, BoardStatus, Category, Card, Member } from "../data/board.ts";

export type CreateCardResult =
  { ok: true; card: Card } | { ok: false; retryAfter: number };

/**
 * A joiner can be refused: the board is closed, or another member already has that name
 * (compared after normalising case, spacing and similar). null from joinBoard means no such board.
 */
export type JoinBoardResult =
  { ok: true; member: Member } | { ok: false; reason: "closed" | "name_taken" };

export interface VoteResult {
  voted: boolean;
  count: number;
}

export interface CreateBoardInput {
  title: string;
  organiserDisplayName: string;
  /** Stored verbatim as category labels, in the creator's language. */
  categoryLabels: readonly string[];
}

export interface CreateBoardResult {
  board: Board;
  organiser: Member;
}

export interface BoardModels {
  createBoard(input: CreateBoardInput): Promise<CreateBoardResult>;
  getBoard(id: string): Promise<Board | null>;
  setVotingOpen(boardId: string, votingOpen: boolean): Promise<Board | null>;
  setBoardStatus(boardId: string, status: BoardStatus): Promise<Board | null>;

  listCategories(boardId: string): Promise<Category[]>;
  listCards(boardId: string): Promise<Card[]>;
  getCard(boardId: string, cardId: string): Promise<Card | null>;

  updateCard(
    boardId: string,
    cardId: string,
    changes: Pick<Card, "body" | "categoryId" | "isAnonymous">,
  ): Promise<Card | null>;

  deleteCard(boardId: string, cardId: string): Promise<boolean>;

  createCard(card: Card, submissionId: string): Promise<CreateCardResult>;
  listMembers(boardId: string): Promise<Member[]>;
  /** Adds a participant. The caller records the returned member in the viewer's session. */
  joinBoard(boardId: string, displayName: string): Promise<JoinBoardResult | null>;
  listViewerVotes(boardId: string): Promise<string[]>;
  getViewerMemberId(boardId: string): Promise<string | null>;

  setCardVote(
    boardId: string,
    cardId: string,
    memberId: string,
    voted: boolean,
  ): Promise<VoteResult | null>;
}
