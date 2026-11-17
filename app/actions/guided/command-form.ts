import { CommandError, type Command } from "../../models/guided/session.ts";

/** Fields copied onto the command as plain strings when present. */
const scalarFields = [
  "choice",
  "card",
  "fromCategory",
  "categoryId",
  "topic",
  "theme",
  "title",
  "text",
  "owner",
  "due",
  "proposal",
] as const;

/** Fields a well-formed command sends at most once. */
const singleFields = [
  "id",
  "revision",
  "kind",
  ...scalarFields,
  "ownerSearch",
  "labels",
  "ballot",
  "version",
  "value",
] as const;

/**
 * Builds a Command from a native or enhanced command form. It never throws, so a
 * failed command can still be re-rendered with what was sent; call
 * {@link checkCommandForm} to reject malformed submissions.
 *
 * - `labels` is one category per line; blank lines are dropped.
 * - `notes` may repeat (grouping several notes).
 * - `value` becomes a boolean for "true"/"false", a number for `budget`.
 */
export function readCommandForm(form: FormData): Command {
  let command: Command = {
    id: String(form.get("id") ?? ""),
    revision: Number(form.get("revision")),
    kind: String(form.get("kind") ?? ""),
  };
  for (let key of scalarFields) {
    if (form.has(key)) {
      command[key] = form.get(key);
    }
  }
  if (form.has("labels")) {
    command.labels = String(form.get("labels"))
      .split(/\r?\n/)
      .map((label) => label.trim())
      .filter(Boolean);
  }
  if (form.has("notes")) {
    command.notes = form.getAll("notes");
  }
  if (form.has("ballot")) {
    command.ballot = Number(form.get("ballot"));
  }
  if (form.has("version")) {
    command.version = Number(form.get("version"));
  }
  if (form.has("value")) {
    command.value = readValue(form.get("value"), command.kind);
  }
  return command;
}

function readValue(value: FormDataEntryValue | null, kind: string) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return kind === "budget" ? Number(value) : value;
}

/**
 * Rejects a command form that repeats a single-value field or lacks a whole-number
 * revision. Converting a legacy board sends neither, so it is exempt.
 * @throws {CommandError} `invalid` (400)
 */
export function checkCommandForm(form: FormData, kind: string): void {
  if (kind === "convert") {
    return;
  }
  for (let key of singleFields) {
    if (form.getAll(key).length > 1) {
      throw new CommandError("invalid", 400);
    }
  }
  if (!/^\d+$/.test(String(form.get("revision") ?? ""))) {
    throw new CommandError("invalid", 400);
  }
}
