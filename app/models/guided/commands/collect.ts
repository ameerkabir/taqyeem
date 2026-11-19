import { requireThat, validateCategoryLabels } from "../validation.ts";
import type { CommandHandler } from "./types.ts";

/** Facilitator moves any note to another category while collecting. */
export const moveNote: CommandHandler = {
  facilitatorOnly: true,
  changesEvidence: true,
  apply({ view, state, command }) {
    requireThat(state.stage === "collect", "forbidden", 403);
    const card = view.cards.find((card) => card.id === command.card);
    requireThat(!!card, "invalid", 400);
    requireThat(card.categoryId === command.fromCategory, "conflict");
    requireThat(
      view.categories.some((category) => category.id === command.categoryId),
      "invalid",
      400,
    );
  },
};

/** One-time category choice (classic or 1–8 custom) before any note exists. */
export const configure: CommandHandler = {
  facilitatorOnly: true,
  changesEvidence: true,
  apply({ view, state, command }) {
    requireThat(
      state.stage === "collect" &&
        view.cards.length === 0 &&
        state.categorySetup?.confirmed === false,
    );
    requireThat(
      command.choice === "classic" || command.choice === "custom",
      "invalid",
      400,
    );
    const classic = command.choice === "classic";
    const labels = validateCategoryLabels(
      classic ? view.categories.map((c) => c.label) : command.labels,
    );
    state.categorySetup = {
      confirmed: true,
      categories: labels.map((label, i) => ({
        // Classic keeps the existing ids so nothing referencing them breaks.
        id: classic ? view.categories[i].id : crypto.randomUUID(),
        label,
        tone: i % 4,
      })),
    };
  },
};

/** A member marks themselves done (or not) while collecting or voting. */
export const ready: CommandHandler = {
  facilitatorOnly: false,
  apply({ state, memberId, command }) {
    requireThat(
      state.stage === "collect" || (state.stage === "vote" && state.ballotOpen),
    );
    requireThat(typeof command.value === "boolean", "invalid", 400);
    state.ready[memberId] = command.value;
  },
};

/** Votes per member (1–20), set before voting starts. */
export const budget: CommandHandler = {
  facilitatorOnly: true,
  apply({ state, command }) {
    requireThat(state.stage === "collect" || state.stage === "group");
    requireThat(
      Number.isInteger(command.value) &&
        Number(command.value) >= 1 &&
        Number(command.value) <= 20,
      "invalid",
      400,
    );
    state.budget = Number(command.value);
  },
};
