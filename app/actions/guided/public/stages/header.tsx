import { on } from "remix/component";
import { routes } from "../../../../routes.ts";
import { numberLocaleFor } from "../../../../i18n/locales.ts";
import { formatDate } from "../../../../i18n/format-date.ts";
import { stages } from "../../../../models/guided/stages.ts";
import type { WorkspaceView } from "./types.ts";

/** Board title, role, member count and the invitation link. */
export function boardHeading(v: WorkspaceView) {
  let { data, t } = v;
  return (
    <header class="board-heading">
      <div>
        <h1 dir="auto">{data.board.title}</h1>
        <p>
          {v.facilitator ? t("guided.facilitator") : t("guided.participant")} ·{" "}
          {t("guided.joined", { count: data.members.length })}
        </p>
      </div>
      <details class="invitation">
        <summary>{t("guided.invite")}</summary>
        <label>
          {t("guided.invite")}
          <input readOnly value={v.inviteUrl} />
        </label>
        <button
          class="js-only"
          type="button"
          mix={on("click", () => v.copy(v.inviteUrl))}
        >
          {t("guided.copy")}
        </button>
        <p>{t("guided.identityNotice")}</p>
      </details>
    </header>
  );
}

/** A picker for earlier closed versions of this meeting. */
export function historyTools(v: WorkspaceView) {
  let { data, t } = v;
  return (
    <div class="history-tools">
      {!!data.history?.length && (
        <form
          method="get"
          action={routes.board.href({ boardId: data.board.id })}
          class="history-navigation"
          mix={on("submit", () => v.persist())}
        >
          <label>
            {t("history.saved")}
            <select name="record" required data-record-picker>
              <option value="" disabled selected={!v.record}>
                {t("history.choose")}
              </option>
              {data.history.map((record) => (
                <option
                  key={record.version}
                  value={String(record.version)}
                  selected={record.version === v.record?.version}
                >
                  {t("history.version", { version: record.version })} ·{" "}
                  {formatDate(
                    numberLocaleFor(v.locale),
                    record.closedAt,
                    "medium-time",
                  )}
                </option>
              ))}
            </select>
          </label>
          <button>{t("history.view")}</button>
        </form>
      )}
    </div>
  );
}

/** Converted boards keep their original card votes visible as evidence. */
export function legacyEvidence(v: WorkspaceView) {
  let { data, t } = v;
  if (!v.state.legacy) {
    return null;
  }
  return (
    <details class="legacy-evidence">
      <summary>{t("guided.legacy")}</summary>
      <p>{t("guided.legacyVotesHint")}</p>
      <ul>
        {data.cards.map((card) => (
          <li key={card.id}>
            <bdi>{card.body}</bdi> ·{" "}
            {t("guided.votes", { count: data.legacyCardVotes[card.id] ?? 0 })}
          </li>
        ))}
      </ul>
    </details>
  );
}

type StepState = "completed" | "current" | "upcoming";
const stepState = (index: number, current: number): StepState =>
  index < current ? "completed" : index === current ? "current" : "upcoming";

/**
 * The six-stage stepper. Completed stages link to a private read-only review;
 * the team's stage links back to the live board; later stages are disabled.
 */
export function stageRail(v: WorkspaceView) {
  let { data, t, formatNumber } = v;
  let current = stages.indexOf(data.state.stage);
  return (
    <ol class="stage-rail" tabIndex={0} aria-label={t("guided.stages")}>
      {stages.map((stage, i) => (
        <li
          key={stage}
          aria-current={stage === data.state.stage ? "step" : undefined}
          data-viewed={stage === v.state.stage ? "true" : "false"}
          data-state={stepState(i, current)}
        >
          {i <= current ? (
            <a
              href={
                stage === data.state.stage
                  ? routes.board.href({ boardId: data.board.id })
                  : `?step=${stage}`
              }
              mix={on("click", () => v.persist())}
            >
              {formatNumber(i + 1)} {t(`guided.${stage}`)}
            </a>
          ) : (
            <span aria-disabled="true">
              {formatNumber(i + 1)} {t(`guided.${stage}`)}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Says what is being reviewed, where the team actually is, and links back. */
export function reviewBanner(v: WorkspaceView) {
  let { data, t } = v;
  if (!v.readOnly) {
    return null;
  }
  return (
    <div class="review-banner" role="status">
      <div>
        <strong>
          {v.record
            ? t("history.recordTitle", { version: v.record.version })
            : t("review.title", { stage: t(`guided.${v.state.stage}`) })}
        </strong>
        <p>
          {t("review.teamStage", { stage: t(`guided.${data.state.stage}`) })}{" "}
          {t("review.readOnly")}
        </p>
      </div>
      <a
        href={routes.board.href({ boardId: data.board.id })}
        mix={on("click", () => v.persist())}
      >
        {t("review.back")}
      </a>
    </div>
  );
}

/** Live status and the last command error, with a way to load the latest state. */
export function sessionStatus(v: WorkspaceView) {
  let { t } = v;
  return (
    <>
      <div class="session-status" role="status" aria-live="polite">
        {v.status}
      </div>
      {v.error && (
        <p role="alert" class="error">
          {v.error}{" "}
          <button type="button" mix={on("click", () => v.refresh(true))}>
            {t("guided.reviewLatest")}
          </button>
        </p>
      )}
    </>
  );
}

/** The stage title, its intro, and the facilitator's button to move on. */
export function stageHeading(v: WorkspaceView) {
  let { state, t } = v;
  let next = stages[stages.indexOf(state.stage) + 1];
  return (
    <div class="stage-heading">
      <div>
        <h2>{t(`guided.${state.stage}`)}</h2>
        {state.stage === "collect" && !v.readOnly && (
          <p class="stage-description">{t("collect.intro")}</p>
        )}
      </div>
      {v.canManage &&
        state.stage !== "summary" &&
        v.command(
          "advance",
          {},
          state.stage === "actions"
            ? t("guided.closeMeeting")
            : t("guided.next", { stage: t(`guided.${next}`) }),
        )}
    </div>
  );
}
