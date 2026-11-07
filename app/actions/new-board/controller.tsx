import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { boardMemberSessionKey } from "../../sessions.ts";
import { NewBoardPage } from "./page.tsx";
import { parseNewBoardForm, readNewBoardValues } from "./schema.ts";
import { defaultCategoryLabels } from "../../data/board-defaults.ts";

export default createController(routes.newBoard, {
  actions: {
    index(context) {
      return context.render(<NewBoardPage i18n={context.i18n} />);
    },

    async action(context) {
      let data = await context.request.formData();
      let parsed = parseNewBoardForm(data, context.i18n.t);

      if (!parsed.success) {
        let issue = parsed.issues[0];
        return context.render(
          <NewBoardPage
            i18n={context.i18n}
            values={readNewBoardValues(data)}
            titleError={issue.path?.[0] === "title" ? issue.message : undefined}
            organiserNameError={
              issue.path?.[0] === "organiserDisplayName" ? issue.message : undefined
            }
          />,
          { status: 400 },
        );
      }

      let { board, organiser } = await context.models.createBoard({
        ...parsed.value,
        categoryLabels: defaultCategoryLabels(context.i18n.t),
      });

      context.session.regenerateId(true);
      context.session.set(boardMemberSessionKey(board.id), organiser.id);

      return redirect(routes.board.href({ boardId: board.id }), 303);
    },
  },
});
