import type { Topic } from "../../../../models/guided/session.ts";
import { CommandForm } from "../command-form.tsx";
import { readyToggle } from "./collect-stage.tsx";
import type { WorkspaceView } from "./types.ts";

/** A single note keeps its category's colour; themes are neutral. */
function topicTone(v: WorkspaceView, topic: Topic) {
  if (v.state.themes.some((theme) => theme.id === topic.id)) {
    return undefined;
  }
  let categoryId = v.data.cards.find((c) => c.id === topic.notes[0])?.categoryId;
  return v.data.categories.find((cat) => cat.id === categoryId)?.tone;
}

function voteToolbar(v: WorkspaceView) {
  let { state, t } = v;
  return (
    <div class="vote-toolbar">
      <strong>
        {t("guided.allowance", { used: v.mine.length, max: state.budget })}
      </strong>
      <span>{state.ballotOpen ? t("guided.hidden") : t("guided.ballotClosed")}</span>
      {state.ballotOpen && !v.readOnly && readyToggle(v, t("guided.ready"))}
      {!v.readOnly && (
        <span>{t("guided.readyCount", { count: v.data.doneCount })}</span>
      )}
      {v.canManage &&
        v.command(
          "ballot",
          { ballot: state.ballot, value: !state.ballotOpen },
          t(state.ballotOpen ? "guided.closeBallot" : "guided.reopen"),
        )}
    </div>
  );
}

/** Vote / remove-vote while the ballot is open; totals once it closes. */
function ballotControl(v: WorkspaceView, topic: Topic) {
  let { state, t } = v;
  let chosen = v.mine.includes(topic.id);
  if (!state.ballotOpen || v.readOnly) {
    return (
      <p>
        {state.ballot > 0
          ? t("guided.votes", { count: v.data.counts[topic.id] ?? 0 })
          : t("review.noBallot")}
      </p>
    );
  }
  return (
    <CommandForm
      data={v.data}
      kind="vote"
      fields={{ topic: topic.id, ballot: state.ballot, value: !chosen }}
    >
      <button
        aria-pressed={chosen}
        disabled={v.pending || (!chosen && v.mine.length >= state.budget)}
      >
        {chosen ? `✓ ${t("guided.remove")}` : t("guided.select")}
      </button>
    </CommandForm>
  );
}

/** Vote: every topic with its evidence and this viewer's private ballot. */
export function voteStage(v: WorkspaceView) {
  return (
    <section>
      {voteToolbar(v)}
      {v.mine.length >= v.state.budget && <p>{v.t("guided.allUsed")}</p>}
      <div class="topic-grid">
        {v.topics.map((topic) => (
          <article
            key={topic.id}
            class="topic-card"
            data-tone={topicTone(v, topic)}
            data-selected={v.mine.includes(topic.id) ? "true" : "false"}
          >
            <h3 dir="auto">{topic.title}</h3>
            {v.evidence(topic)}
            {ballotControl(v, topic)}
          </article>
        ))}
      </div>
      {!v.topics.length && <p>{v.t("guided.noTopics")}</p>}
    </section>
  );
}
