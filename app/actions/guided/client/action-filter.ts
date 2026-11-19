import type { Proposal } from "../../../models/guided/session.ts";

export const actionFilters = [
  "all",
  "suggested",
  "agreed",
  "deferred",
  "declined",
  "open",
  "completed",
  "mine",
] as const;
export type ActionFilter = (typeof actionFilters)[number];

/** A filter value from a URL or saved view, or "all" when it is not one we know. */
export function parseActionFilter(value: string | undefined): ActionFilter {
  return actionFilters.includes(value as ActionFilter)
    ? (value as ActionFilter)
    : "all";
}

/** Filters only appear once there are more records than fit at a glance. */
export function canFilterActions(count: number): boolean {
  return count > 3;
}

/** Whether a proposal belongs in the list for the chosen filter. */
export function matchesActionFilter(
  proposal: Proposal,
  filter: string,
  memberId: string,
): boolean {
  return (
    filter === "all" ||
    (filter === "mine" && proposal.owner === memberId) ||
    (filter === "open" && proposal.disposition === "agreed" && !proposal.completed) ||
    (filter === "completed" && proposal.disposition === "agreed" && proposal.completed) ||
    proposal.disposition === filter
  );
}
