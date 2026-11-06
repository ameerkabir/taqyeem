import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";

const storage = createMemorySessionStorage();

export function boardMemberSessionKey(boardId: string) {
  return `board-member:${boardId}`;
}

export function loadSession(secret: string) {
  if (!secret) throw new Error("SESSION_SECRET is required");

  let cookie = createCookie("taqyeem_session", {
    secrets: [secret],
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return session(cookie, storage);
}
