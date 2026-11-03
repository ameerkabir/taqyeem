import { createAction } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { requireBoardMember } from "../../middleware/board-member.ts";
import { cardAccessError } from "../card-access.tsx";

export default createAction(routes.vote, {
  middleware: [
    loadBoard({ onError: cardAccessError }),
    requireBoardMember({ onError: cardAccessError }),
  ],

  async handler(context) {
    let { board, member } = context;
    if (board.status === "closed") {
      return cardAccessError(context, "اللوحة مغلقة", 403);
    }
    if (!board.votingOpen) {
      return cardAccessError(context, "التصويت غير متاح حاليًا", 403);
    }

    let form = await context.request.formData();
    let values = form.getAll("voted");
    let voted = values[0];

    if (values.length !== 1 || (voted !== "true" && voted !== "false")) {
      return cardAccessError(context, "قيمة التصويت غير صالحة", 400);
    }

    let card = await context.models.getCard(board.id, context.params.cardId);
    if (!card) return cardAccessError(context, "الملاحظة غير موجودة", 404);

    let result = await context.models.setCardVote(
      board.id,
      card.id,
      member.id,
      voted === "true",
    );
    if (!result) return cardAccessError(context, "الملاحظة غير موجودة", 404);

    if (context.request.headers.get("Accept")?.includes("application/json")) {
      return Response.json(result);
    }

    return redirect(
      `${routes.board.href()}?section=${encodeURIComponent(card.categoryId)}`,
      303,
    );
  },
});
