import { CommandRetryPage } from "../guided/retry-page.tsx";
import { DataTableDatabaseError } from "remix/data-table";
import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { requireBoardMember } from "../../middleware/board-member.ts";
import { boardNotFound } from "../board-not-found.tsx";
import {
  hasGuidedSession,
  readSession,
  commandSession,
  topics,
  CommandError,
} from "../../models/guided/session.ts";
import { Document } from "../document.tsx";
import { DraftForm } from "../../ui/public/versioned-form.tsx";
import type { Handle } from "remix/component";
import type { I18n } from "../../middleware/locale.ts";
import type { SessionView, Proposal } from "../../models/guided/session.ts";
function EditActionPage(
  handle: Handle<{
    view: SessionView;
    proposal: Proposal;
    memberId: string;
    i18n: I18n;
    error?: string;
    values?: FormData;
  }>,
) {
  return () => {
    let { view, proposal, i18n, values, error, memberId } = handle.props,
      { t } = i18n;
    const value = (key: string, fallback: string) =>
      String(values?.get(key) ?? fallback);
    return (
      <Document i18n={i18n}>
        <main class="workspace">
          <a href={routes.board.href({ boardId: view.board.id })}>
            {t("common.cancel")}
          </a>
          <h1>{t("cards.edit")}</h1>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <DraftForm
            action={routes.editAction.action.href({
              boardId: view.board.id,
              proposalId: proposal.id,
            })}
            storageKey={`taqyeem-action-edit:${view.board.id}:${memberId}:${proposal.id}:${proposal.updatedAt}`}
          >
            <input
              type="hidden"
              name="id"
              value={value("id", crypto.randomUUID())}
            />
            <input type="hidden" name="revision" value={view.revision} />
            <label>
              {t("guided.actionText")}
              <textarea
                name="text"
                defaultValue={value("text", proposal.text)}
                maxLength={500}
                required
                dir="auto"
              />
            </label>
            <label>
              {t("guided.agenda")}
              <select
                name="topic"
                defaultValue={value("topic", proposal.topic)}
              >
                <option value="">{t("guided.unassigned")}</option>
                {topics(view).map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("guided.owner")}
              <input
                name="ownerSearch"
                list="edit-action-members"
                defaultValue={value(
                  "ownerSearch",
                  view.members.find((m) => m.id === proposal.owner)
                    ?.displayName ?? "",
                )}
                autoComplete="off"
              />
              <datalist id="edit-action-members">
                {view.members.map((member) => (
                  <option key={member.id} value={member.displayName} />
                ))}
              </datalist>
            </label>
            <label>
              {t("guided.due")}
              <input
                type="date"
                name="due"
                defaultValue={value("due", proposal.due)}
              />
            </label>
            <button class="primary">{t("guided.save")}</button>
          </DraftForm>
        </main>
      </Document>
    );
  };
}
export default createController(routes.editAction, {
  middleware: [
    loadBoard({ onError: boardNotFound }),
    requireBoardMember({ redirectToJoin: true }),
  ],
  actions: {
    async index(context) {
      if (!(await hasGuidedSession(context.db, context.board.id)))
        return new Response(null, { status: 404 });
      let view = (await readSession(context.db, context.board.id))!,
        proposal = view.state.proposals.find(
          (p) => p.id === context.params.proposalId,
        );
      if (!proposal) return new Response(null, { status: 404 });
      if (
        !["discuss", "actions"].includes(view.state.stage) ||
        (context.member.id !== view.board.organiserMemberId &&
          !(
            proposal.author === context.member.id &&
            proposal.disposition === "suggested"
          ))
      )
        return new Response(context.i18n.t("guided.error.forbidden"), {
          status: 403,
        });
      return context.render(
        <EditActionPage
          view={view}
          proposal={proposal}
          memberId={context.member.id}
          i18n={context.i18n}
        />,
      );
    },
    async action(context) {
      if (!(await hasGuidedSession(context.db, context.board.id)))
        return new Response(null, { status: 404 });
      let form = await context.request.formData();
      try {
        let name = String(form.get("ownerSearch") ?? "").trim(),
          members = await context.models.listMembers(context.board.id),
          owner = members.find((m) => m.displayName === name);
        if (name && !owner) throw new CommandError("invalid", 400);
        await commandSession(context.db, context.board.id, context.member.id, {
          id: String(form.get("id")),
          revision: Number(form.get("revision")),
          kind: "edit-proposal",
          proposal: context.params.proposalId,
          text: form.get("text"),
          owner: owner?.id ?? "",
          due: form.get("due"),
          topic: form.get("topic"),
        });
      } catch (error) {
        if (error instanceof DataTableDatabaseError)
          error = new CommandError("storage", 503);
        if (!(error instanceof CommandError)) throw error;
        if (error.code === "storage")
          return context.render(
            <CommandRetryPage
              i18n={context.i18n}
              boardId={context.board.id}
              action={context.request.url}
              form={form}
              message={context.i18n.t("guided.error.storage")}
              revision={Number(form.get("revision"))}
            />,
            { status: 503 },
          );
        let view = (await readSession(context.db, context.board.id))!,
          proposal = view.state.proposals.find(
            (p) => p.id === context.params.proposalId,
          );
        if (!proposal) return new Response(null, { status: 404 });
        return context.render(
          <EditActionPage
            view={view}
            proposal={proposal}
            memberId={context.member.id}
            i18n={context.i18n}
            values={form}
            error={context.i18n.t(`guided.error.${error.code}`)}
          />,
          { status: error.status },
        );
      }
      return redirect(routes.board.href({ boardId: context.board.id }), 303);
    },
  },
});
