import { CommandForm } from "../command-form.tsx";
import { errorAlert } from "./shared.tsx";
import type { WorkspaceView } from "./types.ts";

function topicOptions(v: WorkspaceView, selected: string | undefined) {
  return v.topics.map((topic) => (
    <option key={topic.id} value={topic.id} selected={topic.id === selected}>
      {topic.title}
    </option>
  ));
}

/** Propose (or, for the facilitator, add) an action with topic, owner and due date. */
function actionEditor(v: WorkspaceView) {
  let { data, t, rootId, initialView } = v;
  let label = t(v.facilitator ? "guided.addAction" : "guided.suggestAction");
  return (
    <details
      data-editor="action"
      open={
        !!initialView?.capture &&
        v.topics.some((topic) => topic.id === initialView?.capture)
      }
    >
      <summary>{label}</summary>
      <CommandForm data={data} kind="propose" draft="action">
        <label>
          {t("guided.actionText")}
          <textarea
            id={`${rootId}-capture`}
            defaultValue={
              data.cards.find((card) => card.id === initialView?.captureNote)?.body ?? ""
            }
            name="text"
            rows={4}
            maxLength={500}
            required
            dir="auto"
          />
        </label>
        <label>
          {t("guided.agenda")}
          <select name="topic">
            <option value="" selected={!v.initialCaptureTopic}>
              {t("guided.unassigned")}
            </option>
            {topicOptions(v, v.initialCaptureTopic)}
          </select>
        </label>
        <label>
          {t("guided.owner")}
          <input name="ownerSearch" list={`${rootId}-members`} autoComplete="off" />
          <datalist id={`${rootId}-members`}>
            {data.members.map((m) => (
              <option key={m.id} value={m.displayName} />
            ))}
          </datalist>
        </label>
        <label>
          {t("guided.due")}
          <input name="due" type="date" />
        </label>
        {errorAlert(v)}
        <button
          class="primary"
          disabled={
            v.pending || v.readOnly || !["discuss", "actions"].includes(data.state.stage)
          }
        >
          {label}
        </button>
      </CommandForm>
    </details>
  );
}

/** Facilitator records the decision for a topic during Discuss. */
function decisionEditor(v: WorkspaceView) {
  let { data, t, rootId, initialView } = v;
  return (
    <details
      data-editor="decision"
      open={
        v.canManage &&
        v.state.stage === "discuss" &&
        v.topics.some((topic) => topic.id === initialView?.decision)
      }
    >
      <summary>{t("guided.recordDecision")}</summary>
      <CommandForm data={data} kind="decision" draft="decision">
        <label>
          {t("guided.agenda")}
          <select name="topic" required>
            {topicOptions(v, v.initialDecisionTopic)}
          </select>
        </label>
        <label>
          {t("guided.decision")}
          <textarea
            id={`${rootId}-decision`}
            name="text"
            rows={4}
            maxLength={2000}
            required
            dir="auto"
          />
        </label>
        {errorAlert(v)}
        <button
          class="primary"
          disabled={
            v.pending || v.readOnly || !v.facilitator || data.state.stage !== "discuss"
          }
        >
          {t("guided.recordDecision")}
        </button>
      </CommandForm>
    </details>
  );
}

/**
 * The action and decision editors. They stay mounted in every stage so drafts
 * and focus survive stage changes, polling and private browsing.
 */
export function captureEditors(v: WorkspaceView) {
  return (
    <section id={`${v.rootId}-capture-wrapper`} class="capture-editors">
      {actionEditor(v)}
      {decisionEditor(v)}
    </section>
  );
}
