import { requireThat } from "../validation.ts";
import type { CommandHandler } from "./types.ts";

/**
 * Closes or reopens the ballot. Reopening starts a new ballot number but keeps
 * each member's choices; `ballot` must match so a stale tab cannot toggle it.
 */
export const ballot: CommandHandler = {
  facilitatorOnly: true,
  apply({ state, command }) {
    requireThat(state.stage === "vote");
    requireThat(typeof command.value === "boolean", "invalid", 400);
    requireThat(command.ballot === state.ballot, "conflict");
    if (command.value && !state.ballotOpen) {
      state.ballot++;
      state.ready = {};
    }
    state.ballotOpen = command.value;
  },
};

/** Adds or removes one vote for a topic, within the member's budget. */
export const vote: CommandHandler = {
  facilitatorOnly: false,
  apply({ state, memberId, command, topic }) {
    requireThat(state.stage === "vote" && state.ballotOpen);
    requireThat(command.ballot === state.ballot, "conflict");
    let id = topic();
    requireThat(typeof command.value === "boolean", "invalid", 400);
    let mine = new Set(state.votes[memberId] ?? []);
    if (command.value) {
      mine.add(id);
      requireThat(mine.size <= state.budget, "budget");
    } else {
      mine.delete(id);
    }
    state.votes[memberId] = [...mine];
  },
};
