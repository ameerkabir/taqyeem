import type { RequestContext } from "remix/router";
import { Renderer, type RenderFunction } from "remix/middleware/render";
import type { Category } from "../../data/board.ts";
import { boardAccessError, boardContext } from "../../middleware/board.ts";
import { boardModelsContext } from "../../middleware/models.ts";
import { resolveActiveSection } from "../../models/boards/section.ts";
import { NewCardPage } from "./page.tsx";
import { getI18n } from "../../middleware/locale.ts";
import { isSubmissionId } from "./schema.ts";

// Shared by the access middleware and action, while form presentation stays route-owned.
export async function newCardError(
  context: Pick<RequestContext, "request" | "get">,
  message: string,
  status: number,
  options: {
    data?: FormData;
    categories?: Category[];
    retryAfter?: number;
  } = {},
) {
  let headers = new Headers();
  if (options.retryAfter !== undefined) {
    headers.set("Retry-After", String(options.retryAfter));
  }
  if (context.request.headers.get("Accept")?.includes("application/json")) {
    return Response.json({ error: message }, { status, headers });
  }

  let board = context.get(boardContext);
  if (!board) return boardAccessError(context, message, status);
  let models = context.get(boardModelsContext);
  // This route uses the standard component renderer installed in app/router.ts.
  let render = context.get(Renderer) as RenderFunction | undefined;
  if (!models || !render)
    throw new Error("newCardError requires models and render middleware");

  let data =
    options.data ??
    (context.request.method === "POST"
      ? await context.request.formData()
      : new FormData());
  let categories =
    options.categories ?? (await models.listCategories(board.id));
  let text = data.get("text");
  let categoryId = data.get("categoryId");
  let submissionId = data.get("submissionId");
  return render(
    <NewCardPage
      i18n={getI18n(context)}
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
}
