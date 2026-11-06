import type { Middleware } from "remix/router";
import {
  boardAccessError,
  boardContext,
  type BoardAccessErrorHandler,
} from "./board.ts";
import { boardMemberContext } from "./board-member.ts";
import { getI18n } from "./locale.ts";

export function requireBoardOrganiser(
  options: { onError?: BoardAccessErrorHandler } = {},
): Middleware {
  return (context, next) => {
    let board = context.get(boardContext);
    let member = context.get(boardMemberContext);

    if (!board || !member) {
      throw new Error(
        "requireBoardOrganiser requires loadBoard and requireBoardMember",
      );
    }

    if (board.organiserMemberId !== member.id) {
      let fail = options.onError ?? boardAccessError;
      return fail(context, getI18n(context).t("access.organiserOnly"), 403);
    }

    return next();
  };
}
