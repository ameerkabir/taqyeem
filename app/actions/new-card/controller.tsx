import { createController, type Middleware } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { boardContext, loadBoard } from "../../middleware/board.ts";
import { requireBoardMember } from "../../middleware/board-member.ts";
import { resolveActiveSection } from "../../models/boards/section.ts";
import { NewCardPage } from "./page.tsx";
import { parseNewCardForm } from "./schema.ts";
import { newCardError } from "./error-response.tsx";
import { getI18n } from "../../middleware/locale.ts";

export default createController(routes.newCard, {
  middleware: [
    loadBoard({ onError: newCardError }),
    requireCreationAllowed(),
    requireBoardMember({ onError: newCardError, redirectToJoin: true }),
  ],
  actions: {
    async index(context) {
      let board = context.board;
      let categories = await context.models.listCategories(board.id);
      let activeCategoryId = resolveActiveSection(
        context.url.searchParams.get("category"),
        categories,
        board,
      );
      return context.render(
        <NewCardPage
          board={board}
          categories={categories}
          activeCategoryId={activeCategoryId}
          submissionId={crypto.randomUUID()}
          i18n={context.i18n}
        />,
      );
    },
    async action(context) {
      let { board, member } = context;
      let data = await context.request.formData();
      let parsed = parseNewCardForm(data, context.i18n.t);
      if (!parsed.success) {
        return newCardError(context, parsed.issues[0].message, 400, { data });
      }
      let { text, categoryId, submissionId, isAnonymous } = parsed.value;
      let categories = await context.models.listCategories(board.id);
      if (!categories.some((category) => category.id === categoryId)) {
        return newCardError(context, context.i18n.t("card.error.invalidCategory"), 400, {
          data,
          categories,
        });
      }
      let result = await context.models.createCard(
        {
          categoryId,
          boardId: board.id,
          body: text,
          createdAt: new Date().toISOString(),
          voteCount: 0,
          memberId: member.id,
          isAnonymous,
          id: crypto.randomUUID(),
        },
        submissionId,
      );
      if (!result.ok) {
        return newCardError(
          context,
          context.i18n.t("card.error.rateLimited"),
          429,
          { data, categories, retryAfter: result.retryAfter },
        );
      }
      return redirect(
        `${routes.board.href({ boardId: board.id })}?section=${encodeURIComponent(result.card.categoryId)}`,
        303,
      );
    },
  },
});

// This operation-specific policy stays beside the controller.
function requireCreationAllowed(): Middleware {
  return (context, next) => {
    let board = context.get(boardContext);
    if (!board) throw new Error("Creation policy requires loadBoard");
    if (context.request.method === "POST" && board.status === "closed") {
      return newCardError(context, getI18n(context).t("access.boardClosed"), 403);
    }
    return next();
  };
}
