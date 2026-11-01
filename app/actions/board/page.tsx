import {
  mainStyle,
  headerStyle,
  titleStyle,
  statusPillStyle,
  navStyle,
  tabStyle,
  tabCounter,
  listStyle,
  cardStyle,
  cardBodyStyle,
  cardAuthorStyle,
  cardHeaderStyle,
  menuStyle,
  menuTriggerStyle,
  menuIconStyle,
  menuListStyle,
  menuItemStyle,
  menuHintStyle,
  cardFooterStyle,
  votePillStyle,
  addNoteStyle,
} from "./styles.ts";
import type { Handle } from "remix/component";
import { Document } from "../document.tsx";
import type {
  Board,
  BoardStatus,
  Card,
  Category,
  Member,
} from "../../data/fake-board.ts";
import { routes } from "../../routes.ts";
import { compareCards } from "../../models/cards.ts";

const statusLabels: Record<BoardStatus, string> = {
  collecting: "جمع الملاحظات",
  meeting: "اجتماع",
  closed: "مغلق",
};

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
          <header mix={headerStyle}>
            <h1 mix={titleStyle}>{handle.props.board.title}</h1>
            <span mix={statusPillStyle}>
              {statusLabels[handle.props.board.status]}
            </span>
          </header>
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
                            {handle.props.board.status !== "closed" &&
                            !handle.props.board.votingOpen ? (
                              <>
                                <li>
                                  <a
                                    href={routes.editCard.index.href({
                                      cardId: card.id,
                                    })}
                                    mix={menuItemStyle}
                                  >
                                    تعديل
                                  </a>
                                </li>
                                <li>
                                  <a
                                    href={routes.deleteCard.index.href({
                                      cardId: card.id,
                                    })}
                                    mix={menuItemStyle}
                                  >
                                    حذف
                                  </a>
                                </li>
                              </>
                            ) : (
                              <li>
                                <p mix={menuHintStyle}>
                                  {handle.props.board.status === "closed"
                                    ? "اللوحة مغلقة"
                                    : "التعديل والحذف غير متاحين أثناء التصويت"}
                                </p>
                              </li>
                            )}
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
          <a
            href={`${routes.newCard.index.href()}?category=${sectionId}`}
            mix={addNoteStyle}
          >
            + أضف ملاحظة هنا
          </a>
        </main>
      </Document>
    );
  };
}
