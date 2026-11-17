// DB-free so the browser workspace and the server share one agenda order.
export interface Theme {
  id: string;
  title: string;
  notes: string[];
}
export interface Topic {
  id: string;
  title: string;
  notes: string[];
}
export interface TopicSource {
  cards: readonly { id: string; body: string }[];
  state: { themes: readonly Theme[] };
}

/** Themes plus ungrouped notes, in the order their earliest note was written. */
export function topics(view: TopicSource): Topic[] {
  let grouped = new Set(view.state.themes.flatMap((t) => t.notes));
  // Source order, not theme name, locale, vote time or display shelf, breaks ties.
  let rank = new Map(view.cards.map((c, i) => [c.id, i]));
  return [
    ...view.state.themes.map((t) => ({ ...t })),
    ...view.cards
      .filter((c) => !grouped.has(c.id))
      .map((c) => ({ id: c.id, title: c.body, notes: [c.id] })),
  ].sort(
    (a, b) =>
      Math.min(...a.notes.map((id) => rank.get(id) ?? Infinity)) -
      Math.min(...b.notes.map((id) => rank.get(id) ?? Infinity)),
  );
}
