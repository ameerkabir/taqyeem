import { topics, type Topic } from "./topics.ts";
import type { SessionView, SharedSession } from "./types.ts";

/** Votes per topic id across every member's current ballot. */
export function tally(state: SharedSession): Record<string, number> {
  let counts: Record<string, number> = {};
  for (let votes of Object.values(state.votes))
    for (let id of votes) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

/** Topics by votes, most first; ties (including zero votes) keep source order. */
export function rankedTopics(view: Pick<SessionView, "cards" | "state">): Topic[] {
  let counts = tally(view.state);
  return topics(view).sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
}
