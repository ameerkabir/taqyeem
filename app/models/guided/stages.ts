export const stages = [
  "collect",
  "group",
  "vote",
  "discuss",
  "actions",
  "summary",
] as const;
export type Stage = (typeof stages)[number];
export function reviewStage(current: Stage, requested?: string): Stage {
  return stages.includes(requested as Stage) &&
    stages.indexOf(requested as Stage) <= stages.indexOf(current)
    ? (requested as Stage)
    : current;
}
