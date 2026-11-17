/**
 * A rejected command. `code` maps to a translated message (`guided.error.<code>`)
 * and `status` to the HTTP response.
 */
export class CommandError extends Error {
  constructor(
    public code:
      | "conflict"
      | "forbidden"
      | "invalid"
      | "duplicateTheme"
      | "locked"
      | "budget"
      | "rate"
      | "storage",
    public status = 409,
  ) {
    super(code);
  }
}

/** Whether a storage error came from the database's Collect-only note guard. */
export function isCollectLock(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    if (current.message.includes("collect_only")) {
      return true;
    }
  }
  return false;
}
