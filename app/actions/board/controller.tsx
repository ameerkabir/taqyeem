import { createAction } from "remix/router";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { resolveActiveSection } from "../../models/section.ts";
import { BoardPage } from "./page.tsx";

export default createAction(routes.board, {
  middleware: [loadBoard()],
  async handler(context) {
    let board = context.board;

    let section = context.url.searchParams.get("section");
    let categories = await context.models.listCategories(board.id);
    let cards = await context.models.listCards(board.id);
    let activeId = resolveActiveSection(section, categories, board);
    let viewerVotes = await context.models.listViewerVotes(board.id);

    let members = await context.models.listMembers(board.id);
    let viewerMemberId = await context.models.getViewerMemberId(board.id);

    return context.render(
      <BoardPage
        activeId={activeId}
        cards={cards}
        categories={categories}
        board={board}
        members={members}
        viewerVotes={viewerVotes}
        viewerMemberId={viewerMemberId}
      />,
    );
  },
});
