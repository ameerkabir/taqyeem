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

const MAX_SECTION_LENGTH = 100;

/**
 * Where a non-member is sent: the join form for the board they asked for, carrying the category
 * they were looking at (`section` on the board page, `category` on the new-note page) so joining
 * lands them back there. The value is only passed along here; the join controller checks that it
 * names a real category of this board before using it, so a forged value is just dropped.
 */
function joinHref(boardId: string, requestUrl: string) {
  let url = new URL(requestUrl);
  let section = url.searchParams.get("section") ?? url.searchParams.get("category");
  let href = routes.joinBoard.index.href({ boardId });
  return section && section.length <= MAX_SECTION_LENGTH
    ? `${href}?${new URLSearchParams({ section })}`
    : href;
}

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
        return redirect(joinHref(board!.id, context.request.url), 303);
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
