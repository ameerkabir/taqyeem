import { on } from "remix/component";
import { routes } from "../../../../routes.ts";
import { errorAlert } from "./shared.tsx";
import type { WorkspaceView } from "./types.ts";

export const maxNoteLength = 500;

/** Updates the visible "n / 500" counter for the note being written. */
export function updateNoteCounter(v: Pick<WorkspaceView, "t">, root: HTMLElement, length: number) {
  let count = root.querySelector("[data-note-count]");
  if (count) {
    count.textContent = v.t("form.counter", { count: length, max: maxNoteLength });
  }
}

/**
 * The Add note dialog. It is a native form posting to the new-card route, so
 * it works without JavaScript; `submissionId` makes a retried post idempotent.
 */
export function noteDialog(v: WorkspaceView, root: () => HTMLElement) {
  let { data, state, t, rootId } = v;
  return (
    <dialog
      aria-labelledby={`${rootId}-note-title`}
      mix={on("cancel", (e) => {
        e.preventDefault();
        v.closeNote();
      })}
    >
      <h2 id={`${rootId}-note-title`}>{t("guided.add")}</h2>
      <form
        data-draft="note"
        method="post"
        action={routes.newCard.action.href({ boardId: data.board.id })}
      >
        <input type="hidden" name="submissionId" defaultValue={v.submission} />
        {data.state.stage === "discuss" && v.active && (
          <input type="hidden" name="attachTopic" value={v.active.id} />
        )}
        <label>
          {t("form.category")}
          <select name="categoryId" defaultValue={v.category}>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("form.note")}
          <textarea
            name="text"
            dir="auto"
            rows={7}
            maxLength={maxNoteLength}
            required
            aria-describedby={`${rootId}-count`}
            mix={on("input", (e) =>
              updateNoteCounter(v, root(), e.currentTarget.value.length),
            )}
          />
        </label>
        <p id={`${rootId}-count`} data-note-count>
          {t("form.counter", { count: 0, max: maxNoteLength })}
        </p>
        <label class="checkbox">
          <input type="checkbox" name="isAnonymous" value="true" />
          {t("form.anonymous")}
        </label>
        <p>{t("guided.privacy")}</p>
        {state.categorySetup?.confirmed === false && <p>{t("setup.required")}</p>}
        {!v.notesAllowed && state.categorySetup?.confirmed !== false && (
          <p>{t("guided.collectOnly")}</p>
        )}
        {errorAlert(v)}
        <button
          class="primary"
          disabled={
            v.pending ||
            !v.notesAllowed
          }
        >
          {v.pending ? t("guided.saving") : t("guided.post")}
        </button>
      </form>
      <div class="control-row">
        <button type="button" mix={on("click", () => v.closeNote())}>
          {t("guided.close")}
        </button>
        <button
          type="button"
          disabled={v.pending}
          mix={on("click", () => {
            if (confirm(t("guided.discardConfirm"))) {
              v.discardNote();
            }
          })}
        >
          {t("guided.discard")}
        </button>
      </div>
    </dialog>
  );
}
