import { createContextKey, type Middleware } from "remix/router";
import type { BoardModels } from "../models/boards.ts";
import { createFakeBoardModels } from "../models/fake-boards.ts";
import { Session } from "remix/session";
import { boardMemberSessionKey } from "../sessions.ts";
import { viewerMemberId } from "../data/fake-board.ts";

export const boardModelsContext = createContextKey<BoardModels>();

export function loadBoardModels(): Middleware<{
  key: typeof boardModelsContext;
  value: BoardModels;
  property: "models";
}> {
  return (context, next) => {
    let currentSession = context.get(Session);
    if (!currentSession) {
      throw new Error("loadBoardModels requires session middleware");
    }

    let models = createFakeBoardModels(undefined, Date.now, async (boardId) => {
      let memberId = currentSession.get(boardMemberSessionKey(boardId));
      if (typeof memberId === "string") return memberId;

      // Preserve the existing demo experience only.
      return boardId === "demo" ? viewerMemberId : null;
    });

    context.set(boardModelsContext, models, { property: "models" });
    return next();
  };
}
