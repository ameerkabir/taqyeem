import { createSession, type SessionStorage } from "remix/session";
import { sql, type Database } from "remix/data-table";

/** Opaque signed-cookie id; durable data never travels in the browser. */
export function createDatabaseSessionStorage(db: Database): SessionStorage {
  return {
    async read(id) {
      if (!id) {
        return createSession();
      }
      let row = (
        await db.exec(
          sql`SELECT data FROM browser_sessions WHERE id=${id} AND expires_at > unixepoch()`,
        )
      ).rows?.[0];
      return row
        ? createSession(id, JSON.parse(String(row.data)))
        : createSession();
    },
    async save(session) {
      if (session.destroyed) {
        if (session.deleteId) {
          await db.exec(
            sql`DELETE FROM browser_sessions WHERE id=${session.deleteId}`,
          );
        }

        await db.exec(sql`DELETE FROM browser_sessions WHERE id=${session.id}`);
        return "";
      }
      if (!session.dirty) {
        return null;
      }
      await db.exec(sql`INSERT INTO browser_sessions(id,data,expires_at) VALUES (${session.id},${JSON.stringify(session.data)},unixepoch()+2592000)
    ON CONFLICT(id) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at`);
      // Persist the successor before retiring its predecessor; a failed write must not erase an existing identity.
      if (session.deleteId) {
        await db.exec(
          sql`DELETE FROM browser_sessions WHERE id=${session.deleteId}`,
        );
      }
      // Expiry is enforced on reads; bound cleanup to a small batch per changed session.
      try {
        await db.exec(
          sql`DELETE FROM browser_sessions WHERE id IN (SELECT id FROM browser_sessions WHERE expires_at <= unixepoch() LIMIT 100)`,
        );
      } catch {
        console.error("Expired session cleanup failed");
      }
      return session.id;
    },
  };
}
