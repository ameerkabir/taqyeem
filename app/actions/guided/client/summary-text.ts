import type { Translator } from "../../../i18n/translator.ts";
import type { Card, Category, Member } from "../../../data/board.ts";
import type { Closure, Topic } from "../../../models/guided/session.ts";
import { formatDate } from "../../../i18n/format-date.ts";

export interface SummaryTextInput {
  boardTitle: string;
  /** The closed meeting, or null for a legacy board with no recorded closure. */
  closure: Closure | null;
  closureVersion?: number;
  /** Topics to list when there is no closure (the current ranking). */
  ranked: Topic[];
  /** Live notes, used only when the closure has no snapshot of its own. */
  cards: Card[];
  categories: Category[];
  members: Member[];
  t: Translator["t"];
  /** Intl locale for dates. */
  locale: string;
}

/**
 * The plain-text meeting summary the "Copy summary" button puts on the
 * clipboard: title, closure date, each topic with its outcome, decision and
 * notes, then the agreed and proposed actions. Anonymous authors stay anonymous.
 */
export function buildSummaryText(input: SummaryTextInput): string {
  let { closure, t, locale } = input;
  let source = closure?.cards ?? input.cards;
  let topics = closure?.topics ?? input.ranked;
  let names = new Map(input.members.map((m) => [m.id, m.displayName]));
  let author = (card: Card) =>
    card.isAnonymous ? t("cards.anonymous") : (names.get(card.memberId) ?? "");
  let category = (card: Card) =>
    input.categories.find((c) => c.id === card.categoryId)?.label ?? "";

  let header = [
    input.boardTitle,
    t("guided.history"),
    ...(closure
      ? [t("history.version", { version: input.closureVersion ?? 1 })]
      : []),
    closure
      ? t("guided.closedAt", { date: formatDate(locale, closure.at, "long-time") })
      : t("guided.legacyHistory"),
  ];
  let topicLines = topics.flatMap((topic) => [
    topic.title,
    t(
      `guided.${closure?.outcomes[topic.id] ?? "unaddressed"}` as "guided.unaddressed",
    ),
    closure?.decisions[topic.id] ?? t("guided.noDecision"),
    ...topic.notes.flatMap((id) => {
      let card = source.find((c) => c.id === id);
      return card ? [card.body, `${category(card)} · ${author(card)}`] : [];
    }),
  ]);
  let actionLines = (closure?.proposals ?? []).map((p) =>
    [
      `${p.text} — ${t(`guided.${p.disposition}`)}`,
      names.get(p.owner) ?? t("guided.unassigned"),
      ...(p.due ? [formatDate(locale, p.due, "due")] : []),
      ...(p.topic ? [topics.find((topic) => topic.id === p.topic)?.title ?? ""] : []),
    ].join(" · "),
  );
  return [...header, ...topicLines, ...actionLines].join("\n\n");
}
