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
  marginInlineEnd: "var(--space-4)",
  marginBlockEnd: "var(--space-2)",
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

const cardHeaderStyle = css({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "var(--space-2)",
});

const menuStyle = css({
  position: "relative",
  flexShrink: 0,
  "&[open] > summary": {
    backgroundColor: "var(--color-bg)",
    borderColor: "var(--color-primary)",
  },
});

const menuTriggerStyle = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minBlockSize: "var(--target-min)",
  minInlineSize: "var(--target-min)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-text)",
  cursor: "pointer",
  listStyle: "none",
  "&::-webkit-details-marker": { display: "none" },
  "&:hover": { backgroundColor: "var(--color-bg)" },
});

// Inline SVG instead of a "…" character: it renders identically in every font.
const menuIconStyle = css({
  inlineSize: "1.25rem",
  blockSize: "1.25rem",
  fill: "currentColor",
});

const menuListStyle = css({
  position: "absolute",
  insetInlineEnd: 0,
  zIndex: 1,
  margin: 0,
  padding: "var(--space-1)",
  listStyle: "none",
  minInlineSize: "8rem",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-surface)",
});

const menuItemStyle = css({
  display: "block",
  inlineSize: "100%",
  minBlockSize: "var(--target-min)",
  paddingInline: "var(--space-3)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  backgroundColor: "transparent",
  color: "var(--color-text)",
  font: "inherit",
  textAlign: "start",
  cursor: "pointer",
  "&:hover": { backgroundColor: "var(--color-bg)" },
});

const cardFooterStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-2)",
});

const votePillStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-1)",
  minBlockSize: "var(--target-min)",
  minInlineSize: "var(--target-min)",
  paddingInline: "var(--space-3)",
  border: "1px solid var(--color-primary)",
  borderRadius: "var(--radius-lg)",
  backgroundColor: "transparent",
  color: "var(--color-primary)",
  font: "inherit",
  cursor: "pointer",
  '&[aria-pressed="true"]': {
    backgroundColor: "var(--color-primary)",
    color: "var(--color-on-primary)",
  },
});

export function BoardPage(
  handle: Handle<{
    activeId: string;
    cards: Card[];
    categories: Category[];
    board: Board;
    members: Member[];
    viewerVotes: string[];
    viewerMemberId: string | null;
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

    let voted = new Set(handle.props.viewerVotes);

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
                    <div mix={cardHeaderStyle}>
                      <p dir="auto" mix={cardBodyStyle}>
                        {card.body}
                      </p>
                      {card.memberId === handle.props.viewerMemberId ? (
                        <details mix={menuStyle}>
                          <summary
                            aria-label="خيارات الملاحظة"
                            mix={menuTriggerStyle}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              mix={menuIconStyle}
                            >
                              <circle cx="5" cy="12" r="2" />
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="19" cy="12" r="2" />
                            </svg>
                          </summary>
                          <ul mix={menuListStyle}>
                            <li>
                              <button type="button" mix={menuItemStyle}>
                                تعديل
                              </button>
                            </li>
                            <li>
                              <button type="button" mix={menuItemStyle}>
                                حذف
                              </button>
                            </li>
                          </ul>
                        </details>
                      ) : null}
                    </div>
                    <div mix={cardFooterStyle}>
                      <p mix={cardAuthorStyle}>
                        {card.isAnonymous
                          ? "بدون اسم"
                          : memberNames.get(card.memberId)}
                      </p>
                      <button
                        type="button"
                        mix={votePillStyle}
                        aria-pressed={voted.has(card.id) ? "true" : "false"}
                      >
                        <span aria-hidden="true">👍</span> {card.voteCount}
                      </button>
                    </div>
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
