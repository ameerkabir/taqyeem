-- Command receipts grow independently of the bounded-size session working record.
CREATE TABLE guided_command_receipts (
 board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
 command_id TEXT NOT NULL,
 member_id TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 PRIMARY KEY(board_id,command_id)
);
-- Preserve receipts from pre-release local implementations, if present.
INSERT INTO guided_command_receipts(board_id,command_id,member_id,fingerprint)
 SELECT s.board_id,j.key,substr(j.value,1,36),substr(j.value,38)
 FROM guided_sessions s,json_each(s.data,'$.receipts') j;
UPDATE guided_sessions SET data=json_set(data,'$.receipts',json('{}'));
CREATE TRIGGER guided_command_receipt AFTER UPDATE OF data ON guided_sessions
WHEN json_extract(NEW.data,'$.receipt.id') IS NOT NULL
 AND json_extract(NEW.data,'$.receipt.id') IS NOT json_extract(OLD.data,'$.receipt.id')
BEGIN
 INSERT INTO guided_command_receipts(board_id,command_id,member_id,fingerprint)
 VALUES(NEW.board_id,json_extract(NEW.data,'$.receipt.id'),json_extract(NEW.data,'$.receipt.member'),json_extract(NEW.data,'$.receipt.fingerprint'));
END;
