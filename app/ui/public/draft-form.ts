import { createMixin } from "remix/component";

// Drafts are viewer-local, keyed by membership and the original server value/version.
// They are never a transport for identity, board state, or committed contributions.
export const draftForm = createMixin<HTMLFormElement, [string]>(
  (handle) => {
    let key = "";
    handle.addEventListener("insert", ({ node: form }) => {
      const storageKey = () => `taqyeem-form:${key}`;
      function save() {
        if (!key || form.dataset.draftSaved) return;
        try {
          let fields = [
            ...form.querySelectorAll("input[name],textarea[name],select[name]"),
          ].map((element) => {
            let node = element as
              | HTMLInputElement
              | HTMLTextAreaElement
              | HTMLSelectElement;
            return {
              name: node.name,
              value: node.value,
              checked:
                node instanceof HTMLInputElement ? node.checked : undefined,
            };
          });
          let active = document.activeElement,
            focus = form.contains(active)
              ? (active as HTMLInputElement).name
              : "";
          sessionStorage.setItem(
            storageKey(),
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
        let saved = JSON.parse(sessionStorage.getItem(storageKey()) ?? "null");
        if (saved && key) {
          for (let field of saved.fields)
            for (let element of form.querySelectorAll("[name]")) {
              let node = element as
                | HTMLInputElement
                | HTMLTextAreaElement
                | HTMLSelectElement;
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
  try {
    if (form.dataset.persistentDraft)
      sessionStorage.removeItem(form.dataset.persistentDraft);
  } catch {}
}
