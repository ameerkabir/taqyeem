import {
  mainStyle,
  headerStyle,
  titleStyle,
  statusPillStyle,
  navStyle,
  tabStyle,
  tabCounter,
  addNoteStyle,
  votingBannerStyle,
  votingDotStyle,
  votingTitleStyle,
  votingHintStyle,
} from "./styles.ts";
import { Frame, type Handle } from "remix/component";
import { Document } from "../document.tsx";
import type {
  Board,
  BoardStatus,
  Card,
  Category,
} from "../../data/fake-board.ts";
import { routes } from "../../routes.ts";

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
  }>,
) {
  return () => {
    let sectionId = handle.props.activeId;
    let categories = handle.props.categories;
    let cards = handle.props.cards;

    return (
      <Document>
        <main mix={mainStyle}>
          <header mix={headerStyle}>
            <h1 mix={titleStyle}>{handle.props.board.title}</h1>
            <span mix={statusPillStyle}>
              {statusLabels[handle.props.board.status]}
            </span>
          </header>
          {handle.props.board.status === "meeting" &&
            handle.props.board.votingOpen && (
              <div mix={votingBannerStyle}>
                <span aria-hidden="true" mix={votingDotStyle} />
                <div>
                  <p mix={votingTitleStyle}>التصويت مفتوح</p>
                  <p mix={votingHintStyle}>
                    صوّت للملاحظات التي تودّ مناقشتها
                  </p>
                </div>
              </div>
            )}
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
          <Frame
            name="board-cards"
            src={`${routes.boardCards.href()}?section=${encodeURIComponent(sectionId)}`}
          />

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
