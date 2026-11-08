import { createController } from "remix/router";
import { routes } from "../routes.ts";
import { HomePage } from "./home-page.tsx";
import { redirect } from "remix/response/redirect";

export default createController(
  { home: routes.home, demoBoard: routes.demoBoard },
  {
    actions: {
      home(context) {
        return context.render(<HomePage i18n={context.i18n} />);
      },
      demoBoard(context) {
        return redirect(
          routes.board.href({ boardId: "demo" }) + context.url.search,
          302,
        );
      },
    },
  },
);
