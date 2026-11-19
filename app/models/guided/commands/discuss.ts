import { requireThat, text } from "../validation.ts";
import type { CommandHandler } from "./types.ts";

/** Moves the whole team to a topic. Viewers' private reading is unaffected. */
export const live: CommandHandler = {
  facilitatorOnly: true,
  apply({ state, topic }) {
    requireThat(state.stage === "discuss");
    state.liveTopic = topic();
  },
};

/** Marks a topic discussed or skipped; never inferred. */
export const outcome: CommandHandler = {
  facilitatorOnly: true,
  apply({ state, command, topic }) {
    requireThat(state.stage === "discuss");
    requireThat(
      command.value === "discussed" || command.value === "skipped",
      "invalid",
      400,
    );
    state.outcomes[topic()] = command.value;
  },
};

/** Records the decision for a topic (up to 2,000 characters). */
export const decision: CommandHandler = {
  facilitatorOnly: true,
  apply({ state, command, topic }) {
    requireThat(state.stage === "discuss");
    state.decisions[topic()] = text(command.text, 2000);
  },
};
