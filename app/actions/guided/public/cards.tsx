import { on, type Handle } from "remix/component";
import type { Card } from "../../../data/board.ts";
import type { Topic, Proposal } from "../../../models/guided/session.ts";
import type { ViewerPayload } from "../payload.ts";
import { numberLocaleFor, type Locale } from "../../../i18n/locales.ts";
import { createTranslator } from "../../../i18n/translator.ts";
import { routes } from "../../../routes.ts";
import { CommandForm, type CommandProps } from "./command-form.tsx";
export function NoteCard(
  handle: Handle<{
    data: ViewerPayload;
    locale: Locale;
    card: Card;
    select?: boolean;
    rootId?: string;
    onCapture?: (card: Card) => void;
  }>,
) {
  return () => {
    let { data, locale, card, select = false, rootId = "" } = handle.props,
      state = data.state;
    let { t } = createTranslator(locale);
    return (
      <article
        key={card.id}
        class="feedback-card"
        data-tone={
          data.categories.find((c) => c.id === card.categoryId)?.tone ?? 0
        }
      >
        {select && (
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
        {state.stage === "collect" && card.memberId === data.memberId && (
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
        {["discuss", "actions"].includes(state.stage) && (
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
export function ActionCard(
  handle: Handle<{
    data: ViewerPayload;
    locale: Locale;
    proposal: Proposal;
    historical?: boolean;
    pending: boolean;
  }>,
) {
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
              {new Intl.DateTimeFormat(numberLocaleFor(locale), {
                dateStyle: "medium",
                timeZone: "UTC",
              }).format(new Date(p.due))}
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
                {(facilitator || p.owner === data.memberId) &&
                  command(
                    "complete",
                    { proposal: p.id, value: !p.completed },
                    t(p.completed ? "guided.undoComplete" : "guided.complete"),
                  )}
              </>
            ) : facilitator && state.stage !== "summary" ? (
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
