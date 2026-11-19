import { requireThat } from "./validation.ts";
import type { SharedSession } from "./types.ts";

export const commandsPerMinute = 60;
const windowMs = 60_000;

/**
 * Records one command for `memberId` and returns the updated timestamps map.
 * @throws {CommandError} `rate` (429) once a member sends 60 commands in a minute.
 */
export function recordCommand(
  recent: SharedSession["recent"],
  memberId: string,
  now: number,
): NonNullable<SharedSession["recent"]> {
  const window = (recent?.[memberId] ?? []).filter((at) => at > now - windowMs);
  requireThat(window.length < commandsPerMinute, "rate", 429);
  return { ...recent, [memberId]: [...window, now] };
}
