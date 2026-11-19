import { on, type RemixNode } from "remix/component";
import type { Topic } from "../../../../models/guided/session.ts";
import { reviewStepField, topicCards } from "./shared.tsx";
import { lateNotes } from "./late-notes.tsx";
import type { WorkspaceView } from "./types.ts";

/**
 * A link that reads another topic privately, with a native `?topic=` fallback.
 * `disabled` marks the ends of previous/next; `current` marks the agenda item.
 */
function topicLink(
  v: WorkspaceView,
  topic: Topic | undefined,
  children: RemixNode,
  options: { current?: boolean; disabled?: boolean } = {},
) {
  return (
    <a
      aria-current={options.current ? "true" : undefined}
      aria-disabled={
        options.disabled === undefined
          ? undefined
          : options.disabled
            ? "true"
            : "false"
      }
      href={topic ? v.viewHref({ topic: topic.id }) : undefined}
      mix={on("click", (event) => {
        event.preventDefault();
        if (topic) {
          v.viewTopic(topic.id);
        }
      })}
    >
      {children}
    </a>
  );
}

/** Names the team's topic while the viewer reads another one, with a way back. */
function discussionContext(v: WorkspaceView) {
  let { sharedTopic, privateTopic, t } = v;
  if (!privateTopic && sharedTopic) {
    return null;
  }
  return (
    <div class="discussion-context" data-private={privateTopic ? "true" : "false"}>
      <div aria-live="polite" aria-atomic="true">
        <span class="eyebrow">
          {t(
            sharedTopic
              ? v.readOnly
                ? "review.sharedTopic"
                : "discuss.teamTopic"
              : "discuss.noShared",
          )}
        </span>
        {sharedTopic && <strong dir="auto">{sharedTopic.title}</strong>}
        {privateTopic && <p>{t("discuss.privateHint")}</p>}
      </div>
      {privateTopic && sharedTopic && (
        <a
          href={v.viewHref()}
          mix={on("click", (event) => {
            event.preventDefault();
            v.viewTopic("");
          })}
        >
          {t("guided.follow")}
        </a>
      )}
    </div>
  );
}

