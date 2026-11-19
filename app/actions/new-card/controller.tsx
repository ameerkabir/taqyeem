import { DataTableDatabaseError } from "remix/data-table";
import { isCollectLock } from "../../models/guided/errors.ts";
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
import { guidedNotesClosed } from "../../models/guided/policy.ts";
import { attachNote } from "../../models/guided/session.ts";

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
          memberId={context.member.id}
          board={board}
          categories={categories}
          activeCategoryId={activeCategoryId}
          submissionId={crypto.randomUUID()}
          attachTopic={context.url.searchParams.get("attachTopic") ?? undefined}
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
        return newCardError(
          context,
          context.i18n.t("card.error.invalidCategory"),
          400,
          {
            data,
            categories,
          },
        );
      }
      let result;
      try {
        result = await context.models.createCard(
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
      } catch (error) {
        if (isCollectLock(error)) {
          return newCardError(
            context,
            context.i18n.t("guided.collectOnly"),
            409,
            { data, categories },
          );
        }
        if (error instanceof DataTableDatabaseError) {
          return newCardError(context, context.i18n.t("newCard.failed"), 503, {
            data,
            categories,
          });
        }
        throw error;
      }
      if (!result.ok) {
        return newCardError(
          context,
          context.i18n.t("card.error.rateLimited"),
          429,
          { data, categories, retryAfter: result.retryAfter },
        );
      }
      let topic = data.get("attachTopic");
      if (board.guidedStage === "discuss" && typeof topic === "string" && topic) {
        await attachNote(context.db, board.id, member.id, result.card.id, topic);
        return redirect(
          `${routes.board.href({ boardId: board.id })}?topic=${encodeURIComponent(topic)}`,
          303,
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
    if (!board) {
      throw new Error("Creation policy requires loadBoard");
    }
    if (board.categorySetupRequired) {
      return newCardError(context, getI18n(context).t("setup.required"), 403);
    }
    if (guidedNotesClosed(board)) {
      return newCardError(
        context,
        getI18n(context).t("guided.collectOnly"),
        403,
      );
    }
    if (context.request.method === "POST" && board.status === "closed") {
      return newCardError(
        context,
        getI18n(context).t("access.boardClosed"),
        403,
      );
    }
    return next();
  };
}
