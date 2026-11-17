import { CommandError } from "./errors.ts";
import type { SharedSession } from "./types.ts";

/**
 * Throws `CommandError(code, status)` unless `ok` is truthy. The default is a
 * 409 `locked`: the command is valid but not allowed in the current stage.
 */
export function requireThat(
  ok: unknown,
  code: CommandError["code"] = "locked",
  status = 409,
): asserts ok {
  if (!ok) throw new CommandError(code, status);
}

/** A trimmed, non-empty string of at most `max` characters. */
export function text(value: unknown, max = 500): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new CommandError("invalid", 400);
  return value.trim();
}

const controlCharacters = /[\u0000-\u001f\u007f]/;
const ignorable = /\p{Default_Ignorable_Code_Point}/gu;

/**
 * The comparison key for names people type (themes, categories): NFKC, without
 * invisible characters, single-spaced and lower-case. Two names with the same
 * key read as the same name.
 */
export function nameKey(name: string): string {
  return name
    .normalize("NFKC")
    .replace(ignorable, "")
    .trim()
    .replace(/\s+/gu, " ")
    .toLowerCase();
}

/** A theme title that no other theme on the board already uses. */
export function uniqueThemeTitle(
  state: SharedSession,
  value: unknown,
  exceptId?: string,
): string {
  const title = text(value, 160),
    key = nameKey(title);
  requireThat(key.length > 0 && !controlCharacters.test(title), "invalid", 400);
  requireThat(
    !state.themes.some(
      (theme) => theme.id !== exceptId && nameKey(theme.title) === key,
    ),
    "duplicateTheme",
    400,
  );
  return title;
}

/** 1–8 visible, distinct category names of up to 120 characters, trimmed. */
export function validateCategoryLabels(labels: unknown): string[] {
  requireThat(
    Array.isArray(labels) && labels.length >= 1 && labels.length <= 8,
    "invalid",
    400,
  );
  const clean = labels.map((label) => text(label, 120));
  requireThat(
    clean.every(
      (label) =>
        !controlCharacters.test(label) &&
        label.replace(ignorable, "").trim().length > 0,
    ),
    "invalid",
    400,
  );
  requireThat(new Set(clean.map(nameKey)).size === clean.length, "invalid", 400);
  return clean;
}

/** A real calendar day written `YYYY-MM-DD` (so 2026-02-30 is rejected). */
export function isCalendarDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
