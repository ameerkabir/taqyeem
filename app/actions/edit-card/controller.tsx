import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { requireBoardMember } from "../../middleware/board-member.ts";
import { cardAccessError, cardManagementError } from "../card-access.tsx";
import { EditCardPage } from "./page.tsx";
import { parseEditCardForm, readEditValues } from "./schema.ts";

export default createController(routes.editCard, {
  middleware: [
    loadBoard({ onError: cardAccessError }),
    requireBoardMember({ onError: cardAccessError }),
  ],
  actions: {
    async index(context) {
      let { board, member } = context;
      let card = await context.models.getCard(board.id, context.params.cardId);
      let failure = cardManagementError(board, member.id, card, "edit");
      if (failure)
        return cardAccessError(context, failure.message, failure.status);
      if (!card) return cardAccessError(context, "الملاحظة غير موجودة", 404);
      let categories = await context.models.listCategories(board.id);
      return context.render(
        <EditCardPage board={board} card={card} categories={categories} />,
      );
    },
    async action(context) {
      let { board, member } = context;
      let card = await context.models.getCard(board.id, context.params.cardId);
      let failure = cardManagementError(board, member.id, card, "edit");
      if (!card || card.memberId !== member.id) {
        return cardAccessError(context, failure!.message, failure!.status);
      }
      const formError = async (
        message: string,
        status: number,
        data?: FormData,
      ) => {
        if (
          context.request.headers.get("Accept")?.includes("application/json")
        ) {
          return Response.json({ error: message }, { status });
        }
        data ??= await context.request.formData();
        let categories = await context.models.listCategories(board.id);
        return context.render(
          <EditCardPage
            board={board}
            card={card}
            categories={categories}
            values={readEditValues(data)}
            error={message}
          />,
          { status },
        );
      };
      if (failure) return formError(failure.message, failure.status);
      let data = await context.request.formData();
      let parsed = parseEditCardForm(data);
      if (!parsed.success)
        return formError(parsed.issues[0].message, 400, data);
      let { text, categoryId, isAnonymous } = parsed.value;
      let categories = await context.models.listCategories(board.id);
      if (!categories.some((category) => category.id === categoryId))
        return formError("التصنيف غير صالح", 400, data);
      let updated = await context.models.updateCard(board.id, card.id, {
        body: text,
        categoryId,
        isAnonymous,
      });
      if (!updated) return cardAccessError(context, "الملاحظة غير موجودة", 404);
      return redirect(
        `${routes.board.href({ boardId: board.id })}?section=${encodeURIComponent(updated.categoryId)}`,
        303,
      );
    },
  },
});
