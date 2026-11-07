import {
  mainStyle,
  headerStyle,
  titleStyle,
  statusPillStyle,
  navStyle,
  tabStyle,
  tabCounter,
  addNoteStyle,
  closedNoteStyle,
  votingBannerStyle,
  votingDotStyle,
  votingTitleStyle,
  votingHintStyle,
} from "./styles.ts";
import { Frame, type Handle } from "remix/component";
import { Document } from "../document.tsx";
import type {
  Board,
  Card,
  Category,
} from "../../data/fake-board.ts";
import { routes } from "../../routes.ts";
import { OrganiserControls } from "./organiser-controles.tsx";
import type { I18n } from "../../middleware/locale.ts";
import { isolate } from "../../i18n/translator.ts";
import { visuallyHiddenStyle } from "../../ui/visually-hidden.ts";

export function BoardPage(
  handle: Handle<{
    i18n: I18n;
    activeId: string;
    cards: Card[];
    categories: Category[];
    board: Board;
    isOrganiser: boolean;
  }>,
) {
  return () => {
    let { i18n } = handle.props;
    let { t } = i18n;
    let sectionId = handle.props.activeId;
    let categories = handle.props.categories;
    let cards = handle.props.cards;

    return (
      <Document
        i18n={i18n}
        title={t("page.title", {
          title: isolate(handle.props.board.title),
          suffix: t("app.name"),
        })}
      >
        <main mix={mainStyle}>
          <header mix={headerStyle}>
            <h1 dir="auto" mix={titleStyle}>
              {handle.props.board.title}
            </h1>
            <span mix={statusPillStyle}>
              {t(`board.status.${handle.props.board.status}`)}
            </span>
          </header>

          {handle.props.isOrganiser && (
            <OrganiserControls
              i18n={i18n}
              boardId={handle.props.board.id}
              status={handle.props.board.status}
              votingOpen={handle.props.board.votingOpen}
              sectionId={sectionId}
            />
          )}

          {handle.props.board.status === "meeting" &&
            handle.props.board.votingOpen && (
              <div aria-label={t("board.voting.label")} mix={votingBannerStyle}>
                <span aria-hidden="true" mix={votingDotStyle} />
                <div>
                  <p mix={votingTitleStyle}>{t("board.voting.openTitle")}</p>
                  <p mix={votingHintStyle}>{t("board.voting.openHint")}</p>
                </div>
              </div>
            )}
          <nav aria-label={t("board.sections")} mix={navStyle}>
            {categories.map((cat) => {
              let count = cards.filter(
                (card) => card.categoryId === cat.id,
              ).length;

              return (
                <a
                  key={cat.id}
                  mix={[tabStyle]}
                  href={`${routes.board.href({ boardId: handle.props.board.id })}?section=${cat.id}`}
                  aria-current={cat.id === sectionId ? "page" : undefined}
                >
                  <span dir="auto">{cat.label}</span>{" "}
                  <span mix={tabCounter} aria-hidden="true">
                    {i18n.formatNumber(count)}
                  </span>
                  <span mix={visuallyHiddenStyle}>
                    {t("board.tabCount", { count })}
                  </span>
                </a>
              );
            })}
          </nav>
          <Frame
            name="board-cards"
            src={`${routes.boardCards.href({ boardId: handle.props.board.id })}?section=${encodeURIComponent(sectionId)}`}
          />

          {handle.props.board.status === "closed" ? (
            <>
              <button
                type="button"
                disabled
                aria-describedby="closed-board-note"
                mix={addNoteStyle}
              >
                {t("board.addNote")}
              </button>
              <p id="closed-board-note" mix={closedNoteStyle}>
                {t("board.closedNote")}
              </p>
            </>
          ) : (
            <a
              href={`${routes.newCard.index.href({ boardId: handle.props.board.id })}?category=${sectionId}`}
              mix={addNoteStyle}
            >
              {t("board.addNote")}
            </a>
          )}
        </main>
      </Document>
    );
  };
}
