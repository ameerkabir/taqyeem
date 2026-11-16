-- Forward-only: preserve existing boards/cards/votes and explicit category identity.
ALTER TABLE categories ADD COLUMN tone INTEGER NOT NULL DEFAULT 0 CHECK(tone BETWEEN 0 AND 3);
UPDATE categories SET tone = position % 4;
CREATE TABLE guided_sessions (
 board_id TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
 data TEXT NOT NULL CHECK(json_valid(data))
);
CREATE TABLE browser_sessions (
 id TEXT PRIMARY KEY,
 data TEXT NOT NULL CHECK(json_valid(data)),
 expires_at INTEGER NOT NULL
);
-- Prevent stale note forms and stage-change races at the write boundary.
CREATE TRIGGER guided_card_insert BEFORE INSERT ON cards
WHEN EXISTS (SELECT 1 FROM guided_sessions WHERE board_id=NEW.board_id AND json_extract(data,'$.stage') <> 'collect')
BEGIN SELECT RAISE(ABORT, 'collect_only'); END;
CREATE TRIGGER guided_card_update BEFORE UPDATE ON cards
WHEN EXISTS (SELECT 1 FROM guided_sessions WHERE board_id=OLD.board_id AND json_extract(data,'$.stage') <> 'collect')
BEGIN SELECT RAISE(ABORT, 'collect_only'); END;
CREATE TRIGGER guided_card_delete BEFORE DELETE ON cards
WHEN EXISTS (SELECT 1 FROM guided_sessions WHERE board_id=OLD.board_id AND json_extract(data,'$.stage') <> 'collect')
AND EXISTS (SELECT 1 FROM boards WHERE id=OLD.board_id)
BEGIN SELECT RAISE(ABORT, 'collect_only'); END;
-- Editing the evidence invalidates a previously read session revision.
CREATE TRIGGER guided_card_insert_revision AFTER INSERT ON cards
BEGIN UPDATE guided_sessions SET revision=revision+1 WHERE board_id=NEW.board_id; END;
CREATE TRIGGER guided_card_update_revision AFTER UPDATE ON cards
BEGIN UPDATE guided_sessions SET revision=revision+1 WHERE board_id=NEW.board_id; END;
CREATE TRIGGER guided_card_delete_revision AFTER DELETE ON cards
BEGIN UPDATE guided_sessions SET revision=revision+1 WHERE board_id=OLD.board_id; END;
-- Existing command endpoints cannot bypass the guided workflow.
CREATE TRIGGER guided_legacy_status BEFORE UPDATE OF status, voting_open ON boards
WHEN EXISTS (SELECT 1 FROM guided_sessions WHERE board_id=OLD.id)
AND (NEW.status <> OLD.status OR NEW.voting_open <> OLD.voting_open)
BEGIN SELECT RAISE(ABORT, 'guided_command_required'); END;
CREATE TRIGGER guided_legacy_vote BEFORE INSERT ON votes
WHEN EXISTS (SELECT 1 FROM guided_sessions WHERE board_id=NEW.board_id)
BEGIN SELECT RAISE(ABORT, 'guided_command_required'); END;
CREATE TRIGGER guided_closure_immutable BEFORE UPDATE OF data ON guided_sessions
WHEN json_extract(OLD.data,'$.closure') IS NOT NULL
AND (json_extract(NEW.data,'$.closure') IS NOT json_extract(OLD.data,'$.closure')
 OR json_extract(NEW.data,'$.stage') <> 'summary')
BEGIN SELECT RAISE(ABORT, 'immutable_closure'); END;
