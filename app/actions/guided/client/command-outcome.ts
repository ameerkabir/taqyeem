/** What the workspace does locally after a command form is committed. */
export interface CommandOutcome {
  /** Follow the moved note into its new category lane. */
  followCategory: boolean;
  /** Drop the private topic preview because the live topic changed. */
  clearPrivateTopic: boolean;
  /** Clear the drafted form (only when it was not edited while saving). */
  clearsDraft: boolean;
  /** Keep the drafted new-theme title (adding notes to an existing theme). */
  keepsTitle: boolean;
}

const draftKinds = new Set(["theme", "propose", "decision"]);

/**
 * The local follow-up for a committed command.
 * @param kind The command kind that was submitted.
 * @param addsToExistingTheme Whether a theme command targeted an existing theme.
 */
export function commandOutcome(
  kind: string,
  addsToExistingTheme = false,
): CommandOutcome {
  return {
    followCategory: kind === "move-note",
    clearPrivateTopic: kind === "live" || kind === "reopen",
    clearsDraft: draftKinds.has(kind),
    keepsTitle: kind === "theme" && addsToExistingTheme,
  };
}

/** True when the server refused the request because the viewer is not a board member. */
export function isNotMemberResponse(response: Response) {
  return (
    response.status === 403 &&
    response.headers.get("X-Access-Reason") === "not_member"
  );
}
