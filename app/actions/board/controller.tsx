import {
  hasGuidedSession,
  readSession,
  readMeetingRecord,
} from "../../models/guided/session.ts";
import { reviewStage } from "../../models/guided/stages.ts";
import { viewerPayload, redactMeetingRecord } from "../guided/payload.ts";
import { redirect } from "remix/response/redirect";
import { Workspace } from "../guided/public/workspace.tsx";
import { Document } from "../document.tsx";
import { createAction } from "remix/router";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { boardNotFound } from "../board-not-found.tsx";
import { requireBoardMember } from "../../middleware/board-member.ts";
import { resolveActiveSection } from "../../models/boards/section.ts";
import { BoardPage } from "./page.tsx";

export default createAction(routes.board, {
  // Only members see a board; everyone else is sent to the join form.
  middleware: [
    loadBoard({ onError: boardNotFound }),
    requireBoardMember({ redirectToJoin: true }),
  ],
  async handler(context) {
    let { board, member } = context;

    if (await hasGuidedSession(context.db, board.id)) {
      let view = await readSession(context.db, board.id);
      const recordParam = context.url.searchParams.get("record");
      const record =
        recordParam === null
          ? null
          : await readMeetingRecord(
              context.db,
              board.id,
              /^[1-9]\d*$/.test(recordParam) ? Number(recordParam) : NaN,
            );
      if (recordParam !== null && !record)
        return new Response(context.i18n.t("history.notFound"), {
          status: 404,
        });
      const step = context.url.searchParams.get("step") ?? "";
      if (!record && step && reviewStage(view!.state.stage, step) !== step)
        return redirect(routes.board.href({ boardId: board.id }), 303);
      return context.render(
        <Document i18n={context.i18n} title={board.title}>
          <Workspace
            key={`${board.id}:${member.id}`}
            origin={context.url.origin}
            initial={viewerPayload(view!, member.id)}
            locale={context.i18n.locale}
            record={
              record
                ? {
                    ...record,
                    closure: redactMeetingRecord(record.closure, member.id),
                  }
                : null
            }
            initialView={{
              category:
                context.url.searchParams.get("category") ??
                context.url.searchParams.get("section") ??
                "",
              topic: context.url.searchParams.get("topic") ?? "",
              filter: context.url.searchParams.get("filter") ?? "all",
              capture: context.url.searchParams.get("capture") ?? "",
              captureNote: context.url.searchParams.get("captureNote") ?? "",
              decision: context.url.searchParams.get("decision") ?? "",
              step,
            }}
          />
        </Document>,
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    let section = context.url.searchParams.get("section");
    let categories = await context.models.listCategories(board.id);
    let cards = await context.models.listCards(board.id);
    let activeId = resolveActiveSection(section, categories, board);

    let isOrganiser = member.id === board.organiserMemberId;

    return context.render(
      <BoardPage
        i18n={context.i18n}
        activeId={activeId}
        cards={cards}
        categories={categories}
        board={board}
        isOrganiser={isOrganiser}
      />,
    );
  },
});
