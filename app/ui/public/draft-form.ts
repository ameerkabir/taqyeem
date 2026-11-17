import { createMixin } from "remix/component";
import { namedControls } from "../form-fields.ts";
import { createSessionStore } from "../session-store.ts";

const store = createSessionStore("taqyeem-form:");

/** One saved control; an array keeps checkbox and radio groups that share a name. */
interface SavedField {
  name: string;
  value: string;
  checked?: boolean;
}

// Drafts are viewer-local, keyed by membership and the original server value/version.
// They are never a transport for identity, board state, or committed contributions.
export const draftForm = createMixin<HTMLFormElement, [string]>(
  (handle) => {
    let key = "";
    handle.addEventListener("insert", ({ node: form }) => {
      const storageKey = () => `taqyeem-form:${key}`;
      function save() {
        if (!key || form.dataset.draftSaved) {
          return;
        }
        try {
          let fields: SavedField[] = namedControls(form).map((node) => ({
            name: node.name,
            value: node.value,
            checked: node instanceof HTMLInputElement ? node.checked : undefined,
          }));
          let active = document.activeElement,
            focus = form.contains(active)
              ? (active as HTMLInputElement).name
              : "";
          store.set(
            key,
            JSON.stringify({
              fields,
              focus,
              start:
                active instanceof HTMLTextAreaElement
                  ? active.selectionStart
                  : null,
              end:
                active instanceof HTMLTextAreaElement
                  ? active.selectionEnd
                  : null,
            }),
          );
        } catch {
          /* Storage can be unavailable; keep the mounted native fields. */
        }
      }
      form.dataset.persistentDraft = storageKey();
      try {
        let saved = key
          ? store.getJson<{ fields: SavedField[]; focus: string; start: number | null; end: number | null }>(key)
          : null;
        if (saved && key) {
          for (let field of saved.fields)
            for (let node of namedControls(form)) {
              if (
                node.name !== field.name ||
                ["revision", "id"].includes(node.name)
              )
                continue;
              if (
                node instanceof HTMLInputElement &&
                (node.type === "checkbox" || node.type === "radio")
              ) {
                if (node.value === field.value) node.checked = !!field.checked;
              } else node.value = field.value;
            }
          handle.queueTask(() => {
            let field = form.elements.namedItem(saved.focus);
            if (field instanceof HTMLElement) {
              field.focus();
              if (field instanceof HTMLTextAreaElement && saved.start !== null)
                field.setSelectionRange(saved.start, saved.end);
            }
            let text = form.querySelector("textarea");
            text?.dispatchEvent(new Event("input", { bubbles: true }));
          });
        }
      } catch {}
      form.addEventListener("input", save, { signal: handle.signal });
      form.addEventListener("change", save, { signal: handle.signal });
      document.addEventListener("submit", save, {
        capture: true,
        signal: handle.signal,
      });
      document.addEventListener(
        "click",
        (event) => {
          if (event.target instanceof Element && event.target.closest("a"))
            save();
        },
        { capture: true, signal: handle.signal },
      );
      window.addEventListener("beforeunload", save, { signal: handle.signal });
    });
    return (draftKey) => {
      key = draftKey;
    };
  },
  { ssr: false },
);
export function clearPersistentDraft(form: HTMLFormElement) {
  form.dataset.draftSaved = "true";
  if (form.dataset.persistentDraft) {
    createSessionStore("").remove(form.dataset.persistentDraft);
  }
}
