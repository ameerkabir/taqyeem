import { createRouter, type RouterContext } from "remix/router";
import { render } from "remix/middleware/render";

import controller from "./actions/controller.tsx";
import boardController from "./actions/board/controller.tsx";
import newCardController from "./actions/new-card/controller.tsx";
import editCardController from "./actions/edit-card/controller.tsx";
import deleteCardController from "./actions/delete-card/controller.tsx";
import { routes } from "./routes.ts";
import { loadBoardModels } from "./middleware/models.ts";

// Static files under `public/` and compiled client scripts under `/assets/*` are served
// directly by Vite in dev and by Cloudflare's Workers Assets in production (see
// vite.config.ts and wrangler.jsonc) — this router only ever sees dynamic requests.
export const router = createRouter({
  middleware: [render(), loadBoardModels()],
});

export type AppContext = RouterContext<typeof router>;

declare module "remix" {
  interface RouterTypes {
    context: AppContext;
  }
}

router.map({ home: routes.home }, controller);
router.map(routes.board, boardController);
router.map(routes.newCard, newCardController);
router.map(routes.editCard, editCardController);
router.map(routes.deleteCard, deleteCardController);
