import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { requireBoardMember } from "../../middleware/board-member.ts";

export default createController(routes.deleteCard, {
  middleware: [loadBoard(), requireBoardMember()],
  actions: {
    async index(context) {
      let { board, member } = context;
      let card = await context.models.getCard(board.id, context.params.cardId);
      if (!card) return new Response("الملاحظة غير موجودة", { status: 404 });
      if (card.memberId !== member.id) {
        return new Response("لا يمكنك حذف هذه الملاحظة", { status: 403 });
      }
      if (board.status === "closed") {
        return new Response("اللوحة مغلقة", { status: 403 });
      }
      if (board.votingOpen) {
        return new Response("لا يمكن حذف الملاحظة أثناء التصويت", { status: 403 });
      }
      // The confirmation screen is still part of the unfinished issue #14 work.
      return new Response("تأكيد الحذف لم يُنفّذ بعد", { status: 501 });
    },
    async action(context) {
      let { board, member } = context;
      let card = await context.models.getCard(board.id, context.params.cardId);
      if (!card) return new Response("الملاحظة غير موجودة", { status: 404 });
      if (card.memberId !== member.id) {
        return new Response("لا يمكنك حذف هذه الملاحظة", { status: 403 });
      }
      if (board.status === "closed") {
        return new Response("اللوحة مغلقة", { status: 403 });
      }
      if (board.votingOpen) {
        return new Response("لا يمكن حذف الملاحظة أثناء التصويت", { status: 403 });
      }
      let deleted = await context.models.deleteCard(board.id, card.id);
      if (!deleted) return new Response("الملاحظة غير موجودة", { status: 404 });
      return redirect(
        `${routes.board.href()}?section=${encodeURIComponent(card.categoryId)}`,
        303,
      );
    },
  },
});
