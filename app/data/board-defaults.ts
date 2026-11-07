import type { Translator } from "../i18n/translator.ts";

// Templates, not stored text: each new board stores the labels in its creator's language.
const DEFAULT_CATEGORY_KEYS = [
  "board.defaultCategory.good",
  "board.defaultCategory.bad",
  "board.defaultCategory.ideas",
] as const;

export function defaultCategoryLabels(t: Translator["t"]): string[] {
  return DEFAULT_CATEGORY_KEYS.map((key) => t(key));
}
