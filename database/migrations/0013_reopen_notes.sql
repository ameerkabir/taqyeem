-- The facilitator may reopen note-taking in Group or Discuss ($.notesOpen).
-- Only inserts are reopened; editing, deleting and moving stay Collect-only.
DROP TRIGGER guided_card_insert;
CREATE TRIGGER guided_card_insert BEFORE INSERT ON cards
WHEN EXISTS (SELECT 1 FROM guided_sessions WHERE board_id=NEW.board_id
 AND json_extract(data,'$.stage') <> 'collect'
 AND NOT (json_extract(data,'$.stage') IN ('group','discuss') AND json_extract(data,'$.notesOpen') = 1))
BEGIN SELECT RAISE(ABORT, 'collect_only'); END;
