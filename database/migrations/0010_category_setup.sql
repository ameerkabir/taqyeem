-- Empty collecting boards choose a template before their first contribution.
-- Populated, later-stage and legacy boards retain their categories and authority.
UPDATE guided_sessions SET data=json_set(data,'$.categorySetup',json('{"confirmed":false,"categories":[]}')),revision=revision+1
WHERE json_extract(data,'$.stage')='collect' AND NOT EXISTS(SELECT 1 FROM cards WHERE cards.board_id=guided_sessions.board_id);
CREATE TRIGGER category_setup_note_guard BEFORE INSERT ON cards
WHEN EXISTS(SELECT 1 FROM guided_sessions WHERE board_id=NEW.board_id AND json_extract(data,'$.categorySetup.confirmed')=0)
BEGIN SELECT RAISE(ABORT,'category_setup_required'); END;
CREATE TRIGGER category_setup_safety BEFORE UPDATE OF data ON guided_sessions
WHEN json_extract(NEW.data,'$.categorySetup.confirmed')=1 AND json_extract(OLD.data,'$.categorySetup.confirmed')=0
BEGIN
 SELECT CASE WHEN json_extract(OLD.data,'$.stage')<>'collect' OR EXISTS(SELECT 1 FROM cards WHERE board_id=OLD.board_id) THEN RAISE(ABORT,'categories_locked') END;
 SELECT CASE WHEN json_array_length(NEW.data,'$.categorySetup.categories') NOT BETWEEN 1 AND 8 THEN RAISE(ABORT,'invalid_categories') END;
END;
CREATE TRIGGER category_setup_apply AFTER UPDATE OF data ON guided_sessions
WHEN json_extract(NEW.data,'$.categorySetup.confirmed')=1 AND json_extract(OLD.data,'$.categorySetup.confirmed')=0
BEGIN
 DELETE FROM categories WHERE board_id=NEW.board_id;
 INSERT INTO categories(id,board_id,label,position,tone)
 SELECT json_extract(value,'$.id'),NEW.board_id,json_extract(value,'$.label'),CAST(key AS INTEGER),json_extract(value,'$.tone') FROM json_each(NEW.data,'$.categorySetup.categories');
END;
