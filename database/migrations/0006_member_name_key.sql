-- Member names are unique per board once normalised (see app/models/members/name-key.ts).
-- The key is computed by the app (full Unicode folding), the database enforces the rule.
--
-- name_key stays nullable: SQLite cannot add a NOT NULL column to a table that has rows
-- without a default, and rebuilding `members` would cascade-delete its cards and votes through
-- their foreign keys. The app always sets it (insertMember); a unique index treats NULLs as
-- distinct, so a row inserted without a key would not be protected, which is why only
-- insertMember writes members.
ALTER TABLE members ADD COLUMN name_key TEXT;

-- Existing rows: an ASCII-only approximation of the app's key.
UPDATE members SET name_key = lower(trim(display_name));

-- If a board already holds two members with the same key, keep the first and give the others
-- an id-suffixed key, so the unique index below can always be created. Their display names are
-- untouched; they are simply not treated as duplicates of each other.
UPDATE members SET name_key = name_key || '#' || id
WHERE rowid NOT IN (SELECT min(rowid) FROM members GROUP BY board_id, name_key);

CREATE UNIQUE INDEX members_board_name_key ON members(board_id, name_key);
