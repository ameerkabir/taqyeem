import { buildClosure } from "../closure.ts";
import { rankedTopics } from "../ranking.ts";
import { stages } from "../stages.ts";
import { topics } from "../topics.ts";
import { requireThat } from "../validation.ts";
import type { CommandHandler } from "./types.ts";

/**
 * Moves the team to the next stage. Entering Vote opens a fresh ballot, entering
 * Discuss starts on the top-ranked topic, and entering Summary records a closure.
 */
export const advance: CommandHandler = {
  facilitatorOnly: true,
  apply({ view, state }) {
    requireThat(state.stage !== "summary");
    if (state.stage === "vote") {
      requireThat(!state.ballotOpen);
    }
    let next = stages[stages.indexOf(state.stage) + 1];
    state.stage = next;
    state.ready = {};
    state.notesOpen = false;
    if (next === "vote") {
      state.ballot++;
      state.ballotOpen = true;
      state.votes = {};
    }
    if (next === "discuss") {
      state.liveTopic = rankedTopics(view)[0]?.id ?? "";
    }
    if (next === "summary") {
      state.closureVersion = (state.closureVersion ?? 0) + 1;
      state.closure = buildClosure(view, state);
    }
  },
};

/**
 * Resumes Discuss after closing. The stored meeting record is untouched; the
 * next close saves a new version. `version` must name the current closure.
 */
export const reopen: CommandHandler = {
  facilitatorOnly: true,
  changesEvidence: true,
  apply({ view, state, command }) {
    requireThat(state.stage === "summary" && state.closure !== null);
    const version = state.closureVersion ?? 1;
    requireThat(
      Number.isSafeInteger(command.version) && command.version === version,
      "conflict",
    );
    state.closureVersion = version;
    state.closure = null;
    state.stage = "discuss";
    state.ready = {};
    state.notesOpen = false;
    state.ballotOpen = false;
    if (!topics(view).some((topic) => topic.id === state.liveTopic)) {
      state.liveTopic = rankedTopics(view)[0]?.id ?? "";
    }
  },
};
