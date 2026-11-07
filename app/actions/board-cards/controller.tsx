import { createAction } from "remix/router";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { Cardlist } from "./card-list.tsx";
import { resolveActiveSection } from "../../models/section.ts";

export default createAction(routes.boardCards, {
  middleware: [loadBoard()],

  async handler(context) {
    let board = context.board;

    let categories = await context.models.listCategories(board.id);
    let activeId = resolveActiveSection(
      context.url.searchParams.get("section"),
      categories,
      board,
    );
    let cards = await context.models.listCards(board.id);
    let members = await context.models.listMembers(board.id);
    let viewerVotes = await context.models.listViewerVotes(board.id);
    let viewerMemberId = await context.models.getViewerMemberId(board.id);

    return context.render(
      <Cardlist
        i18n={context.i18n}
        activeId={activeId}
        board={board}
        cards={cards}
        members={members}
        viewerVotes={viewerVotes}
        viewerMemberId={viewerMemberId}
      />,
    );
  },
});
