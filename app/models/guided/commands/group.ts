import { requireThat, uniqueThemeTitle } from "../validation.ts";
import type { CommandHandler } from "./types.ts";

/**
 * Groups ungrouped notes: into an existing theme when `theme` is set, otherwise
 * into a new theme (whose id is the command id) with a unique title.
 */
export const theme: CommandHandler = {
  facilitatorOnly: true,
  apply({ view, state, command }) {
    requireThat(state.stage === "group");
    let target = state.themes.find((theme) => theme.id === command.theme);
    requireThat(
      command.theme === undefined || command.theme === "" || target,
      "invalid",
      400,
    );
    let ids = command.notes;
    requireThat(
      Array.isArray(ids) &&
        ids.length > 0 &&
        ids.every(
          (id) => typeof id === "string" && view.cards.some((c) => c.id === id),
        ),
      "invalid",
      400,
    );
    requireThat(
      new Set(ids).size === ids.length &&
        !state.themes.some((t) => t.notes.some((id) => ids.includes(id))),
      "invalid",
      400,
    );
    if (target) target.notes.push(...ids);
    else
      state.themes.push({
        id: command.id,
        title: uniqueThemeTitle(state, command.title),
        notes: ids,
      });
  },
};

export const rename: CommandHandler = {
  facilitatorOnly: true,
  apply({ state, command }) {
    requireThat(state.stage === "group");
    let target = state.themes.find((t) => t.id === command.theme);
    requireThat(target, "invalid", 400);
    target.title = uniqueThemeTitle(state, command.title, String(command.theme));
  },
};

/** Dissolves a theme; its notes become individual topics again. */
export const ungroup: CommandHandler = {
  facilitatorOnly: true,
  apply({ state, command }) {
    requireThat(state.stage === "group");
    requireThat(state.themes.some((t) => t.id === command.theme), "invalid", 400);
    state.themes = state.themes.filter((t) => t.id !== command.theme);
  },
};
