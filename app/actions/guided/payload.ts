import type { SessionView, Closure } from "../../models/guided/session.ts";
import { tally } from "../../models/guided/session.ts";
import type { Card } from "../../data/board.ts";

/** Hides the author of other members' anonymous notes and drops per-card vote counts. */
function redactCard<C extends Card>(card: C, memberId: string): C {
  return {
    ...card,
    memberId:
      card.isAnonymous && card.memberId !== memberId ? "" : card.memberId,
    voteCount: 0,
  };
}

/** A closed meeting record as one member may see it. */
export function redactMeetingRecord(
  closure: Closure,
  memberId: string,
): Closure {
  return {
    ...closure,
    cards: closure.cards.map((card) => redactCard(card, memberId)),
  };
}

/**
 * The session as one member may see it: only their own ballot and ready flag,
 * no receipts or rate-limit history, anonymous authors hidden, and vote totals
 * only once a ballot has closed.
 */
export function viewerPayload(view: SessionView, memberId: string) {
  const state = {
    ...view.state,
    receipts: {} as Record<string, string>,
    recent: {} as Record<string, number[]>,
    receipt: undefined,
    ready: { [memberId]: view.state.ready[memberId] ?? false },
    votes: { [memberId]: view.state.votes[memberId] ?? [] },
    closure: view.state.closure
      ? redactMeetingRecord(view.state.closure, memberId)
      : null,
  };
  return {
    ...view,
    model: "guided-v1",
    cards: view.cards.map((card) => redactCard(card, memberId)),
    state,
    memberId,
    counts:
      !view.state.ballotOpen && view.state.ballot > 0 ? tally(view.state) : {},
    legacyCardVotes: Object.fromEntries(
      view.state.legacy ? view.cards.map((c) => [c.id, c.voteCount]) : [],
    ),
    doneCount: Object.values(view.state.ready).filter(Boolean).length,
  };
}
/** The JSON the workspace renders and polls. */
export type ViewerPayload = ReturnType<typeof viewerPayload>;
