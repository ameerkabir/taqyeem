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

/** Notes can be added, edited or deleted only while a guided board collects. */
export function guidedContributionsClosed(board: Board): boolean {
  return isGuided(board) && board.guidedStage !== "collect";
}

/** On guided boards only the organiser moves notes between categories. */
export function canChangeCardCategory(board: Board, memberId: string): boolean {
  return !isGuided(board) || memberId === board.organiserMemberId;
}
