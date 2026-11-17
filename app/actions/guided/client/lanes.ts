import type { Category } from "../../../data/board.ts";

/** Boards with up to this many categories show every lane side by side. */
export const maxLanesTogether = 4;
/** Larger boards page through their categories in shelves of this size. */
export const shelfSize = 3;

export interface LaneLayout {
  /** The category the viewer is focused on (falls back to the first). */
  current: Category | undefined;
  /** Which shelf `current` is on; 0 when every lane fits. */
  shelf: number;
  /** The lanes to render now. */
  lanes: Category[];
}

/** Works out which Collect lanes to show for the viewer's chosen category. */
export function laneLayout(categories: Category[], currentId: string): LaneLayout {
  let current = categories.find((c) => c.id === currentId) ?? categories[0];
  let shelf = Math.floor(categories.indexOf(current!) / shelfSize);
  if (shelf < 0) {
    shelf = 0;
  }
  let lanes =
    categories.length <= maxLanesTogether
      ? categories
      : categories.slice(shelf * shelfSize, shelf * shelfSize + shelfSize);
  return { current, shelf, lanes };
}
