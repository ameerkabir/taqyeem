import {
  board,
  categories,
  members,
  cards,
  type Board,
  type Category,
  type Member,
  type Card,
} from "./fake-board.ts";
import type { GuidedStatus } from "../models/guided/session.ts";

export interface FakeBoardStore {
  boards: Map<string, Board>;
  categories: Category[];
  members: Member[];
  cards: Card[];
  submissions: Map<string, Card>;
  votes: Map<string, Set<string>>;
  /** Guided sessions by board id; boards without one are legacy boards. */
  guided: Map<string, GuidedStatus>;
}

export function createFakeBoardStore(
  overrides: Partial<FakeBoardStore> = {},
): FakeBoardStore {
  return {
    boards: new Map([[board.id, { ...board }]]),
    categories: categories.map((category) => ({ ...category })),
    members: members.map((member) => ({ ...member })),
    cards: cards.map((card) => ({ ...card })),
    submissions: new Map(),
    votes: new Map(),
    guided: new Map(),
    ...overrides,
  };
}
