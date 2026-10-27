import type { BoardStatus, Card } from "../data/fake-board.ts";

export function compareCards(status: BoardStatus) {
  return (a: Card, b: Card) => {
    return status === "collecting"
      ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
      : b.voteCount - a.voteCount;
  };
}
