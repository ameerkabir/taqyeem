import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { resolveActiveSection } from "../../models/section.ts";
import { NewCardPage } from "./page.tsx";
import { parseNewCardForm } from "./schema.ts";

export default createController(routes.newCard, {
  actions: {
    async index(context) {
      let board = await context.models.getBoard("demo");
      if (!board) return new Response("اللوحة غير موجودة", { status: 404 });

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
        />,
      );
    },
    async action(context) {
      let board = await context.models.getBoard("demo");
      if (!board) return new Response("اللوحة غير موجودة", { status: 404 });

      if (board.status === "closed") {
        return new Response("اللوحة مغلقة", { status: 403 });
      }

      let memberId = await context.models.getViewerMemberId("demo");

      if (!memberId) {
        return new Response("يرجى الانضمام إلى اللوحة", { status: 403 });
      }

      let members = await context.models.listMembers(board.id);

      if (!members.some((member) => member.id === memberId)) {
        return new Response("العضو غير موجود في هذه اللوحة", { status: 403 });
      }

      let data = await context.request.formData();
      let parsed = parseNewCardForm(data);
      if (!parsed.success) {
        return new Response(parsed.issues[0].message, { status: 400 });
      }

      let { text, categoryId, submissionId, isAnonymous } = parsed.value;

      let categories = await context.models.listCategories(board.id);

      if (!categories.some((category) => category.id === categoryId)) {
        return new Response("التصنيف غير صالح", { status: 400 });
      }

      let result = await context.models.createCard(
        {
          categoryId,
          boardId: board.id,
          body: text,
          createdAt: new Date().toISOString(),
          voteCount: 0,
          memberId,
          isAnonymous,
          id: crypto.randomUUID(),
        },
        submissionId,
      );

      if (!result.ok) {
        return new Response("لقد نشرت ملاحظات كثيرة، يرجى الانتظار قليلًا", { status: 429, headers: { "Retry-After": String(result.retryAfter) } });
      }

      return redirect(
        `${routes.board.href()}?section=${encodeURIComponent(result.card.categoryId)}`,
        303,
      );
    },
  },
});
