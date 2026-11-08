import type { RequestContext } from "remix/router";
import { Renderer, type RenderFunction } from "remix/middleware/render";
import type { Board, Card } from "../data/board.ts";
import { boardContext } from "../middleware/board.ts";
import { routes } from "../routes.ts";
import { CardPage } from "../ui/card-page.tsx";
import { errorStyle } from "../ui/public/card-form-styles.ts";
import { getI18n } from "../middleware/locale.ts";
import type { Translator } from "../i18n/translator.ts";

// Each operation has its own whole-sentence keys; no translated verb is spliced into a sentence.
export function cardManagementError(
  board: Board,
  memberId: string,
  card: Card | null,
  operation: "edit" | "delete",
  t: Translator["t"],
) {
  if (!card) return { message: t("access.cardNotFound"), status: 404 };
  if (card.memberId !== memberId) {
    return {
      message: operation === "edit" ? t("access.cannotEdit") : t("access.cannotDelete"),
      status: 403,
    };
  }
  if (board.status === "closed")
    return { message: t("access.boardClosed"), status: 403 };
  if (board.votingOpen) {
    return {
      message:
        operation === "edit"
          ? t("access.editLockedDuringVoting")
          : t("access.deleteLockedDuringVoting"),
      status: 403,
    };
  }
  return null;
}

export function cardAccessError(
  context: Pick<RequestContext, "request" | "get">,
  message: string,
  status: number,
) {
  if (context.request.headers.get("Accept")?.includes("application/json")) {
    return Response.json({ error: message }, { status });
  }
  let i18n = getI18n(context);
  let board = context.get(boardContext);
  let render = context.get(Renderer) as RenderFunction | undefined;
  if (!render) return new Response(message, { status });
  return render(
    <CardPage
      i18n={i18n}
      title={i18n.t("access.requestFailedTitle")}
      boardTitle={board?.title ?? i18n.t("app.name")}
      cancelHref={board ? routes.board.href({ boardId: board.id }) : routes.home.href()}
    >
      <p role="alert" mix={errorStyle}>
        {message}
      </p>
    </CardPage>,
    { status },
  );
}
