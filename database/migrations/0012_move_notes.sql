-- A category move and its receipt commit with the session's conditional update.
-- Only a fresh organiser command during Collect may move a board's note.
CREATE TRIGGER guided_note_move_guard BEFORE UPDATE OF data ON guided_sessions
WHEN json_extract(NEW.data,'$.receipt.kind')='move-note'
 AND json_extract(NEW.data,'$.receipt.id') IS NOT json_extract(OLD.data,'$.receipt.id')
BEGIN
 SELECT CASE WHEN json_extract(OLD.data,'$.stage')<>'collect'
 OR json_extract(NEW.data,'$.stage')<>'collect'
 OR json_extract(NEW.data,'$.categorySetup.confirmed')=0
 OR NOT EXISTS(SELECT 1 FROM members WHERE board_id=OLD.board_id AND role='organiser' AND id=json_extract(NEW.data,'$.receipt.member'))
 OR NOT EXISTS(SELECT 1 FROM cards WHERE board_id=OLD.board_id AND id=json_extract(NEW.data,'$.receipt.move.card') AND category_id=json_extract(NEW.data,'$.receipt.move.fromCategory'))
 OR NOT EXISTS(SELECT 1 FROM categories WHERE board_id=OLD.board_id AND id=json_extract(NEW.data,'$.receipt.move.categoryId'))
 THEN RAISE(ABORT,'invalid_note_move') END;
END;
CREATE TRIGGER guided_note_move_apply AFTER UPDATE OF data ON guided_sessions
WHEN json_extract(NEW.data,'$.receipt.kind')='move-note'
 AND json_extract(NEW.data,'$.receipt.id') IS NOT json_extract(OLD.data,'$.receipt.id')
BEGIN
 UPDATE cards SET category_id=json_extract(NEW.data,'$.receipt.move.categoryId')
 WHERE board_id=NEW.board_id AND id=json_extract(NEW.data,'$.receipt.move.card');
END;
