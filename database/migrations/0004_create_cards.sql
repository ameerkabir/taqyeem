-- A card belongs to one board, one category of that board, and one member of that board.
-- The composite foreign keys make the database reject a card that mixes boards.
-- Deleting a board, category or member deletes its cards (the model refuses to delete a
-- category that still has cards; the database does not).
-- The 500 mirrors MAX_CARD_TEXT_LENGTH in app/data/limits.ts; keep in sync.
-- vote_count is not stored: it is a count of the votes table.
CREATE TABLE cards (
  id            TEXT PRIMARY KEY NOT NULL,
  board_id      TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  category_id   TEXT NOT NULL,
  member_id     TEXT NOT NULL,
  -- Generated once per page load; makes a repeated submit return the same card.
  submission_id TEXT NOT NULL,
  body          TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  is_anonymous  INTEGER NOT NULL DEFAULT 0 CHECK (is_anonymous IN (0, 1)),
  -- UTC ISO 8601 with milliseconds, so it sorts as text and Date.parse reads it as UTC.
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (board_id, category_id) REFERENCES categories (board_id, id) ON DELETE CASCADE,
  FOREIGN KEY (board_id, member_id)   REFERENCES members    (board_id, id) ON DELETE CASCADE,
  UNIQUE (board_id, member_id, submission_id)
);

-- Cards of a board by category (listing, and the cascade from categories).
CREATE INDEX cards_board_category ON cards(board_id, category_id);
-- The rate-limit query: this member's recent cards on this board.
CREATE INDEX cards_board_member_created ON cards(board_id, member_id, created_at);
