import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import type { Database } from "remix/data-table";
import { createDatabaseSessionStorage } from "./session-storage.ts";

export function boardMemberSessionKey(boardId: string) {
  return `board-member:${boardId}`;
}

export function loadSession(secret: string | string[], db: Database) {
  const secrets = Array.isArray(secret) ? secret : [secret];
  if (!secrets.length || secrets.some((value) => !value)) {
    throw new Error("SESSION_SECRET is required");
  }

  let cookie = createCookie("taqyeem_session", {
    secrets,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return session(cookie, createDatabaseSessionStorage(db));
}
