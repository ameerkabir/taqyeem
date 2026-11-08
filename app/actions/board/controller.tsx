import { createAction } from "remix/router";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { boardNotFound } from "../board-not-found.tsx";
import { requireBoardMember } from "../../middleware/board-member.ts";
import { resolveActiveSection } from "../../models/boards/section.ts";
import { BoardPage } from "./page.tsx";

export default createAction(routes.board, {
  // Only members see a board; everyone else is sent to the join form.
  middleware: [loadBoard({ onError: boardNotFound }), requireBoardMember({ redirectToJoin: true })],
  async handler(context) {
    let { board, member } = context;

    let section = context.url.searchParams.get("section");
    let categories = await context.models.listCategories(board.id);
    let cards = await context.models.listCards(board.id);
    let activeId = resolveActiveSection(section, categories, board);

    let isOrganiser = member.id === board.organiserMemberId;

    return context.render(
      <BoardPage
        i18n={context.i18n}
        activeId={activeId}
        cards={cards}
        categories={categories}
        board={board}
        isOrganiser={isOrganiser}
      />,
    );
  },
});
