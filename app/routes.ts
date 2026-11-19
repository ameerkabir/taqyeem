import { form, get, post, route } from "remix/routes";

export const routes = route({
  home: "/",
  setAppearance: post("/appearance"),
  setLocale: post("/locale"),
  newBoard: form("/boards/new"),
  joinBoard: form("/boards/:boardId/join"),
  sessionState: get("/boards/:boardId/session"),
  sessionCommand: post("/boards/:boardId/commands"),
  board: get("/boards/:boardId"),
  newCard: form("/boards/:boardId/new"),
  deleteCard: form("/boards/:boardId/cards/:cardId/delete"),
  editAction: form("/boards/:boardId/actions/:proposalId/edit"),
  editCard: form("/boards/:boardId/cards/:cardId/edit"),
  boardCards: get("/boards/:boardId/cards"),
  vote: post("/boards/:boardId/cards/:cardId/vote"),
  boardVoting: post("/boards/:boardId/voting"),
  boardStatus: post("/boards/:boardId/status"),
});
