import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { resolveActiveSection } from "../../models/section.ts";
import { NewCardPage } from "./page.tsx";
import { isSubmissionId, parseNewCardForm } from "./schema.ts";
import type { Category } from "../../data/fake-board.ts";

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
      const board = await context.models.getBoard("demo");
      let enhanced = context.request.headers
        .get("Accept")
        ?.includes("application/json");

      if (!board) {
        if (enhanced) {
          return Response.json({ error: "اللوحة غير موجودة" }, { status: 404 });
        }
        return new Response("اللوحة غير موجودة", { status: 404 });
      }

      let data: FormData | undefined;
      let categories: Category[] | undefined;

      const formError = async (
        message: string,
        status: number,
        retryAfter?: number,
      ) => {
        let headers = new Headers();
        if (retryAfter !== undefined)
          headers.set("Retry-After", String(retryAfter));
        if (enhanced) {
          return Response.json({ error: message }, { status, headers });
        }

        // Ordinary submissions receive the form again, preserving the draft.
        data ??= await context.request.formData();
        categories ??= await context.models.listCategories(board.id);
        let text = data.get("text");
        let categoryId = data.get("categoryId");
        let submissionId = data.get("submissionId");
        return context.render(
          <NewCardPage
            board={board}
            categories={categories}
            activeCategoryId={resolveActiveSection(
              typeof categoryId === "string" ? categoryId : null,
              categories,
              board,
            )}
            submissionId={
              isSubmissionId(submissionId) ? submissionId : crypto.randomUUID()
            }
            values={{
              text: typeof text === "string" ? text : "",
              isAnonymous: data.get("isAnonymous") === "true",
            }}
            error={message}
          />,
          { status, headers },
        );
      };

      if (board.status === "closed") {
        return formError("اللوحة مغلقة", 403);
      }

      let memberId = await context.models.getViewerMemberId("demo");

      if (!memberId) {
        return formError("يرجى الانضمام إلى اللوحة", 403);
      }

      let members = await context.models.listMembers(board.id);

      if (!members.some((member) => member.id === memberId)) {
        return formError("العضو غير موجود في هذه اللوحة", 403);
      }

      data = await context.request.formData();
      let parsed = parseNewCardForm(data);
      if (!parsed.success) {
        return formError(parsed.issues[0].message, 400);
      }

      let { text, categoryId, submissionId, isAnonymous } = parsed.value;

      categories = await context.models.listCategories(board.id);

      if (!categories.some((category) => category.id === categoryId)) {
        return formError("التصنيف غير صالح", 400);
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
        return formError(
          "لقد نشرت ملاحظات كثيرة، يرجى الانتظار قليلًا",
          429,
          result.retryAfter,
        );
      }

      return redirect(
        `${routes.board.href()}?section=${encodeURIComponent(result.card.categoryId)}`,
        303,
      );
    },
  },
});
