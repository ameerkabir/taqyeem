// The application's board shapes. Storage rows are snake_case (see tables.ts); the models
// convert them to these types, and everything above the models works with these.

export type BoardStatus = "collecting" | "meeting" | "closed";

export interface Board {
  id: string;
  title: string;
  organiserMemberId: string;
  status: BoardStatus;
  /** Set only for guided boards; see models/guided/policy.ts. */
  guidedStage?: string;
  guidedRevision?: number;
  /** Note-taking reopened after Collect (Group or Discuss only). */
  guidedNotesOpen?: boolean;
  categorySetupRequired?: boolean;
  votingOpen: boolean;
  currentSectionId: string | null;
}

export interface Category {
  id: string;
  boardId: string;
  label: string;
  position: number;
  tone?: number;
}

export interface Member {
  id: string;
  boardId: string;
  displayName: string;
}

export interface Card {
  id: string;
  boardId: string;
  categoryId: string;
  memberId: string;
  body: string;
  isAnonymous: boolean;
  voteCount: number;
  createdAt: string;
}
