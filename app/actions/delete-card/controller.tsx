import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { requireBoardMember } from "../../middleware/board-member.ts";
import { cardAccessError, cardManagementError } from "../card-access.tsx";
import { DeleteCardPage } from "./page.tsx";

export default createController(routes.deleteCard, {
  middleware: [
    loadBoard({ onError: cardAccessError }),
    requireBoardMember({ onError: cardAccessError }),
  ],
  actions: {
    async index(context) {
      let { board, member } = context;
      let card = await context.models.getCard(board.id, context.params.cardId);
      let failure = cardManagementError(
        board,
        member.id,
        card,
        "delete",
        context.i18n.t,
      );
      if (failure)
        return cardAccessError(context, failure.message, failure.status);
      if (!card) return cardAccessError(context, context.i18n.t("access.cardNotFound"), 404);
      return context.render(<DeleteCardPage i18n={context.i18n} board={board} card={card} />);
    },
    async action(context) {
      let { board, member } = context;
      let card = await context.models.getCard(board.id, context.params.cardId);
      let failure = cardManagementError(
        board,
        member.id,
        card,
        "delete",
        context.i18n.t,
      );
      if (failure)
        return cardAccessError(context, failure.message, failure.status);
      if (!card) return cardAccessError(context, context.i18n.t("access.cardNotFound"), 404);
      let deleted = await context.models.deleteCard(board.id, card.id);
      if (!deleted) return cardAccessError(context, context.i18n.t("access.cardNotFound"), 404);
      return redirect(
        `${routes.board.href({ boardId: board.id })}?section=${encodeURIComponent(card.categoryId)}`,
        303,
      );
    },
  },
});
