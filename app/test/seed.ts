import type { Database } from "remix/data-table";
import type { createAppRouter } from "../router.ts";
import { boardMemberSessionKey } from "../sessions.ts";
import {
  boards,
  cards as cardsTable,
  categories as categoriesTable,
  members as membersTable,
} from "../data/tables.ts";
import { board, cards, categories, members, viewerMemberId } from "./fake-board.ts";

type AppRouter = ReturnType<typeof createAppRouter>;

export const DEMO_BOARD_ID = board.id;
export const DEMO_VIEWER_MEMBER_ID = viewerMemberId;

/**
 * Writes the demo fixtures (a meeting-stage board, three members, three categories, six
 * cards with no votes) into a database, keeping their fixed ids so tests can refer to them.
 * Rows go in parent-first order because of the foreign keys.
 */
export async function seedDemoBoard(db: Database) {
  await db.create(boards, {
    id: board.id,
    title: board.title,
    status: board.status,
    voting_open: board.votingOpen ? 1 : 0,
  });
  await db.createMany(
    membersTable,
    members.map((member) => ({
      id: member.id,
      board_id: member.boardId,
      display_name: member.displayName,
      role: member.id === board.organiserMemberId ? ("organiser" as const) : ("participant" as const),
    })),
  );
  await db.createMany(
    categoriesTable,
    categories.map((category) => ({
      id: category.id,
      board_id: category.boardId,
      label: category.label,
      position: category.position,
    })),
  );
  await db.createMany(
    cardsTable,
    cards.map((card) => ({
      id: card.id,
      board_id: card.boardId,
      category_id: card.categoryId,
      member_id: card.memberId,
      submission_id: `seed-${card.id}`,
      body: card.body,
      is_anonymous: card.isAnonymous ? 1 : 0,
      created_at: card.createdAt,
    })),
  );
}

/**
 * Signs a browser in as `memberId` on `boardId`, the way the app does after joining or
 * creating a board, and returns the `Cookie` header value to send on later requests.
 */
export async function loginAs(router: AppRouter, boardId: string, memberId: string) {
  router.get("/__test-login", (context) => {
    context.session.set(boardMemberSessionKey(boardId), memberId);
    return new Response("ok");
  });
  let response = await router.fetch("http://localhost/__test-login");
  let cookie = response.headers.get("Set-Cookie");
  if (!cookie) throw new Error("loginAs: the app did not set a session cookie");
  return cookie.split(";")[0];
}
