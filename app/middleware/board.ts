import {
  createContextKey,
  type Middleware,
  type RequestContext,
} from "remix/router";
import type { Board } from "../data/board.ts";
import { boardModelsContext } from "./models.ts";
import { sql } from "remix/data-table";
import { databaseContext } from "./dependencies.ts";
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

    let db = context.get(databaseContext);
    if (db) {
      let row = (
        await db.exec(
          sql`SELECT json_extract(data,'$.categorySetup.confirmed') AS configured,json_extract(data,'$.stage') AS stage FROM guided_sessions WHERE board_id=${board.id}`,
        )
      ).rows?.[0];
      if (row)
        board = {
          ...board,
          guidedStage: String(row.stage),
          categorySetupRequired: row.configured === 0,
          status:
            row.stage === "summary"
              ? "closed"
              : row.stage === "collect"
                ? "collecting"
                : "meeting",
          votingOpen: false,
        };
    }
    context.set(boardContext, board, { property: "board" });
    return next();
  };
}
