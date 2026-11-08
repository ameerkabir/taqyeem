import { createAction } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { requireBoardMember } from "../../middleware/board-member.ts";
import { requireBoardOrganiser } from "../../middleware/board-organiser.ts";
import { resolveActiveSection } from "../../models/boards/section.ts";
import { cardAccessError } from "../card-access.tsx";

export default createAction(routes.boardVoting, {
  middleware: [
    loadBoard({ onError: cardAccessError }),
    requireBoardMember({ onError: cardAccessError }),
    requireBoardOrganiser({ onError: cardAccessError }),
  ],

  async handler(context) {
    let { board, models } = context;

    let form = await context.request.formData();
    let values = form.getAll("votingOpen");
    let value = values[0];

    if (values.length !== 1 || (value !== "true" && value !== "false")) {
      return cardAccessError(context, context.i18n.t("access.invalidVotingValue"), 400);
    }

    let votingOpen = value === "true";

    if (board.status === "closed" && votingOpen) {
      return cardAccessError(context, context.i18n.t("access.cannotOpenVotingClosed"), 403);
    }

    let categories = await models.listCategories(board.id);
    let requestedSection = form.get("section");
    let section = resolveActiveSection(
      typeof requestedSection === "string" ? requestedSection : null,
      categories,
      board,
    );

    let updated = await models.setVotingOpen(board.id, votingOpen);

    if (!updated) {
      return cardAccessError(context, context.i18n.t("access.boardNotFound"), 404);
    }

    let location = routes.board.href({ boardId: board.id });

    if (section) {
      location += `?section=${encodeURIComponent(section)}`;
    }

    return redirect(location, 303);
  },
});
