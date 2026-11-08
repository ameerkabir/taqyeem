import { createContextKey, type Middleware } from "remix/router";
import type { BoardModels } from "../models/board-models.ts";
import { createDbBoardModels } from "../models/db-board-models.ts";
import { Session } from "remix/session";
import { boardMemberSessionKey } from "../sessions.ts";
import { databaseContext } from "./dependencies.ts";

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
    let db = context.get(databaseContext);
    if (!db) {
      throw new Error("loadBoardModels requires loadAppDependencies middleware");
    }

    // Models are built per request so "who is the viewer" comes from this request's session.
    let models = createDbBoardModels(db, async (boardId) => {
      let memberId = currentSession.get(boardMemberSessionKey(boardId));
      return typeof memberId === "string" ? memberId : null;
    });

    context.set(boardModelsContext, models, { property: "models" });
    return next();
  };
}
