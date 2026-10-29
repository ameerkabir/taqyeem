import { createController } from "remix/router";
import { BoardPage } from "./board-page.tsx";

import { routes } from "../routes.ts";
import { HomePage } from "./home-page.tsx";
import { resolveActiveSection } from "../models/section.ts";

export default createController(routes, {
  actions: {
    home(context) {
      return context.render(<HomePage />);
    },
    board: async function (context) {
      let board = await context.models.getBoard("demo");

      if (!board) {
        return new Response("Not found", { status: 404 });
      }

      let section = context.url.searchParams.get("section");
      let categories = await context.models.listCategories("demo");
      let cards = await context.models.listCards("demo");
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
  },
});
