-- Migration number: 0001 	 2026-11-08T14:17:10.432Z
CREATE TABLE boards (
  id          TEXT PRIMARY KEY NOT NULL,
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  status      TEXT NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting', 'meeting', 'closed')),
  -- SQLite has no boolean: 0 = closed, 1 = open.
  voting_open INTEGER NOT NULL DEFAULT 0 CHECK (voting_open IN (0, 1)),
  -- The category being presented in a meeting; NULL until one is chosen.
  -- categories is created in 0003 and references boards, so this is a cycle; SQLite
  -- allows the forward reference because it is only checked when rows are written.
  -- The database does not check that the category belongs to this board; the model must.
  current_section_id TEXT DEFAULT NULL REFERENCES categories(id) ON DELETE SET NULL,
  -- A closed board has voting closed. Setters change both columns in one UPDATE, so
  -- there is never a moment (or a failed second write) that breaks this.
  CHECK (status <> 'closed' OR voting_open = 0)
);
