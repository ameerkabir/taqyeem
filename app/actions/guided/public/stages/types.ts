import type { RemixNode } from "remix/component";
import type { Card, Category } from "../../../../data/board.ts";
import type { Locale } from "../../../../i18n/locales.ts";
import type { Translator } from "../../../../i18n/translator.ts";
import type {
  MeetingRecord,
  Proposal,
  SharedSession,
  Topic,
} from "../../../../models/guided/session.ts";
import type { ViewerPayload } from "../../payload.ts";
import type { CommandProps } from "../command-form.tsx";

/** The view options read from the URL when the workspace first renders. */
export interface InitialView {
  category: string;
  topic: string;
  filter: string;
  capture?: string;
  captureNote?: string;
  decision?: string;
  step?: string;
}

/**
 * Everything one render of the workspace needs, worked out once by the shell
 * and handed to each section's render function. Sections never keep state;
 * they call the actions here, which update the shell and re-render.
 */
export interface WorkspaceView {
  // Session data
  /** The live payload (current state, members, history). */
  data: ViewerPayload;
  /** What to show: an archived record's snapshot, or `data` itself. */
  display: ViewerPayload;
  /** The state shown, with the stage being viewed and any archived closure. */
  state: SharedSession;
  record: MeetingRecord | null | undefined;
  initialView: InitialView | undefined;

  // Who is viewing and how
  facilitator: boolean;
  /** Facilitator viewing the live stage (not a review or record). */
  canManage: boolean;
  /** Reviewing a past step or an archived record. */
  readOnly: boolean;
  pending: boolean;
  error: string;
  status: string;
  needsJoin: boolean;
  rootId: string;
  locale: Locale;
  t: Translator["t"];
  formatNumber: Translator["formatNumber"];

  // Topics
  topics: Topic[];
  /** Topics by votes, used by the agenda. */
  ranked: Topic[];
  /** The topic the team is discussing. */
  sharedTopic: Topic | undefined;
  /** The topic this viewer is reading (private choice, else shared, else first). */
  active: Topic | undefined;
  /** Non-empty while the viewer reads a topic other than the team's. */
  privateTopic: string;
  /** Topic ids this viewer voted for. */
  mine: string[];
  initialCaptureTopic: string;
  initialDecisionTopic: string | undefined;

  // Collect
  category: string;
  currentCategory: Category | undefined;
  lanes: Category[];
  dropCategory: string;
  canMoveNotes: boolean;
  /** New notes are accepted now: Collect, or reopened in Group or Discuss. */
  notesAllowed: boolean;
  submission: string;

  // Actions
  filter: string;
  filtered: Proposal[];
  canFilter: boolean;
  matches(proposal: Proposal, filter: string): boolean;

  // Shared render helpers
  command(kind: string, fields: CommandProps["fields"], label: string): RemixNode;
  note(card: Card, select?: boolean): RemixNode;
  evidence(topic: Topic): RemixNode;
  actionCard(proposal: Proposal, historical?: boolean): RemixNode;
  viewHref(values?: Record<string, string>): string;

  // Actions back into the shell
  /** Reads `topicId` privately; "" follows the team again. */
  viewTopic(topicId: string): void;
  showAllActions(): void;
  /** Opens the note dialog, preset to `categoryId` when a lane passes one. */
  openNote(categoryId?: string): void;
  closeNote(): void;
  discardNote(): void;
  /** Opens the action editor, pre-filled from a note or topic when empty. */
  capture(card?: Card, topic?: Topic): void;
  /** Opens the decision editor for a topic, pre-filled with any decision. */
  recordDecision(topic: Topic): void;
  persist(): void;
  refresh(announce?: boolean): void;
  copy(value: string): void;
  /** Copies the invitation link; the button shows the outcome. */
  copyInvite(): void;
  inviteCopy: "idle" | "copied" | "failed";
  summaryText(): string;
  inviteUrl: string;
}
