import { DataTableDatabaseError, sql } from "remix/data-table";
import { createAction } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { requireBoardMember } from "../../middleware/board-member.ts";
import { boardNotFound } from "../board-not-found.tsx";
import {
  readSession,
  commandSession,
  hasGuidedSession,
  CommandError,
  type Command,
} from "../../models/guided/session.ts";
import { viewerPayload } from "./payload.ts";
import { CommandRetryPage } from "./retry-page.tsx";

const middleware = [
  loadBoard({ onError: boardNotFound }),
  requireBoardMember({ redirectToJoin: true }),
] as const;
export const stateController = createAction(routes.sessionState, {
  middleware,
  async handler(context) {
    if (!(await hasGuidedSession(context.db, context.board.id)))
      return new Response(null, { status: 404 });
    let row = (
      await context.db.exec(
        sql`SELECT revision FROM guided_sessions WHERE board_id=${context.board.id}`,
      )
    ).rows?.[0];
    let tag = `"guided:${context.board.id}:${context.member.id}:${row?.revision}"`;
    if (row && context.request.headers.get("If-None-Match") === tag)
      return new Response(null, {
        status: 304,
        headers: { "Cache-Control": "private, no-store", ETag: tag },
      });
    let view = await readSession(context.db, context.board.id);
    if (!view) return new Response(null, { status: 404 });
    return Response.json(viewerPayload(view, context.member.id), {
      headers: {
        "Cache-Control": "private, no-store",
        ETag: `"guided:${view.board.id}:${context.member.id}:${view.revision}"`,
      },
    });
  },
});
export const commandController = createAction(routes.sessionCommand, {
  middleware,
  async handler(context) {
    let form = await context.request.formData();
    let command: Command = {
      id: String(form.get("id") ?? ""),
      revision: Number(form.get("revision")),
      kind: String(form.get("kind") ?? ""),
    };
    for (let key of [
      "choice",
      "topic",
      "theme",
      "title",
      "text",
      "owner",
      "due",
      "proposal",
    ])
      if (form.has(key)) command[key] = form.get(key);
    if (form.has("labels"))
      command.labels = String(form.get("labels"))
        .split(/\r?\n/)
        .map((label) => label.trim())
        .filter(Boolean);
    if (form.has("notes")) command.notes = form.getAll("notes");
    if (form.has("ballot")) command.ballot = Number(form.get("ballot"));
    if (form.has("version")) command.version = Number(form.get("version"));
    if (form.has("value")) {
      let v = form.get("value");
      command.value =
        v === "true"
          ? true
          : v === "false"
            ? false
            : command.kind === "budget"
              ? Number(v)
              : v;
    }
    try {
      if (command.kind !== "convert") {
        for (let key of [
          "id",
          "revision",
          "kind",
          "topic",
          "theme",
          "title",
          "text",
          "owner",
          "ownerSearch",
          "choice",
          "labels",
          "due",
          "proposal",
          "ballot",
          "version",
          "value",
        ]) {
          if (form.getAll(key).length > 1)
            throw new CommandError("invalid", 400);
        }
        if (
          !form.has("revision") ||
          !/^\d+$/.test(String(form.get("revision")))
        )
          throw new CommandError("invalid", 400);
      }
      if (form.has("ownerSearch")) {
        let name = String(form.get("ownerSearch") ?? "").trim();
        let members = await context.models.listMembers(context.board.id);
        let owner = members.find((m) => m.displayName === name);
        if (name && !owner) throw new CommandError("invalid", 400);
        command.owner = owner?.id ?? "";
      }
      if (command.kind === "convert") {
        if (context.board.organiserMemberId !== context.member.id)
          throw new CommandError("forbidden", 403);
        if (await hasGuidedSession(context.db, context.board.id))
          throw new CommandError("conflict");
        await readSession(context.db, context.board.id, true);
      } else {
        if (!(await hasGuidedSession(context.db, context.board.id)))
          throw new CommandError("invalid", 400);
        await commandSession(
          context.db,
          context.board.id,
          context.member.id,
          command,
        );
      }
    } catch (error) {
      if (error instanceof DataTableDatabaseError)
        error = new CommandError("storage", 503);
      if (!(error instanceof CommandError)) throw error;
      let message = context.i18n.t(`guided.error.${error.code}`);
      if (context.request.headers.get("Accept")?.includes("application/json"))
        return Response.json(
          { error: message, code: error.code },
          { status: error.status },
        );
      let view =
        error.code === "storage"
          ? null
          : (await hasGuidedSession(context.db, context.board.id))
            ? await readSession(context.db, context.board.id)
            : null;
      return context.render(
        <CommandRetryPage
          i18n={context.i18n}
          boardId={context.board.id}
          action={context.request.url}
          form={form}
          message={message}
          revision={view?.revision ?? command.revision}
        />,
        { status: error.status },
      );
    }
    if (context.request.headers.get("Accept")?.includes("application/json")) {
      let view = await readSession(context.db, context.board.id);
      return Response.json(viewerPayload(view!, context.member.id), {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    return redirect(routes.board.href({ boardId: context.board.id }), 303);
  },
});
