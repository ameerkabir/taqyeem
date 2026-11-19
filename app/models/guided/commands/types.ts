import type { Command, SessionView, SharedSession } from "../types.ts";

/** What a command handler gets: the view it was checked against and a state to change. */
export interface CommandContext {
  view: SessionView;
  /** A deep copy of `view.state`; handlers mutate it in place. */
  state: SharedSession;
  memberId: string;
  command: Command;
  /** Whether `memberId` is the board's organiser. */
  facilitator: boolean;
  /** Reads `command.topic` and checks it names a current topic. */
  topic(): string;
}

export interface CommandHandler {
  /**
   * Only the facilitator may send it. Checked before `apply` and again by the
   * conditional UPDATE (`role='organiser'`), so a demoted member cannot race it.
   */
  facilitatorOnly: boolean;
  /**
   * Database triggers also write other rows for it (cards, categories or meeting
   * records), so the caller re-reads the session instead of trusting `state`.
   */
  changesEvidence?: boolean;
  /** Validates the command and applies it to `ctx.state`, throwing CommandError on refusal. */
  apply(ctx: CommandContext): void;
}
