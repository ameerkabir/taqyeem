import { rankedTopics } from "./ranking.ts";
import type { Closure, SessionView, SharedSession } from "./types.ts";

/**
 * The immutable record of a meeting at the moment it closes. Everything is
 * deep-copied so later progress on actions never changes what was agreed.
 */
export function buildClosure(
  view: SessionView,
  state: SharedSession,
  at = new Date(),
): Closure {
  return {
    at: at.toISOString(),
    topics: rankedTopics(view),
    outcomes: structuredClone(state.outcomes),
    decisions: structuredClone(state.decisions),
    proposals: structuredClone(state.proposals),
    cards: structuredClone(view.cards),
    categories: structuredClone(view.categories),
  };
}
