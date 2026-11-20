import { requireThat } from "../validation.ts";
import type { CommandHandler } from "./types.ts";

/** Facilitator reopens (or closes) note-taking for everyone in Group or Discuss. */
export const notes: CommandHandler = {
  facilitatorOnly: true,
  apply({ state, command }) {
    requireThat(state.stage === "group" || state.stage === "discuss");
    requireThat(typeof command.value === "boolean", "invalid", 400);
    state.notesOpen = command.value;
  },
};

/**
 * Attaches a note its author just added in Discuss to the topic they were
 * reading. A theme gains the note; an ungrouped note becomes a theme with the
 * same id and title, so its votes, outcome and decision stay keyed to it.
 */
export const attachNote: CommandHandler = {
  facilitatorOnly: false,
  apply({ view, state, memberId, command, topic }) {
    requireThat(state.stage === "discuss" && state.notesOpen === true);
    const card = view.cards.find((c) => c.id === command.card);
    requireThat(!!card && card.memberId === memberId, "invalid", 400);
    requireThat(
      !state.themes.some((t) => t.notes.includes(card.id)),
      "conflict",
    );
    const target = topic();
    requireThat(target !== card.id, "invalid", 400);
    const theme = state.themes.find((t) => t.id === target);
    if (theme) {
      theme.notes.push(card.id);
      return;
    }
    const source = view.cards.find((c) => c.id === target);
    requireThat(!!source, "invalid", 400);
    state.themes.push({
      id: source.id,
      title: source.body,
      notes: [source.id, card.id],
    });
  },
};
