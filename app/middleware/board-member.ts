import { createContextKey, type Middleware } from "remix/router";
import { redirect } from "remix/response/redirect";
import type { Member } from "../data/board.ts";
import { ACCESS_REASON_HEADER, NOT_MEMBER_REASON } from "../data/access.ts";
import { routes } from "../routes.ts";
import {
  boardAccessError,
  boardContext,
  type BoardAccessErrorHandler,
} from "./board.ts";
import { boardModelsContext } from "./models.ts";
import { getI18n } from "./locale.ts";

export const boardMemberContext = createContextKey<Member>();

/**
 * Only members may use a board. This is the server-side gate for every board route; hiding
 * buttons in the UI is not security.
 *
 * Rejections are 403 (JSON when the client asks for JSON), except with `redirectToJoin`:
 * a browser navigating to a page (GET, not asking for JSON) is sent to the join form
 * instead. Mutations and fetches never redirect, because a fetch would follow it and
 * receive the join page's HTML where it expects JSON.
 */
export function requireBoardMember(
  options: { onError?: BoardAccessErrorHandler; redirectToJoin?: boolean } = {},
): Middleware<{
  key: typeof boardMemberContext;
  value: Member;
  property: "member";
}> {
  return async (context, next) => {
    let board = context.get(boardContext);
    let models = context.get(boardModelsContext);
    if (!board || !models) {
      throw new Error(
        "requireBoardMember requires loadBoardModels and loadBoard middleware",
      );
    }

    let fail = options.onError ?? boardAccessError;
    async function reject(messageKey: "access.joinBoard" | "access.memberNotFound") {
      let wantsJson = context.request.headers.get("Accept")?.includes("application/json");
      if (options.redirectToJoin && context.request.method === "GET" && !wantsJson) {
        return redirect(routes.joinBoard.index.href({ boardId: board!.id }), 303);
      }
      let response = await fail(context, getI18n(context).t(messageKey), 403);
      response.headers.set(ACCESS_REASON_HEADER, NOT_MEMBER_REASON);
      return response;
    }

    let memberId = await models.getViewerMemberId(board.id);
    if (!memberId) return reject("access.joinBoard");

    let members = await models.listMembers(board.id);
    let member = members.find(
      (candidate) =>
        candidate.id === memberId && candidate.boardId === board.id,
    );
    if (!member) return reject("access.memberNotFound");

    context.set(boardMemberContext, member, { property: "member" });
    return next();
  };
}
