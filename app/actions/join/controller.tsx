import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import { loadBoard } from "../../middleware/board.ts";
import { boardNotFound } from "../board-not-found.tsx";
import type { BoardModels } from "../../models/board-models.ts";
import type { Board, Member } from "../../data/board.ts";
import type { Translator } from "../../i18n/translator.ts";
import { routes } from "../../routes.ts";
import { boardMemberSessionKey } from "../../sessions.ts";
import { JoinPage } from "./page.tsx";
import { parseJoinForm, readJoinValues } from "./schema.ts";

// Anyone with the board link may open the join form and join, whether the board is open or
// closed: closing a board stops contributions, not membership or reading. Everything else about a
// board needs the membership this form creates (see requireBoardMember). Joining makes an
// ordinary participant; there is no read-only role, so reopening the board simply lets them do
// whatever its current state allows.
export default createController(routes.joinBoard, {
  middleware: [loadBoard({ onError: boardNotFound })],
  actions: {
    async index(context) {
      let board = context.board;
      let members = await context.models.listMembers(board.id);
      let section = await validSection(
        context.models,
        board.id,
        context.url.searchParams.get("section"),
      );
      if (await isMember(context.models, board.id, members)) {
        return toBoard(board.id, section);
      }
      let invitation = invitationFor(board, members, context.i18n.t);
      return context.render(
        <JoinPage
          {...invitation}
          i18n={context.i18n}
          boardId={board.id}
          boardTitle={board.title}
          closed={board.status === "closed"}
          section={section}
        />,
      );
    },

    async action(context) {
      let board = context.board;
      let members = await context.models.listMembers(board.id);
      let data = await context.request.formData();
      let section = await validSection(
        context.models,
        board.id,
        data.get("section"),
      );
      let closed = board.status === "closed";

      // A repeated submit (double click, back button) must not create a second member.
      if (await isMember(context.models, board.id, members)) {
        return toBoard(board.id, section);
      }
      let invitation = invitationFor(board, members, context.i18n.t);

      let parsed = parseJoinForm(data, context.i18n.t);
      if (!parsed.success) {
        return context.render(
          <JoinPage
            {...invitation}
            i18n={context.i18n}
            boardId={board.id}
            boardTitle={board.title}
            closed={closed}
            section={section}
            values={readJoinValues(data)}
            nameError={parsed.issues[0].message}
          />,
          { status: 400 },
        );
      }

      let result;
      try {
        result = await context.models.joinBoard(
          board.id,
          parsed.value.displayName,
        );
      } catch (error) {
        console.error("joinBoard failed", error);
        return context.render(
          <JoinPage
            {...invitation}
            i18n={context.i18n}
            boardId={board.id}
            boardTitle={board.title}
            closed={closed}
            section={section}
            values={readJoinValues(data)}
            submitError={context.i18n.t("join.error.saveFailed")}
          />,
          { status: 500 },
        );
      }

      if (!result) {
        return boardNotFound(
          context,
          context.i18n.t("access.boardNotFound"),
          404,
        );
      }
      if (!result.ok) {
        // The only refusal is a taken name. Keep what they typed so they can adjust it.
        return context.render(
          <JoinPage
            {...invitation}
            i18n={context.i18n}
            boardId={board.id}
            boardTitle={board.title}
            closed={closed}
            section={section}
            values={readJoinValues(data)}
            nameError={context.i18n.t("join.error.nameTaken")}
          />,
          { status: 409 },
        );
      }

      // Same as creating a board: a new identity gets a fresh session id.
      context.session.regenerateId(true);
      context.session.set(boardMemberSessionKey(board.id), result.member.id);
      return toBoard(board.id, section);
    },
  },
});

function toBoard(boardId: string, section?: string) {
  let href = routes.board.href({ boardId });
  return redirect(
    section ? `${href}?${new URLSearchParams({ section })}` : href,
    303,
  );
}

/** Only a real category of this board is kept; anything else (forged, stale, empty) is dropped. */
async function validSection(
  models: BoardModels,
  boardId: string,
  value: unknown,
) {
  if (typeof value !== "string" || value === "") {
    return undefined;
  }
  let categories = await models.listCategories(boardId);
  return categories.some((category) => category.id === value)
    ? value
    : undefined;
}

/** What the join form says about the board: who runs it, how many joined, where it is. */
export function invitationFor(
  board: Board,
  members: readonly Member[],
  t: Translator["t"],
) {
  return {
    facilitatorName: members.find((m) => m.id === board.organiserMemberId)
      ?.displayName,
    joinedCount: members.length,
    stage: board.guidedStage
      ? t(`guided.${board.guidedStage}` as "guided.collect")
      : t(`board.status.${board.status}`),
  };
}

async function isMember(
  models: BoardModels,
  boardId: string,
  members: readonly Member[],
) {
  let memberId = await models.getViewerMemberId(boardId);
  if (!memberId) {
    return false;
  }
  return members.some(
    (member) => member.id === memberId && member.boardId === boardId,
  );
}