/** Ranked topics with their outcomes; the team's topic is marked. */
function agenda(v: WorkspaceView) {
  let { ranked, active, sharedTopic, state, t, formatNumber } = v;
  return (
    <aside class="agenda discussion-agenda" aria-label={t("guided.agenda")}>
      <h3>{t("guided.agenda")}</h3>
      <form method="get" data-view-form>
        {reviewStepField(v)}
        <label>
          {t("discuss.browse")}
          <select name="topic" data-view="topic">
            {ranked.map((topic, i) => (
              <option key={topic.id} value={topic.id} selected={topic.id === active?.id}>
                {formatNumber(i + 1)}. {topic.title}
              </option>
            ))}
          </select>
        </label>
        <button>{t("discuss.browse")}</button>
      </form>
      <ol>
        {ranked.map((topic, i) => (
          <li key={topic.id} data-live={topic.id === sharedTopic?.id ? "true" : "false"}>
            {topicLink(
              v,
              topic,
              <>
                <span class="agenda-number" aria-hidden="true">
                  {formatNumber(i + 1)}
                </span>
                <span class="agenda-title">
                  <bdi>{topic.title}</bdi>
                  {topic.id === sharedTopic?.id && (
                    <span class="agenda-live">
                      {t(v.readOnly ? "review.sharedTopicShort" : "discuss.current")}
                    </span>
                  )}
                </span>
              </>,
              { current: topic.id === active?.id },
            )}
            <span class="agenda-outcome">
              {state.outcomes[topic.id]
                ? t(`guided.${state.outcomes[topic.id]}`)
                : t("discuss.noOutcome")}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function topicHeader(v: WorkspaceView, active: Topic) {
  let { ranked, privateTopic, sharedTopic, state, t, rootId } = v;
  return (
    <header class="discussion-topic-header">
      <div class="discussion-topic-label">
        <span class="discussion-mode">
          {t(
            v.readOnly
              ? "review.topic"
              : privateTopic || !sharedTopic
                ? "discuss.viewing"
                : "discuss.now",
          )}
        </span>
        <span class="discussion-position">
          {t("discuss.position", {
            current: ranked.indexOf(active) + 1,
            total: ranked.length,
          })}
        </span>
      </div>
      <h3 id={`${rootId}-discussion-title`} dir="auto" aria-live="polite" aria-atomic="true">
        {active.title}
      </h3>
      <div class="discussion-topic-meta">
        <span>{t("board.tabCount", { count: active.notes.length })}</span>
        {state.ballot > 0 && (
          <span>{t("vote.count", { count: v.data.counts[active.id] ?? 0 })}</span>
        )}
      </div>
      {(privateTopic || !sharedTopic) &&
        v.canManage &&
        active.id !== sharedTopic?.id &&
        v.command("live", { topic: active.id }, t("guided.share"))}
    </header>
  );
}

/** The topic's original notes: the first two, then the rest behind "Show all". */
function topicFeedback(v: WorkspaceView, active: Topic) {
  let { t, rootId } = v;
  return (
    <section class="discussion-feedback" aria-labelledby={`${rootId}-feedback-title`}>
      <h4 id={`${rootId}-feedback-title`}>{t("discuss.feedback")}</h4>
      <div class="note-stack">
        {topicCards(v, active.notes.slice(0, 2)).map((c) => v.note(c))}
      </div>
      {active.notes.length > 2 && (
        <details class="more-notes">
          <summary>{t("guided.showAll")}</summary>
          <div class="note-stack">
            {topicCards(v, active.notes.slice(2)).map((c) => v.note(c))}
          </div>
        </details>
      )}
      {lateNotes(v)}
    </section>
  );
}

/** Outcome and decision for the topic, with the facilitator's controls. */
function topicRecord(v: WorkspaceView, active: Topic) {
  let { state, t, rootId } = v;
  let outcome = state.outcomes[active.id];
  return (
    <section class="discussion-record" aria-label={t("discuss.outcome")}>
      <div class="discussion-outcome">
        <h4>{t("discuss.outcome")}</h4>
        <span class="discussion-outcome-label" data-outcome={outcome ?? "unaddressed"}>
          {outcome ? t(`guided.${outcome}`) : t("discuss.noOutcome")}
        </span>
        {v.canManage && (
          <div class="control-row">
            {v.command("outcome", { topic: active.id, value: "discussed" }, t("guided.markDiscussed"))}
            {v.command("outcome", { topic: active.id, value: "skipped" }, t("guided.skip"))}
          </div>
        )}
      </div>
      <div class="discussion-decision">
        <h4>{t("discuss.decision")}</h4>
        <p dir="auto">{state.decisions[active.id] ?? t("guided.noDecision")}</p>
        {v.canManage && (
          <a
            class="discussion-record-link"
            href={`?topic=${active.id}&decision=${active.id}#${rootId}-decision`}
            mix={on("click", (event) => {
              event.preventDefault();
              v.recordDecision(active);
            })}
          >
            {t("guided.recordDecision")}
          </a>
        )}
      </div>
    </section>
  );
}

/** Previous / next topic in agenda order. */
function topicNavigation(v: WorkspaceView, active: Topic) {
  let { ranked, t } = v;
  let index = ranked.indexOf(active);
  let previous = index > 0 ? ranked[index - 1] : undefined;
  let next = index < ranked.length - 1 ? ranked[index + 1] : undefined;
  return (
    <div class="topic-navigation">
      {topicLink(v, previous, t("guided.previous"), { disabled: !previous })}
      {topicLink(v, next, t("guided.nextTopic"), { disabled: !next })}
    </div>
  );
}

/** The topic being read: header, evidence, outcome, decision and navigation. */
function discussionSubject(v: WorkspaceView) {
  let { active, privateTopic, sharedTopic, rootId } = v;
  return (
    <section
      class="discussion-subject"
      aria-labelledby={`${rootId}-discussion-title`}
      data-topic={active?.id}
      data-following={!privateTopic && sharedTopic ? "true" : "false"}
    >
      {active ? (
        <>
          {topicHeader(v, active)}
          {topicFeedback(v, active)}
          {topicRecord(v, active)}
          {topicNavigation(v, active)}
        </>
      ) : (
        <div class="empty-state">
          <p>{v.t("guided.noTopics")}</p>
        </div>
      )}
    </section>
  );
}

/** Actions linked to the topic being read, plus every action for review. */
function discussionActions(v: WorkspaceView) {
  let { active, state, t, rootId } = v;
  let linked = state.proposals.filter((p) => p.topic === active?.id);
  return (
    <aside class="discussion-actions" aria-label={t("discuss.actions")}>
      <div class="discussion-actions-heading">
        <h3>{t("discuss.actions")}</h3>
        {!v.readOnly && (
          <a
            href={`?topic=${active?.id ?? ""}&capture=${active?.id ?? ""}#${rootId}-capture`}
            mix={on("click", (event) => {
              event.preventDefault();
              v.capture(undefined, active);
            })}
          >
            {t(v.facilitator ? "guided.addAction" : "guided.suggestAction")}
          </a>
        )}
      </div>
      {!linked.length && <p class="discussion-empty-actions">{t("discuss.noActions")}</p>}
      <div class="action-grid compact">{linked.map((p) => v.actionCard(p))}</div>
      {state.proposals.length > 0 && (
        <details class="review-actions">
          <summary>{t("guided.reviewActions")}</summary>
          <div class="action-grid compact">
            {state.proposals.map((p) => v.actionCard(p))}
          </div>
        </details>
      )}
    </aside>
  );
}

/** Discuss: agenda, the topic in focus, and its actions. */
export function discussStage(v: WorkspaceView) {
  return (
    <section class="discussion-workspace" aria-label={v.t("guided.discuss")}>
      {discussionContext(v)}
      <div class="discussion-layout">
        {agenda(v)}
        {discussionSubject(v)}
        {discussionActions(v)}
      </div>
    </section>
  );
}
