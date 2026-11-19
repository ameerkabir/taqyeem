import type { SessionView, Closure } from "../../models/guided/session.ts";
import { tally } from "../../models/guided/session.ts";
import type { Card } from "../../data/board.ts";
export function redactMeetingRecord(
  closure: Closure,
  memberId: string,
): Closure {
  return {
    ...closure,
    cards: closure.cards.map((card) => ({
      ...card,
      memberId:
        card.isAnonymous && card.memberId !== memberId ? "" : card.memberId,
      voteCount: 0,
    })),
  };
}
export function viewerPayload(view: SessionView, memberId: string) {
  const safeCard = (card: Card) => ({
    ...card,
    memberId:
      card.isAnonymous && card.memberId !== memberId ? "" : card.memberId,
    voteCount: 0,
  });
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
    cards: view.cards.map(safeCard),
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
export type ViewerPayload = ReturnType<typeof viewerPayload>;
