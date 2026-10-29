import { createContextKey, type Middleware } from "remix/router";
import type { BoardModels } from "../models/boards.ts";
import { createFakeBoardModels } from "../models/fake-boards.ts";

export const boardModelsContext = createContextKey<BoardModels>();

export function loadBoardModels(): Middleware<{
  key: typeof boardModelsContext;
  value: BoardModels;
  property: "models";
}> {
  return (context, next) => {
    context.set(boardModelsContext, createFakeBoardModels(), {
      property: "models",
    });
    return next();
  };
}
