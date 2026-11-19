import type { SessionStore } from "../../../ui/session-store.ts";
import { readFieldValues, writeFieldValues } from "../../../ui/form-fields.ts";
import { isDraftField } from "../draft-fields.ts";

/** What a workspace editor keeps in sessionStorage between reloads. */
export interface SavedDraft {
  fields: Record<string, string | boolean>;
  /** Notes ticked for grouping; their checkboxes sit outside the form (`form=`). */
  notes: string[];
  /** Name of the field that had focus, restored with its text selection. */
  focus: string;
  start: number | null;
  end: number | null;
}

/**
 * Saves and restores the workspace's editor forms (`form[data-draft]`) so typing
 * survives reloads, language/theme changes and polling. Per-attempt fields such
 * as the command id are never stored (see isDraftField).
 */
export function createDraftStore(store: SessionStore) {
  return {
    load: (key: string) => store.getJson<SavedDraft>(key),
    remove: (key: string) => store.remove(key),

    /** Stores the form's values under `key`, keeping the last focus if none is active. */
    save(form: HTMLFormElement, key: string): void {
      let active = document.activeElement;
      let text = form.querySelector("textarea");
      let focus = form.contains(active) ? (active as HTMLInputElement).name : "";
      let draft: SavedDraft = {
        fields: readFieldValues(form, isDraftField),
        notes: new FormData(form).getAll("notes").map(String),
        focus: focus || store.getJson<SavedDraft>(key)?.focus || "",
        start: text?.selectionStart ?? null,
        end: text?.selectionEnd ?? null,
      };
      store.set(key, JSON.stringify(draft));
    },

    /**
     * Puts a saved draft back into `form`. Focus is restored only when the editor
     * is visible (inside an open dialog or details). Returns the draft, or null.
     */
    restore(form: HTMLFormElement, key: string, root: HTMLElement): SavedDraft | null {
      let saved = store.getJson<SavedDraft>(key);
      if (!saved || typeof saved.fields !== "object" || saved.fields === null) {
        return null;
      }
      writeFieldValues(form, saved.fields, isDraftField);
      if (Array.isArray(saved.notes)) {
        for (let box of root.querySelectorAll<HTMLInputElement>("input[form][name=notes]")) {
          if (box.form === form) {
            box.checked = saved.notes.includes(box.value);
          }
        }
      }
      let field = saved.focus ? form.elements.namedItem(saved.focus) : null;
      if (field instanceof HTMLElement && form.closest("dialog[open],details[open]")) {
        field.focus();
        if (field instanceof HTMLTextAreaElement && saved.start !== null) {
          field.setSelectionRange(saved.start, saved.end);
        }
      }
      return saved;
    },
  };
}
