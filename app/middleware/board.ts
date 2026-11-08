import {
  createContextKey,
  type Middleware,
  type RequestContext,
} from "remix/router";
import type { Board } from "../data/fake-board.ts";
import { boardModelsContext } from "./models.ts";
import { getI18n } from "./locale.ts";

export const boardContext = createContextKey<Board>();

export type BoardAccessErrorHandler = (
  context: Pick<RequestContext, "request" | "get">,
  message: string,
  status: number,
) => Response | Promise<Response>;

export const boardAccessError: BoardAccessErrorHandler = (
  context,
  message,
  status,
) => {
  if (context.request.headers.get("Accept")?.includes("application/json")) {
    return Response.json({ error: message }, { status });
  }
  return new Response(message, { status });
};

export function loadBoard(
  options: { boardId?: string; onError?: BoardAccessErrorHandler } = {},
): Middleware<{ key: typeof boardContext; value: Board; property: "board" }> {
  return async (context, next) => {
    let models = context.get(boardModelsContext);
    if (!models)
      throw new Error("loadBoard requires loadBoardModels middleware");

    let boardId = options.boardId ?? context.params.boardId;
    let board = boardId ? await models.getBoard(boardId) : null;
    if (!board) {
      return (options.onError ?? boardAccessError)(
        context,
        getI18n(context).t("access.boardNotFound"),
        404,
      );
    }

    context.set(boardContext, board, { property: "board" });
    return next();
  };
}
