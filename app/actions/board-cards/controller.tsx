import { createAction } from "remix/router";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { requireBoardMember } from "../../middleware/board-member.ts";
import { Cardlist } from "./card-list.tsx";
import { resolveActiveSection } from "../../models/boards/section.ts";

export default createAction(routes.boardCards, {
  // A fragment fetched by the board page: members only, and a plain 403 (never a redirect).
  middleware: [loadBoard(), requireBoardMember()],

  async handler(context) {
    let { board, member } = context;

    let categories = await context.models.listCategories(board.id);
    let activeId = resolveActiveSection(
      context.url.searchParams.get("section"),
      categories,
      board,
    );
    let cards = await context.models.listCards(board.id);
    let members = await context.models.listMembers(board.id);
    let viewerVotes = await context.models.listViewerVotes(board.id);

    return context.render(
      <Cardlist
        i18n={context.i18n}
        activeId={activeId}
        board={board}
        cards={cards}
        members={members}
        viewerVotes={viewerVotes}
        viewerMemberId={member.id}
      />,
    );
  },
});
