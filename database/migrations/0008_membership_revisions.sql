-- Membership changes are shared session changes, never an online-presence signal.
CREATE TRIGGER guided_member_join AFTER INSERT ON members
BEGIN UPDATE guided_sessions SET revision=revision+1 WHERE board_id=NEW.board_id; END;
CREATE TRIGGER guided_member_change AFTER UPDATE ON members
BEGIN UPDATE guided_sessions SET revision=revision+1 WHERE board_id=NEW.board_id; END;
CREATE TRIGGER guided_member_leave AFTER DELETE ON members
BEGIN UPDATE guided_sessions SET revision=revision+1 WHERE board_id=OLD.board_id; END;
