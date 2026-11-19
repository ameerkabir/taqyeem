import type { Board } from "../../data/board.ts";
import type { GuidedStatus } from "./session.ts";

// The one place that decides how a guided session changes what the legacy board
// endpoints allow. Controllers ask these questions instead of reading guidedStage.

/** Projects a guided session onto the board shape the legacy endpoints understand. */
export function withGuidedStatus(
  board: Board,
  guided: GuidedStatus | null,
): Board {
  if (!guided) {
    return board;
  }
  return {
    ...board,
    guidedStage: guided.stage,
    guidedRevision: guided.revision,
    categorySetupRequired: guided.categorySetupRequired,
    guidedNotesOpen: guided.notesOpen,
    status:
      guided.stage === "summary"
        ? "closed"
        : guided.stage === "collect"
          ? "collecting"
          : "meeting",
    votingOpen: false,
  };
}

export function isGuided(board: Board): boolean {
  return board.guidedStage !== undefined;
}

/** Notes can be edited or deleted only while a guided board collects. */
export function guidedContributionsClosed(board: Board): boolean {
  return isGuided(board) && board.guidedStage !== "collect";
}

/** Stages where the facilitator may reopen note-taking. */
export const lateNoteStages: readonly string[] = ["group", "discuss"];

/**
 * New notes are accepted while collecting, or in Group and Discuss after the
 * facilitator reopens note-taking. Migration 0013 enforces the same rule.
 */
export function guidedNotesClosed(board: Board): boolean {
  if (!isGuided(board) || board.guidedStage === "collect") {
    return false;
  }
  return !(
    board.guidedNotesOpen === true &&
    lateNoteStages.includes(board.guidedStage!)
  );
}

/** On guided boards only the organiser moves notes between categories. */
export function canChangeCardCategory(board: Board, memberId: string): boolean {
  return !isGuided(board) || memberId === board.organiserMemberId;
}
