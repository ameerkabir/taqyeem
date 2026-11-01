import { createController } from "remix/router";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { requireBoardMember } from "../../middleware/board-member.ts";

export default createController(routes.editCard, {
  middleware: [loadBoard(), requireBoardMember()],
  actions: {
    async index(context) {
      let cardId = context.params.cardId;
      // Load board, viewer, and card; check permission; render form.
      return new Response("تعديل الملاحظة لم يُنفّذ بعد", { status: 501 });
    },
    async action(context) {
      // Repeat permission checks, validate fields, then update.
      return new Response("تعديل الملاحظة لم يُنفّذ بعد", { status: 501 });
    },
  },
});
