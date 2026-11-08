-- A category belongs to exactly one board and is stored in the creator's language.
-- The 120 mirrors MAX_CATEGORY_LABEL_LENGTH in app/data/limits.ts; keep in sync.
-- "At least one category per board" cannot be a constraint; the model enforces it.
CREATE TABLE categories (
  id       TEXT PRIMARY KEY NOT NULL,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  label    TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  position INTEGER NOT NULL CHECK (position >= 0),
  -- Doubles as the lookup index for "categories of a board, in order".
  UNIQUE (board_id, position),
  -- Target of cards' composite foreign key (a card cannot use another board's category).
  UNIQUE (board_id, id)
);
