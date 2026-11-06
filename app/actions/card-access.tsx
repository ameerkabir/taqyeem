import type { RequestContext } from "remix/router";
import { Renderer, type RenderFunction } from "remix/middleware/render";
import type { Board, Card } from "../data/fake-board.ts";
import { boardContext } from "../middleware/board.ts";
import { routes } from "../routes.ts";
import { CardPage } from "../ui/card-page.tsx";
import { errorStyle } from "../ui/public/card-form-styles.ts";

export function cardManagementError(
  board: Board,
  memberId: string,
  card: Card | null,
  operation: "edit" | "delete",
) {
  if (!card) return { message: "الملاحظة غير موجودة", status: 404 };
  let verb = operation === "edit" ? "تعديل" : "حذف";
  if (card.memberId !== memberId)
    return { message: `لا يمكنك ${verb} هذه الملاحظة`, status: 403 };
  if (board.status === "closed")
    return { message: "اللوحة مغلقة", status: 403 };
  if (board.votingOpen)
    return { message: `لا يمكن ${verb} الملاحظة أثناء التصويت`, status: 403 };
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
  let board = context.get(boardContext);
  let render = context.get(Renderer) as RenderFunction | undefined;
  if (!render) return new Response(message, { status });
  return render(
    <CardPage
      title="تعذّر إكمال الطلب"
      boardTitle={board?.title ?? "تقييم"}
      cancelHref={board ? routes.board.href({ boardId: board.id }) : routes.home.href()}
    >
      <p role="alert" mix={errorStyle}>
        {message}
      </p>
    </CardPage>,
    { status },
  );
}
