import { createController } from "remix/router";
import { BoardPage } from "./board-page.tsx";

import { routes } from "../routes.ts";
import { HomePage } from "./home-page.tsx";

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

      let section = context.url.searchParams.get("section") ?? "";
      let categories = await context.models.listCategories("demo");
      let cards = await context.models.listCards("demo");
      let activeId = categories.some((cat) => cat.id === section)
        ? section
        : categories[0]?.id;

      let members = await context.models.listMembers(board.id);

      console.log({ section, categories, cards, activeId });
      return context.render(
        <BoardPage
          activeId={activeId}
          cards={cards}
          categories={categories}
          board={board}
          members={members}
        />,
      );
    },
  },
});
