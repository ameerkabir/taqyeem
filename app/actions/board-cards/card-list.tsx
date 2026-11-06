import { type Handle } from "remix/component";
import type { Board, Card, Member } from "../../data/fake-board.ts";
import {
  cardAuthorStyle,
  cardBodyStyle,
  cardFooterStyle,
  cardHeaderStyle,
  cardStyle,
  listStyle,
  menuHintStyle,
  menuIconStyle,
  menuItemStyle,
  menuListStyle,
  menuStyle,
  menuTriggerStyle,
} from "./styles.ts";
import { routes } from "../../routes.ts";
import { VoteCounter } from "./public/vote-counter.tsx";
import { compareCards } from "../../models/cards.ts";

interface CardListProps {
  activeId: string;
  board: Board;
  cards: Card[];
  members: Member[];
  viewerVotes: string[];
  viewerMemberId: string | null;
}

export function Cardlist(handle: Handle<CardListProps>) {
  return () => {
    let { activeId, board, cards, members, viewerVotes, viewerMemberId } =
      handle.props;

    let activeCards = cards
      .filter((card) => card.categoryId === activeId)
      .sort(compareCards(board.status));

    let memberNames = new Map(
      members.map((member) => [member.id, member.displayName]),
    );

    let voted = new Set(viewerVotes);

    return (
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
                                  boardId: board.id,
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
                                  boardId: board.id,
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

                  <VoteCounter
                    card={card}
                    voted={voted.has(card.id)}
                    disabled={board.status === "closed" || !board.votingOpen}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };
}
