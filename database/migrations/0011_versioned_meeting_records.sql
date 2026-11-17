-- Save every real closure as an append-only version. Legacy boards without a
-- closure get no manufactured record. Existing evidence and sessions stay intact.
CREATE TABLE guided_closures (
 board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
 version INTEGER NOT NULL CHECK(version >= 1),
 closed_at TEXT NOT NULL,
 snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
 PRIMARY KEY(board_id,version)
);
INSERT INTO guided_closures(board_id,version,closed_at,snapshot)
 SELECT board_id,1,json_extract(data,'$.closure.at'),json_extract(data,'$.closure')
 FROM guided_sessions WHERE json_extract(data,'$.closure') IS NOT NULL;
UPDATE guided_sessions SET data=json_set(data,'$.closureVersion',CASE WHEN json_extract(data,'$.closure') IS NOT NULL THEN 1 ELSE 0 END),revision=revision+1;

CREATE TRIGGER guided_archive_update BEFORE UPDATE ON guided_closures
BEGIN SELECT RAISE(ABORT,'immutable_meeting_record'); END;
CREATE TRIGGER guided_archive_delete BEFORE DELETE ON guided_closures
WHEN EXISTS(SELECT 1 FROM boards WHERE id=OLD.board_id)
BEGIN SELECT RAISE(ABORT,'immutable_meeting_record'); END;

-- A closure, archive insertion and command receipt commit in the same statement.
CREATE TRIGGER guided_archive_insert BEFORE INSERT ON guided_closures
WHEN NOT EXISTS(SELECT 1 FROM guided_sessions WHERE board_id=NEW.board_id
 AND json_extract(data,'$.closure')=NEW.snapshot
 AND coalesce(json_extract(data,'$.closureVersion'),1)=NEW.version
 AND json_extract(data,'$.stage')='summary')
BEGIN SELECT RAISE(ABORT,'invalid_meeting_record'); END;
CREATE TRIGGER guided_close_guard BEFORE UPDATE OF data ON guided_sessions
WHEN json_extract(OLD.data,'$.closure') IS NULL AND json_extract(NEW.data,'$.closure') IS NOT NULL
BEGIN
 SELECT CASE WHEN json_extract(OLD.data,'$.stage')<>'actions' OR json_extract(NEW.data,'$.stage')<>'summary'
 OR coalesce(json_extract(NEW.data,'$.closureVersion'),1)<>coalesce(json_extract(OLD.data,'$.closureVersion'),0)+1
 OR json_extract(NEW.data,'$.receipt.id') IS json_extract(OLD.data,'$.receipt.id')
 OR NOT EXISTS(SELECT 1 FROM members WHERE id=json_extract(NEW.data,'$.receipt.member') AND board_id=OLD.board_id AND role='organiser')
 THEN RAISE(ABORT,'invalid_closure') END;
END;
CREATE TRIGGER guided_close_archive AFTER UPDATE OF data ON guided_sessions
WHEN json_extract(OLD.data,'$.closure') IS NULL AND json_extract(NEW.data,'$.closure') IS NOT NULL
BEGIN
 INSERT INTO guided_closures(board_id,version,closed_at,snapshot)
 VALUES(NEW.board_id,coalesce(json_extract(NEW.data,'$.closureVersion'),1),json_extract(NEW.data,'$.closure.at'),json_extract(NEW.data,'$.closure'));
END;

-- Reopening may clear only the active pointer, never the saved record. It must
-- be a fresh facilitator command resuming Discuss, with the same version number.
DROP TRIGGER guided_closure_immutable;
CREATE TRIGGER guided_closure_immutable BEFORE UPDATE OF data ON guided_sessions
WHEN json_extract(OLD.data,'$.closure') IS NOT NULL
 AND (json_extract(NEW.data,'$.closure') IS NOT json_extract(OLD.data,'$.closure') OR json_extract(NEW.data,'$.stage')<>'summary')
 AND NOT coalesce((
  json_extract(NEW.data,'$.closure') IS NULL AND json_extract(NEW.data,'$.stage')='discuss'
  AND json_extract(NEW.data,'$.receipt.kind')='reopen'
  AND json_extract(NEW.data,'$.receipt.id') IS NOT json_extract(OLD.data,'$.receipt.id')
  AND coalesce(json_extract(NEW.data,'$.closureVersion'),1)=coalesce(json_extract(OLD.data,'$.closureVersion'),1)
  AND EXISTS(SELECT 1 FROM members WHERE id=json_extract(NEW.data,'$.receipt.member') AND board_id=OLD.board_id AND role='organiser')
  AND EXISTS(SELECT 1 FROM guided_closures WHERE board_id=OLD.board_id AND version=coalesce(json_extract(OLD.data,'$.closureVersion'),1) AND snapshot=json_extract(OLD.data,'$.closure'))
 ),0)
BEGIN SELECT RAISE(ABORT,'immutable_closure'); END;

CREATE TRIGGER guided_closure_version BEFORE UPDATE OF data ON guided_sessions
WHEN coalesce(json_extract(NEW.data,'$.closureVersion'),CASE WHEN json_extract(NEW.data,'$.closure') IS NOT NULL THEN 1 ELSE 0 END)
 <> coalesce(json_extract(OLD.data,'$.closureVersion'),CASE WHEN json_extract(OLD.data,'$.closure') IS NOT NULL THEN 1 ELSE 0 END)
 AND NOT(json_extract(OLD.data,'$.closure') IS NULL AND json_extract(NEW.data,'$.closure') IS NOT NULL
  AND coalesce(json_extract(NEW.data,'$.closureVersion'),1)=coalesce(json_extract(OLD.data,'$.closureVersion'),0)+1)
BEGIN SELECT RAISE(ABORT,'invalid_closure_version'); END;
