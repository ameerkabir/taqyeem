import { on } from "remix/component";
import { numberLocaleFor } from "../../../../i18n/locales.ts";
import { formatDate } from "../../../../i18n/format-date.ts";
import type { Closure } from "../../../../models/guided/session.ts";
import { actionFilters } from "../../client/action-filter.ts";
import { CommandForm } from "../command-form.tsx";
import { reviewStepField } from "./shared.tsx";
import type { WorkspaceView } from "./types.ts";

/** Version and close date, with print and copy-summary tools. */
function recordHeading(v: WorkspaceView) {
  let { state, t } = v;
  return (
    <header class="meeting-record-heading">
      <div>
        <h3>{t("guided.history")}</h3>
        {state.closure && (
          <p class="record-date">
            {t("history.version", { version: state.closureVersion ?? 1 })} ·{" "}
            {t("guided.closedAt", {
              date: formatDate(numberLocaleFor(v.locale), state.closure.at, "long-time"),
            })}
          </p>
        )}
      </div>
      {state.closure && (
        <div class="control-row record-tools">
          <button class="js-only" type="button" mix={on("click", () => window.print())}>
            {t("guided.print")}
          </button>
          <button
            class="js-only"
            type="button"
            mix={on("click", () => v.copy(v.summaryText()))}
          >
            {t("guided.copySummary")}
          </button>
        </div>
      )}
    </header>
  );
}

/** What the closed meeting decided, topic by topic, and the actions it recorded. */
function closedRecord(v: WorkspaceView, closure: Closure) {
  let { t } = v;
  return (
    <>
      <p class="record-overview">
        {t("summary.overview", {
          topics: closure.topics.length,
          decisions: Object.keys(closure.decisions).length,
          actions: closure.proposals.filter((p) => p.disposition === "agreed").length,
        })}
      </p>
      <div class="summary-topics">
        {closure.topics.map((topic) => (
          <article key={topic.id} class="topic-card">
            <header class="summary-topic-heading">
              <h4 dir="auto">{topic.title}</h4>
              <span class="summary-topic-outcome">
                {t(
                  `guided.${closure.outcomes[topic.id] ?? "unaddressed"}` as "guided.unaddressed",
                )}
              </span>
            </header>
            <p dir="auto" class="summary-decision">
              {closure.decisions[topic.id] ?? t("guided.noDecision")}
            </p>
            {v.evidence(topic)}
          </article>
        ))}
      </div>
      {closure.proposals.length > 0 && (
        <details class="summary-agreement">
          <summary>{t("summary.recordedActions")}</summary>
          {closure.proposals.some((p) => p.disposition === "suggested") && (
            <p class="record-unresolved">{t("guided.unresolved")}</p>
          )}
          <div class="action-grid historical-actions">
            {closure.proposals.map((p) => v.actionCard(p, true))}
          </div>
        </details>
      )}
    </>
  );
}

/** Facilitator-only: resume Discuss; the closed version stays as it is. */
function reopenMeeting(v: WorkspaceView) {
  let { state, t } = v;
  if (!v.canManage || state.stage !== "summary" || !state.closure) {
    return null;
  }
  let version = state.closureVersion ?? 1;
  return (
    <section class="reopen-meeting">
      <div>
        <h3>{t("history.reopen")}</h3>
        <p>{t("history.reopenHint", { version })}</p>
      </div>
      <CommandForm data={v.data} kind="reopen" fields={{ version }}>
        <button disabled={v.pending}>{t("history.reopen")}</button>
      </CommandForm>
    </section>
  );
}

/** Summary's dated meeting record (or the legacy note list). */
function meetingRecord(v: WorkspaceView) {
  let { state, t } = v;
  return (
    <section class="meeting-record">
      {recordHeading(v)}
      {state.closure ? (
        closedRecord(v, state.closure)
      ) : (
        <>
          <p>{t("guided.legacyHistory")}</p>
          <div class="note-grid">{v.data.cards.map((c) => v.note(c))}</div>
        </>
      )}
      {reopenMeeting(v)}
    </section>
  );
}

function filterForm(v: WorkspaceView) {
  let { t, state } = v;
  return (
    <form method="get" data-view-form>
      {reviewStepField(v)}
      <label>
        {t("guided.filter")}
        <select name="filter" data-view="filter">
          {actionFilters.map((value) => (
            <option key={value} value={value} selected={value === v.filter}>
              {t(`guided.${value}`)} (
              {v.formatNumber(state.proposals.filter((p) => v.matches(p, value)).length)})
            </option>
          ))}
        </select>
      </label>
      <button>{t("guided.refresh")}</button>
    </form>
  );
}

function actionsToolbar(v: WorkspaceView) {
  let { state, t, rootId, active } = v;
  if (!v.canFilter && state.stage !== "actions") {
    return null;
  }
  return (
    <div class="actions-toolbar">
      {v.canFilter && filterForm(v)}
      {state.stage === "actions" && !v.readOnly && (
        <a
          class="primary"
          href={`?capture=${active?.id ?? ""}#${rootId}-capture`}
          mix={on("click", (event) => {
            event.preventDefault();
            v.capture(undefined, active);
          })}
        >
          {t(v.facilitator ? "guided.addAction" : "guided.suggestAction")}
        </a>
      )}
    </div>
  );
}

function noActionsMessage(v: WorkspaceView) {
  let { state, t } = v;
  return (
    <div class="empty-state">
      <p>{t(state.proposals.length ? "guided.noMatch" : "guided.noActions")}</p>
      {v.filter !== "all" && (
        <a
          href={v.viewHref()}
          mix={on("click", (event) => {
            event.preventDefault();
            v.showAllActions();
          })}
        >
          {t("guided.showAllActions")}
        </a>
      )}
    </div>
  );
}

/** The live action list with counts and (for four or more) filters. */
function currentActions(v: WorkspaceView) {
  let { state, t } = v;
  return (
    <>
      {state.stage === "summary" && (
        <div class="current-progress-heading">
          <h3>{t("guided.currentProgress")}</h3>
          <p>{t("summary.progressHint")}</p>
        </div>
      )}
      {state.proposals.length > 0 && (
        <p class="action-counts">
          {t("guided.actionCounts", {
            agreed: state.proposals.filter((p) => p.disposition === "agreed").length,
            pending: state.proposals.filter((p) => p.disposition === "suggested").length,
          })}
        </p>
      )}
      {actionsToolbar(v)}
      {v.canFilter && (
        <p class="actions-shown">
          {t("guided.shown", { shown: v.filtered.length, total: state.proposals.length })}
        </p>
      )}
      <div class="action-grid current-action-list">
        {v.filtered.map((p) => v.actionCard(p))}
      </div>
      {!v.filtered.length && noActionsMessage(v)}
    </>
  );
}

/**
 * Actions and Summary. Summary leads with the immutable meeting record; both
 * show current progress, except when viewing an archived record.
 */
export function actionsStage(v: WorkspaceView) {
  return (
    <section class="actions-workspace">
      {v.state.stage === "summary" && meetingRecord(v)}
      {!v.record && currentActions(v)}
    </section>
  );
}
