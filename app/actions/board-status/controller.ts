import { createAction } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { requireBoardMember } from "../../middleware/board-member.ts";
import { requireBoardOrganiser } from "../../middleware/board-organiser.ts";
import { resolveActiveSection } from "../../models/section.ts";
import { cardAccessError } from "../card-access.tsx";

export default createAction(routes.boardStatus, {
  middleware: [
    loadBoard({ onError: cardAccessError }),
    requireBoardMember({ onError: cardAccessError }),
    requireBoardOrganiser({ onError: cardAccessError }),
  ],

  async handler(context) {
    let { board, models } = context;
    let form = await context.request.formData();
    let values = form.getAll("status");
    let status = values[0];

    if (
      values.length !== 1 ||
      (status !== "collecting" && status !== "meeting" && status !== "closed")
    ) {
      return cardAccessError(context, context.i18n.t("access.invalidStage"), 400);
    }

    let updated = await models.setBoardStatus(board.id, status);
    if (!updated) {
      return cardAccessError(context, context.i18n.t("access.boardNotFound"), 404);
    }

    let categories = await models.listCategories(board.id);
    let requestedSection = form.get("section");
    let section = resolveActiveSection(
      typeof requestedSection === "string" ? requestedSection : null,
      categories,
      updated,
    );

    let location = routes.board.href({ boardId: board.id });
    if (section) {
      location += `?section=${encodeURIComponent(section)}`;
    }

    return redirect(location, 303);
  },
});
