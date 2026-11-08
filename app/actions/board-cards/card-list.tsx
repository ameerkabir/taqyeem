import { type Handle } from "remix/component";
import type { Board, Card, Member } from "../../data/board.ts";
import {
  cardAuthorStyle,
  organiserBadgeStyle,
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
import { compareCards } from "../../models/cards/sort.ts";
import type { I18n } from "../../middleware/locale.ts";

interface CardListProps {
  i18n: I18n;
  activeId: string;
  board: Board;
  cards: Card[];
  members: Member[];
  viewerVotes: string[];
  viewerMemberId: string | null;
}

export function Cardlist(handle: Handle<CardListProps>) {
  return () => {
    let { i18n, activeId, board, cards, members, viewerVotes, viewerMemberId } =
      handle.props;
    let { t } = i18n;

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
          <p>{t("cards.empty")}</p>
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
                        aria-label={t("cards.menu")}
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
                                {t("cards.edit")}
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
                                {t("cards.delete")}
                              </a>
                            </li>
                          </>
                        ) : (
                          <li>
                            <p mix={menuHintStyle}>
                              {handle.props.board.status === "closed"
                                ? t("cards.boardClosed")
                                : t("cards.lockedDuringVoting")}
                            </p>
                          </li>
                        )}
                      </ul>
                    </details>
                  ) : null}
                </div>
                <div mix={cardFooterStyle}>
                  <p dir="auto" mix={cardAuthorStyle}>
                    {card.isAnonymous
                      ? t("cards.anonymous")
                      : memberNames.get(card.memberId)}
                    {/* Names are unique per board but look-alike characters can slip past, so
                        the organiser is marked: a note that says "Sam" without the badge is not
                        from the person running the board. Anonymous notes name no one. */}
                    {!card.isAnonymous && card.memberId === board.organiserMemberId && (
                      <span mix={organiserBadgeStyle}>{t("cards.organiserBadge")}</span>
                    )}
                  </p>

                  <VoteCounter
                    locale={i18n.locale}
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
