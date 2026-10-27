import { css, type Handle } from "remix/component";
import { Document } from "./document.tsx";
import type { Board, Card, Category, Member } from "../data/fake-board.ts";
import { routes } from "../routes.ts";
import { compareCards } from "../models/cards.ts";

const mainStyle = css({
  paddingInline: "var(--page-gutter)",
  paddingBlock: "var(--space-4)",
});

// Bleeds to the screen edges so tabs scroll under them, while the first tab
// still lines up with the page content (negative margin cancels the gutter,
// padding puts it back).
const navStyle = css({
  display: "flex",
  gap: "var(--space-2)",
  marginInline: "calc(var(--page-gutter) * -1)",
  paddingInline: "var(--page-gutter)",
  scrollPaddingInline: "var(--page-gutter)",
  overflowX: "auto",
});

const tabStyle = css({
  display: "flex",
  alignItems: "center",
  minBlockSize: "var(--target-min)",
  paddingInline: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  color: "var(--color-text-muted)",
  textDecoration: "none",
  whiteSpace: "nowrap",
  "&:hover": { color: "var(--color-text)" },
  "&:active": { opacity: 0.8 },
  '&[aria-current="page"]': {
    backgroundColor: "var(--color-primary)",
    color: "var(--color-on-primary)",
  },
});

const tabCounter = css({
  display: "inline-block",
  marginInline: "var(--space-1)",
});

const listStyle = css({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "var(--space-3)",
});

const cardStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
  padding: "var(--space-4)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-surface)",
});

const cardBodyStyle = css({
  margin: 0,
  fontSize: "var(--text-md)",
});

const cardAuthorStyle = css({
  margin: 0,
  color: "var(--color-text-muted)",
});

export function BoardPage(
  handle: Handle<{
    activeId: string;
    cards: Card[];
    categories: Category[];
    board: Board;
    members: Member[];
  }>,
) {
  return () => {
    let sectionId = handle.props.activeId;
    let categories = handle.props.categories;
    let cards = handle.props.cards;
    let activeCards = cards
      .filter((c) => c.categoryId === sectionId)
      .sort(compareCards(handle.props.board.status));

    let memberNames = new Map(
      handle.props.members.map((m) => [m.id, m.displayName]),
    );

    return (
      <Document>
        <main mix={mainStyle}>
          <nav aria-label="الأقسام" mix={navStyle}>
            {categories.map((cat) => {
              let count = cards.filter(
                (card) => card.categoryId === cat.id,
              ).length;

              return (
                <a
                  key={cat.id}
                  mix={[tabStyle]}
                  href={`${routes.board.href()}?section=${cat.id}`}
                  aria-current={cat.id === sectionId ? "page" : undefined}
                >
                  {cat.label} <span mix={tabCounter}>{count}</span>
                </a>
              );
            })}
          </nav>

          <section>
            {activeCards.length === 0 ? (
              <p>لا توجد ملاحظات بعد</p>
            ) : (
              <ul mix={listStyle}>
                {activeCards.map((card) => (
                  <li key={card.id} mix={cardStyle}>
                    <p dir="auto" mix={cardBodyStyle}>
                      {card.body}
                    </p>
                    <p mix={cardAuthorStyle}>
                      {card.isAnonymous
                        ? "بدون اسم"
                        : memberNames.get(card.memberId)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </Document>
    );
  };
}
