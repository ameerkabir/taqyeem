import { on, type Handle } from "remix/component";
import type { Card } from "../../../data/board.ts";
import type { Topic, Proposal } from "../../../models/guided/session.ts";
import { formatDate } from "../../../i18n/format-date.ts";
import type { ViewerPayload } from "../payload.ts";
import { numberLocaleFor, type Locale } from "../../../i18n/locales.ts";
import { createTranslator } from "../../../i18n/translator.ts";
import { routes } from "../../../routes.ts";
import { CommandForm, type CommandProps } from "./command-form.tsx";

export interface NoteCardProps {
  data: ViewerPayload;
  locale: Locale;
  card: Card;
  /** Show a checkbox that adds the note to the workspace's theme form. */
  select?: boolean;
  /** The workspace root id, used to target its `<id>-theme` form. */
  rootId?: string;
  /** Offers "capture an action" from this note when given. */
  onCapture?: (card: Card) => void;
  /** Hide every control (past records and reviewed steps). */
  readOnly?: boolean;
  /** The organiser may drag this note to another category. */
  canMove?: boolean;
  /** A command is saving, so dragging and buttons are disabled. */
  pending?: boolean;
  /** This note is the one being dragged. */
  dragging?: boolean;
}

/** One feedback note: body, category, author (unless anonymous) and its own controls. */
export function NoteCard(handle: Handle<NoteCardProps>) {
  return () => {
    let { data, locale, card, select = false, rootId = "" } = handle.props,
      state = data.state;
    let { t } = createTranslator(locale);
    return (
      <article
        key={card.id}
        class="feedback-card"
        data-card-id={card.id}
        draggable={!!handle.props.canMove && !handle.props.pending}
        data-dragging={handle.props.dragging ? "true" : undefined}
        data-tone={
          data.categories.find((c) => c.id === card.categoryId)?.tone ?? 0
        }
      >
        {select && !handle.props.readOnly && (
          <label class="checkbox">
            <input
              form={`${rootId}-theme`}
              type="checkbox"
              name="notes"
              value={card.id}
            />
            {t("guided.selectNote")}
          </label>
        )}
        <p class="note-body" dir="auto">
          {card.body}
        </p>
        <footer>
          <bdi>
            {data.categories.find((c) => c.id === card.categoryId)?.label}
          </bdi>
          <span>
            {card.isAnonymous ? (
              t("cards.anonymous")
            ) : (
              <bdi>
                {data.members.find((m) => m.id === card.memberId)?.displayName}
              </bdi>
            )}
            {!card.isAnonymous &&
              card.memberId === data.board.organiserMemberId && (
                <> · {t("guided.facilitator")}</>
              )}
            {card.memberId === data.memberId && <> · {t("guided.yours")}</>}
          </span>
        </footer>
        {!handle.props.readOnly &&
          state.stage === "collect" &&
          card.memberId === data.memberId && (
            <nav class="note-controls">
              <a
                href={routes.editCard.index.href({
                  boardId: data.board.id,
                  cardId: card.id,
                })}
              >
                {t("cards.edit")}
              </a>
              <a
                href={routes.deleteCard.index.href({
                  boardId: data.board.id,
                  cardId: card.id,
                })}
              >
                {t("cards.delete")}
              </a>
            </nav>
          )}
        {handle.props.canMove && (
          <details class="note-move" data-move-card={card.id}>
            <summary>{t("collect.moveNote")}</summary>
            <CommandForm
              data={data}
              kind="move-note"
              fields={{ card: card.id, fromCategory: card.categoryId }}
            >
              <label>
                {t("collect.moveTo")}
                <select
                  name="categoryId"
                  required
                  disabled={handle.props.pending}
                >
                  {data.categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                      selected={category.id === card.categoryId}
                    >
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={handle.props.pending}>
                {t("collect.moveNote")}
              </button>
            </CommandForm>
          </details>
        )}
        {!handle.props.readOnly &&
          ["discuss", "actions"].includes(state.stage) && (
            <a
              href={`?capture=${data.state.themes.find((theme) => theme.notes.includes(card.id))?.id ?? card.id}&captureNote=${card.id}#${rootId}-capture`}
              mix={on("click", (event) => {
                if (handle.props.onCapture) {
                  event.preventDefault();
                  handle.props.onCapture(card);
                }
              })}
            >
              {t(
                data.memberId === data.board.organiserMemberId
                  ? "guided.addAction"
                  : "guided.suggestAction",
              )}
            </a>
          )}
      </article>
    );
  };
}
/** A collapsible list of the notes behind a topic. */
export function Evidence(
  handle: Handle<{ data: ViewerPayload; locale: Locale; topic: Topic }>,
) {
  return () => {
    let { data, locale, topic } = handle.props;
    let { t } = createTranslator(locale);
    const note = (card: Card) => (
      <NoteCard key={card.id} data={data} locale={locale} card={card} />
    );
    return (
      <details class="evidence">
        <summary>
          {t("guided.evidence")} ·{" "}
          {t("guided.sources", { count: topic.notes.length })}
        </summary>
        <div class="note-stack">
          {topic.notes
            .map((id) => data.cards.find((c) => c.id === id))
            .filter((c): c is Card => !!c)
            .map((c) => note(c))}
        </div>
      </details>
    );
  };
}
export interface ActionCardProps {
  data: ViewerPayload;
  locale: Locale;
  proposal: Proposal;
  /** Rendered from a past meeting record: no progress or edit controls. */
  historical?: boolean;
  /** A command is saving, so buttons are disabled. */
  pending: boolean;
  /** Hide every control (reviewed steps). */
  readOnly?: boolean;
}

/** An action item with its owner, due date and progress, plus the controls the viewer may use. */
export function ActionCard(handle: Handle<ActionCardProps>) {
  return () => {
    let {
        data,
        locale,
        proposal: p,
        historical = false,
        pending,
      } = handle.props,
      state = data.state,
      facilitator = data.memberId === data.board.organiserMemberId;
    let { t } = createTranslator(locale);
    const command = (
      kind: string,
      fields: CommandProps["fields"],
      label: string,
    ) => (
      <CommandForm data={data} kind={kind} fields={fields}>
        <button disabled={pending}>{label}</button>
      </CommandForm>
    );
    return (
      <article key={p.id} class="action-card">
        <p dir="auto">{p.text}</p>
        {!historical &&
          !handle.props.readOnly &&
          ["discuss", "actions"].includes(state.stage) &&
          (facilitator ||
            (p.author === data.memberId && p.disposition === "suggested")) && (
            <a
              href={routes.editAction.index.href({
                boardId: data.board.id,
                proposalId: p.id,
              })}
            >
              {t("cards.edit")}
            </a>
          )}
        <p class="metadata">
          {t(`guided.${p.disposition}`)} ·{" "}
          <bdi>
            {data.members.find((m) => m.id === p.owner)?.displayName ??
              t("guided.unassigned")}
          </bdi>
          {p.due && (
            <>
              {" "}
              ·{" "}
              {formatDate(numberLocaleFor(locale), p.due, "due")}
            </>
          )}
        </p>
        {!historical && (
          <footer>
            {p.disposition === "agreed" ? (
              <>
                <span>
                  {t(p.completed ? "guided.completed" : "guided.open")}
                </span>
                {!handle.props.readOnly &&
                  (facilitator || p.owner === data.memberId) &&
                  command(
                    "complete",
                    { proposal: p.id, value: !p.completed },
                    t(p.completed ? "guided.undoComplete" : "guided.complete"),
                  )}
              </>
            ) : !handle.props.readOnly &&
              facilitator &&
              state.stage !== "summary" ? (
              <div class="control-row">
                {command(
                  "disposition",
                  { proposal: p.id, value: "agreed" },
                  t("guided.agree"),
                )}
                {command(
                  "disposition",
                  { proposal: p.id, value: "deferred" },
                  t("guided.defer"),
                )}
                {command(
                  "disposition",
                  { proposal: p.id, value: "declined" },
                  t("guided.decline"),
                )}
              </div>
            ) : null}
          </footer>
        )}
      </article>
    );
  };
}
