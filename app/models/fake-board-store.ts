import {
  board,
  categories,
  members,
  cards,
  type Board,
  type Category,
  type Member,
  type Card,
} from "../data/fake-board.ts";

export interface FakeBoardStore {
  boards: Map<string, Board>;
  categories: Category[];
  members: Member[];
  cards: Card[];
  submissions: Map<string, Card>;
  votes: Map<string, Set<string>>;
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
    ...overrides,
  };
}
