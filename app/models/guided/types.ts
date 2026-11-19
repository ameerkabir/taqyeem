import type { Board, Card, Category, Member } from "../../data/board.ts";
import type { Stage } from "./stages.ts";
import type { Theme, Topic } from "./topics.ts";

/** Where a proposed action stands. Only the facilitator moves it past `suggested`. */
export type Disposition = "suggested" | "agreed" | "deferred" | "declined";

export interface Proposal {
  id: string;
  text: string;
  /** Topic id it came from, or "" for a general action. */
  topic: string;
  author: string;
  /** Member id, or "" when unassigned. */
  owner: string;
  /** Calendar day `YYYY-MM-DD`, or "". */
  due: string;
  disposition: Disposition;
  /** Follow-up progress; tracked separately from the agreement itself. */
  completed: boolean;
  updatedAt: string;
}

/** An immutable snapshot taken when the meeting closes. */
export interface Closure {
  at: string;
  topics: Topic[];
  outcomes: Record<string, string>;
  decisions: Record<string, string>;
  proposals: Proposal[];
  cards: Card[];
  categories: Category[];
}

/** One dated closure, stored separately so reopening never rewrites it. */
export interface MeetingRecord {
  version: number;
  closedAt: string;
  closure: Closure;
}

/**
 * The shared, revisioned state of a guided meeting, stored as JSON in
 * `guided_sessions.data`. Every change goes through `applyCommand`.
 */
export interface SharedSession {
  stage: Stage;
  /** Present on new boards; `confirmed: false` blocks notes until the facilitator picks categories. */
  categorySetup?: {
    confirmed: boolean;
    categories: { id: string; label: string; tone: number }[];
  };
  themes: Theme[];
  /** Votes each member may cast per ballot. */
  budget: number;
  /** Ballot number; increments each time voting (re)opens. */
  ballot: number;
  ballotOpen: boolean;
  /** Member id → topic ids. Private until the ballot closes (see viewerPayload). */
  votes: Record<string, string[]>;
  ready: Record<string, boolean>;
  /** The topic the team is discussing; viewers may read others privately. */
  liveTopic: string;
  outcomes: Record<string, "discussed" | "skipped">;
  decisions: Record<string, string>;
  proposals: Proposal[];
  /** Always `{}`; kept so stored JSON keeps its shape. Receipts live in `guided_command_receipts`. */
  receipts: Record<string, string>;
  /**
   * The command that produced this revision. Database triggers copy it into
   * `guided_command_receipts` (for replay) and apply `move` to the card row.
   */
  receipt?: {
    id: string;
    member: string;
    fingerprint: string;
    kind?: string;
    move?: { card: string; fromCategory: string; categoryId: string };
  };
  closure: Closure | null;
  closureVersion?: number;
  /** Converted from a pre-guided board: no outcomes are invented for it. */
  legacy: boolean;
  /** Member id → command timestamps in the last minute, for rate limiting. */
  recent?: Record<string, number[]>;
}

/** A session together with the board evidence it was read alongside. */
export interface SessionView {
  revision: number;
  state: SharedSession;
  board: Board;
  cards: Card[];
  categories: Category[];
  members: Member[];
  history?: { version: number; closedAt: string }[];
}

/** A request to change the session. `kind` selects the handler; other fields depend on it. */
export interface Command {
  /** Client-generated UUID; the same id and payload replays instead of applying twice. */
  id: string;
  /** The revision the client last saw; any other revision is a conflict. */
  revision: number;
  kind: string;
  [key: string]: unknown;
}

/** The guided facts every board request needs, in one read. */
export interface GuidedStatus {
  stage: Stage;
  revision: number;
  categorySetupRequired: boolean;
}
