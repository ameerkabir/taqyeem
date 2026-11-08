-- A member belongs to exactly one board; the same person on two boards is two rows.
-- The organiser is a role on the member, which avoids a boards <-> members cycle.
-- The 60 mirrors MAX_MEMBER_NAME_LENGTH in app/data/limits.ts; keep in sync.
CREATE TABLE members (
  id           TEXT PRIMARY KEY NOT NULL,
  board_id     TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 60),
  role         TEXT NOT NULL CHECK (role IN ('organiser', 'participant')),
  -- Redundant for uniqueness (id is already unique); it is the target of cards'
  -- composite foreign key, which stops a card using a member of another board.
  UNIQUE (board_id, id)
);

CREATE INDEX members_board_id ON members(board_id);

-- At most one organiser per board, enforced by the database.
CREATE UNIQUE INDEX one_organiser_per_board ON members(board_id) WHERE role = 'organiser';
