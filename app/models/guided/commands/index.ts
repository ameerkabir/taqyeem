import { CommandError } from "../errors.ts";
import { recordCommand } from "../rate-limit.ts";
import { topics } from "../topics.ts";
import { requireThat, text } from "../validation.ts";
import type { Command, SessionView, SharedSession } from "../types.ts";
import { budget, configure, moveNote, ready } from "./collect.ts";
import { rename, theme, ungroup } from "./group.ts";
import { ballot, vote } from "./vote.ts";
import { decision, live, outcome } from "./discuss.ts";
import { complete, disposition, editProposal, propose } from "./proposals.ts";
import { advance, reopen } from "./progression.ts";
import { attachNote, notes } from "./late-notes.ts";
import type { CommandHandler } from "./types.ts";

export type { CommandContext, CommandHandler } from "./types.ts";

/** Every command kind the session accepts. Anything else is `invalid`. */
export const handlers: Readonly<Record<string, CommandHandler>> = {
  "move-note": moveNote,
  configure,
  ready,
  budget,
  theme,
  rename,
  ungroup,
  ballot,
  vote,
  live,
  outcome,
  decision,
  propose,
  "edit-proposal": editProposal,
  disposition,
  complete,
  advance,
  reopen,
  notes,
  "attach-note": attachNote,
};

/** The handler for a command kind, or undefined for an unknown kind. */
export function handlerFor(kind: string): CommandHandler | undefined {
  return Object.hasOwn(handlers, kind) ? handlers[kind] : undefined;
}

/**
 * Applies one command to a session and returns the new state. Pure: it never
 * touches the database, so it can be checked against a view and committed with
 * a revision-guarded UPDATE.
 *
 * Checks run in this order, so the first failure decides the error:
 * member → revision (`conflict`) → id format → rate limit → category setup →
 * known kind → facilitator → the handler's own rules.
 * @throws {CommandError}
 */
export function applyCommand(
  view: SessionView,
  memberId: string,
  command: Command,
  now = Date.now(),
): SharedSession {
  requireThat(view.members.some((m) => m.id === memberId), "forbidden", 403);
  let state = structuredClone(view.state);
  requireThat(
    Number.isSafeInteger(command.revision) && command.revision === view.revision,
    "conflict",
  );
  requireThat(
    typeof command.id === "string" && /^[0-9a-f-]{36}$/i.test(command.id),
    "invalid",
    400,
  );
  state.recent = recordCommand(state.recent, memberId, now);
  requireThat(
    state.categorySetup?.confirmed !== false || command.kind === "configure",
  );
  const handler = handlerFor(command.kind);
  if (!handler) {
    throw new CommandError("invalid", 400);
  }
  const facilitator = view.board.organiserMemberId === memberId;
  if (handler.facilitatorOnly) {
    requireThat(facilitator, "forbidden", 403);
  }
  handler.apply({
    view,
    state,
    memberId,
    command,
    facilitator,
    topic() {
      let id = text(command.topic, 100);
      requireThat(topics(view).some((t) => t.id === id), "invalid", 400);
      return id;
    },
  });
  return state;
}
