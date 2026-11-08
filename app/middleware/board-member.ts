import { createContextKey, type Middleware } from "remix/router";
import type { Member } from "../data/board.ts";
import {
  boardAccessError,
  boardContext,
  type BoardAccessErrorHandler,
} from "./board.ts";
import { boardModelsContext } from "./models.ts";
import { getI18n } from "./locale.ts";

export const boardMemberContext = createContextKey<Member>();

export function requireBoardMember(
  options: { onError?: BoardAccessErrorHandler } = {},
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
    let memberId = await models.getViewerMemberId(board.id);
    if (!memberId) return fail(context, getI18n(context).t("access.joinBoard"), 403);

    let members = await models.listMembers(board.id);
    let member = members.find(
      (candidate) =>
        candidate.id === memberId && candidate.boardId === board.id,
    );
    if (!member) return fail(context, getI18n(context).t("access.memberNotFound"), 403);

    context.set(boardMemberContext, member, { property: "member" });
    return next();
  };
}
