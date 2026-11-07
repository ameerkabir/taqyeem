import { createRouter, type RouterContext } from "remix/router";
import { render } from "remix/middleware/render";
import { cop } from "remix/middleware/cop";
import { loadLocale, getI18n } from "./middleware/locale.ts";
import { loadAppDependencies, type AppDependencies } from "./middleware/dependencies.ts";
import { loadSession } from "./sessions.ts";

import controller from "./actions/controller.tsx";
import boardController from "./actions/board/controller.tsx";
import newCardController from "./actions/new-card/controller.tsx";
import editCardController from "./actions/edit-card/controller.tsx";
import deleteCardController from "./actions/delete-card/controller.tsx";
import { routes } from "./routes.ts";
import { loadBoardModels } from "./middleware/models.ts";
import boardCardsController from "./actions/board-cards/controller.tsx";
import voteController from "./actions/vote/controller.ts";
import boardVotingController from "./actions/board-voting/controller.ts";
import boardStatusController from "./actions/board-status/controller.ts";
import localeController from "./actions/locale/controller.ts";
import newBoardController from "./actions/new-board/controller.tsx";

// Static files under `public/` and compiled client scripts under `/assets/*` are served
// directly by Vite in dev and by Cloudflare's Workers Assets in production (see
// vite.config.ts and wrangler.jsonc) — this router only ever sees dynamic requests.
export interface AppRouterOptions extends AppDependencies {
  sessionSecret: string;
}

// A fresh router for each incoming request; never cache request capabilities.
export function createAppRouter(options: AppRouterOptions) {
  let router = createRouter({
    middleware: [
      loadLocale(),
      cop({
        // Locale resolves before cop so a rejected cross-origin request keeps the user's language.
        onDeny: (_reason, context) =>
          new Response(getI18n(context).t("access.crossOriginDenied"), { status: 403 }),
      }),
      render(),
      loadAppDependencies(options),
      loadSession(options.sessionSecret),
      loadBoardModels(),
    ],
  });

  router.map({ home: routes.home, demoBoard: routes.demoBoard }, controller);
  router.map(routes.board, boardController);
  router.map(routes.newCard, newCardController);
  router.map(routes.editCard, editCardController);
  router.map(routes.deleteCard, deleteCardController);
  router.map(routes.boardCards, boardCardsController);
  router.map(routes.vote, voteController);
  router.map(routes.boardVoting, boardVotingController);
  router.map(routes.boardStatus, boardStatusController);
  router.map(routes.newBoard, newBoardController);
  router.map(routes.setLocale, localeController);

  return router;
}

export type AppContext = RouterContext<ReturnType<typeof createAppRouter>>;

declare module "remix" {
  interface RouterTypes {
    context: AppContext;
  }
}
