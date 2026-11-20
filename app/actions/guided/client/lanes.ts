import type { Category } from "../../../data/board.ts";

/** At most this many lanes share a row; more categories wrap onto a second row. */
export const maxLanesPerRow = 4;

export interface LaneLayout {
  /** The category the viewer is focused on (falls back to the first). */
  current: Category | undefined;
  /** Every category's lane, in board order. Phones show only `current`. */
  lanes: Category[];
  /** Columns per row on wide screens, balanced so rows have similar lengths. */
  columns: number;
}

/** Columns for `count` lanes: all in one row up to four, else balanced rows (5–6 → 3, 7–8 → 4). */
export function laneColumns(count: number): number {
  if (count <= maxLanesPerRow) {
    return Math.max(count, 1);
  }
  return Math.ceil(count / Math.ceil(count / maxLanesPerRow));
}

/** Works out the Collect lanes and which one the viewer is focused on. */
export function laneLayout(categories: Category[], currentId: string): LaneLayout {
  let current = categories.find((c) => c.id === currentId) ?? categories[0];
  return { current, lanes: categories, columns: laneColumns(categories.length) };
}
