import type { Board, Category } from "../data/fake-board.ts";

export function resolveActiveSection(
  requestId: string | null,
  categories: Category[],
  board: Board,
) {
  let ids = categories.map((c) => c.id);

  if (requestId && ids.includes(requestId)) {
    return requestId;
  }

  if (
    board.status === "meeting" &&
    board.currentSectionId &&
    ids.includes(board.currentSectionId)
  ) {
    return board.currentSectionId;
  }

  return categories[0]?.id;
}
