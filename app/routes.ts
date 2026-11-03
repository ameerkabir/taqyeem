import { form, get, post, route } from "remix/routes";

export const routes = route({
  home: "/",
  board: "/board",
  newCard: form("/board/new"),
  deleteCard: form("/board/cards/:cardId/delete"),
  editCard: form("/board/cards/:cardId/edit"),
  boardCards: get("/board/cards"),
  vote: post("/board/cards/:cardId/vote"),
});
