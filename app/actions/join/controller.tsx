import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import { loadBoard } from "../../middleware/board.ts";
import { boardNotFound } from "../board-not-found.tsx";
import type { BoardModels } from "../../models/board-models.ts";
import { routes } from "../../routes.ts";
import { boardMemberSessionKey } from "../../sessions.ts";
import { JoinPage } from "./page.tsx";
import { parseJoinForm, readJoinValues } from "./schema.ts";

// Anyone with the board link may open the join form. Everything else about a board needs
// the membership this form creates (see requireBoardMember).
export default createController(routes.joinBoard, {
  middleware: [loadBoard({ onError: boardNotFound })],
  actions: {
    async index(context) {
      let board = context.board;
      if (await isMember(context.models, board.id)) return toBoard(board.id);
      return context.render(
        <JoinPage
          i18n={context.i18n}
          boardId={board.id}
          boardTitle={board.title}
          closed={board.status === "closed"}
        />,
        { status: board.status === "closed" ? 403 : 200 },
      );
    },

    async action(context) {
      let board = context.board;
      // A repeated submit (double click, back button) must not create a second member.
      if (await isMember(context.models, board.id)) return toBoard(board.id);

      let data = await context.request.formData();
      let parsed = parseJoinForm(data, context.i18n.t);
      if (!parsed.success) {
        return context.render(
          <JoinPage
            i18n={context.i18n}
            boardId={board.id}
            boardTitle={board.title}
            values={readJoinValues(data)}
            nameError={parsed.issues[0].message}
          />,
          { status: 400 },
        );
      }

      let result;
      try {
        result = await context.models.joinBoard(board.id, parsed.value.displayName);
      } catch (error) {
        console.error("joinBoard failed", error);
        return context.render(
          <JoinPage
            i18n={context.i18n}
            boardId={board.id}
            boardTitle={board.title}
            values={readJoinValues(data)}
            submitError={context.i18n.t("join.error.saveFailed")}
          />,
          { status: 500 },
        );
      }

      if (!result) {
        return boardNotFound(context, context.i18n.t("access.boardNotFound"), 404);
      }
      if (!result.ok && result.reason === "name_taken") {
        // Keep what they typed so they can add an initial or a last name.
        return context.render(
          <JoinPage
            i18n={context.i18n}
            boardId={board.id}
            boardTitle={board.title}
            values={readJoinValues(data)}
            nameError={context.i18n.t("join.error.nameTaken")}
          />,
          { status: 409 },
        );
      }
      if (!result.ok) {
        return context.render(
          <JoinPage i18n={context.i18n} boardId={board.id} boardTitle={board.title} closed />,
          { status: 403 },
        );
      }

      // Same as creating a board: a new identity gets a fresh session id.
      context.session.regenerateId(true);
      context.session.set(boardMemberSessionKey(board.id), result.member.id);
      return toBoard(board.id);
    },
  },
});

function toBoard(boardId: string) {
  return redirect(routes.board.href({ boardId }), 303);
}

async function isMember(models: BoardModels, boardId: string) {
  let memberId = await models.getViewerMemberId(boardId);
  if (!memberId) return false;
  let members = await models.listMembers(boardId);
  return members.some((member) => member.id === memberId && member.boardId === boardId);
}
