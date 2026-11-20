import { on } from "remix/component";
import { routes } from "../../../../routes.ts";
import type { Category } from "../../../../data/board.ts";
import { CommandForm } from "../command-form.tsx";
import { reviewStepField } from "./shared.tsx";
import type { WorkspaceView } from "./types.ts";

const notesIn = (v: WorkspaceView, categoryId: string) =>
  v.data.cards.filter((c) => c.categoryId === categoryId);

/** The "done" toggle shared by Collect and Vote. */
export function readyToggle(v: WorkspaceView, label: string) {
  let mineReady = v.state.ready[v.data.memberId];
  return v.command(
    "ready",
    { value: !mineReady },
    mineReady ? `✓ ${v.t("guided.notReady")}` : label,
  );
}

/** Category picker (works without JavaScript), readiness and totals. */
function collectToolbar(v: WorkspaceView) {
  let { data, t, formatNumber } = v;
  return (
    <div class="collect-toolbar">
      <form method="get" data-view-form>
        {reviewStepField(v)}
        <label>
          {t("guided.category")}
          <select name="category" data-view="category">
            {data.categories.map((c) => (
              <option key={c.id} value={c.id} selected={c.id === v.category}>
                {c.label} ({formatNumber(notesIn(v, c.id).length)})
              </option>
            ))}
          </select>
        </label>
        <button>{t("guided.refresh")}</button>
      </form>
      {!v.readOnly && readyToggle(v, t("guided.done"))}
      {!v.readOnly && (
        <span class="readiness-count">
          {t("guided.doneCount", { count: data.doneCount })}
        </span>
      )}
      <span class="note-total">
        {t("collect.total", { count: data.cards.length })}
      </span>
    </div>
  );
}

/**
 * One category lane with its own Add note control. The whole lane, stretched to
 * the height of its row, is the drop target when moving notes.
 */
function lane(v: WorkspaceView, category: Category) {
  let notes = notesIn(v, category.id);
  return (
    <section
      key={category.id}
      class="lane"
      data-category-id={category.id}
      data-drop-target={
        v.canMoveNotes && v.dropCategory === category.id ? "true" : undefined
      }
      data-tone={category.tone ?? 0}
      data-active={category.id === v.currentCategory?.id ? "true" : "false"}
    >
      <h3 dir="auto">
        {category.label}{" "}
        <span class="count">{v.formatNumber(notes.length)}</span>
      </h3>
      {!v.readOnly && (
        <a
          class="add-note"
          href={`${routes.newCard.index.href({ boardId: v.data.board.id })}?category=${category.id}`}
          mix={on("click", (e) => {
            e.preventDefault();
            v.openNote(category.id);
          })}
        >
          {v.t("guided.add")}
        </a>
      )}
      <div class="note-stack">
        {notes.map((c) => v.note(c))}
      </div>
    </section>
  );
}

/** Collect: a lane per category, up to four per row; phones show one at a time. */
export function collectStage(v: WorkspaceView) {
  return (
    <section>
      {collectToolbar(v)}
      {v.canMoveNotes && v.data.cards.length > 0 && (
        <p class="note-move-hint">{v.t("collect.moveHint")}</p>
      )}
      <div class="lanes" data-columns={v.laneColumns}>
        {v.lanes.map((category) => lane(v, category))}
      </div>
    </section>
  );
}

/** The facilitator's vote budget, adjustable until voting starts. */
export function budgetSettings(v: WorkspaceView) {
  let { state, t } = v;
  if (!(state.stage === "collect" || state.stage === "group") || !v.canManage) {
    return null;
  }
  return (
    <details class="settings">
      <summary>
        {t("collect.settings")} · {t("guided.budget")}:{" "}
        {v.formatNumber(state.budget)}
      </summary>
      <CommandForm data={v.data} kind="budget">
        <label>
          {t("guided.budget")}
          <input
            type="number"
            name="value"
            min={1}
            max={20}
            defaultValue={state.budget}
            required
          />
        </label>
        <button disabled={v.pending}>{t("guided.setBudget")}</button>
      </CommandForm>
    </details>
  );
}
