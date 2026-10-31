import { form, route } from "remix/routes";

export const routes = route({
  home: "/",
  board: "/board",
  newCard: form("/board/new"),
});
