-- A vote is one member's vote on one card; (card, member) is the primary key, so voting
-- twice is impossible and voting is naturally idempotent.
-- board_id is redundant with the card's board but lets the composite foreign keys make the
-- database reject a vote where the card and the member belong to different boards.
-- The vote count of a card is a count of these rows; it is never stored on the card.

-- Target of votes' composite foreign key. A unique index is a valid parent key in SQLite.
CREATE UNIQUE INDEX cards_board_id_id ON cards(board_id, id);

CREATE TABLE votes (
  card_id    TEXT NOT NULL,
  member_id  TEXT NOT NULL,
  board_id   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (card_id, member_id),
  FOREIGN KEY (board_id, card_id)   REFERENCES cards   (board_id, id) ON DELETE CASCADE,
  FOREIGN KEY (board_id, member_id) REFERENCES members (board_id, id) ON DELETE CASCADE
);

-- Vote counts per card on a board, and "which cards did this member vote for".
CREATE INDEX votes_board_card ON votes(board_id, card_id);
CREATE INDEX votes_board_member ON votes(board_id, member_id);
