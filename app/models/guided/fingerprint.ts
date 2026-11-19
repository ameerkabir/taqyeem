import { requireThat } from "./validation.ts";
import type { Command } from "./types.ts";

/** Commands larger than this are rejected before hashing. */
export const maxCommandBytes = 65536;

/**
 * Identifies a command's payload independent of the revision it was sent at, so a
 * lost-response retry matches its first attempt. Replay also accepts `raw`, for
 * receipts that stored the JSON itself rather than its SHA-256 digest.
 * @throws {CommandError} `invalid` (400) for oversized commands.
 */
export async function commandFingerprint(
  command: Command,
): Promise<{ raw: string; digest: string }> {
  const raw = JSON.stringify({ ...command, revision: undefined });
  requireThat(raw.length <= maxCommandBytes, "invalid", 400);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const digest = Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return { raw, digest };
}
