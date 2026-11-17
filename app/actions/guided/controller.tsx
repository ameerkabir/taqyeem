import { DataTableDatabaseError } from "remix/data-table";
import { createAction } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { loadBoard } from "../../middleware/board.ts";
import { requireBoardMember } from "../../middleware/board-member.ts";
import { boardNotFound } from "../board-not-found.tsx";
import {
  readSession,
  createSession,
  commandSession,
  CommandError,
  type Command,
  type SessionView,
} from "../../models/guided/session.ts";
import { resolveOwner } from "../../models/guided/owner.ts";
import { viewerPayload } from "./payload.ts";
import { CommandRetryPage } from "./retry-page.tsx";

const middleware = [
  loadBoard({ onError: boardNotFound }),
  requireBoardMember({ redirectToJoin: true }),
] as const;
export const stateController = createAction(routes.sessionState, {
  middleware,
  async handler(context) {
    // loadBoard already read the guided stage and revision; an unchanged poll costs nothing more.
    let { guidedRevision } = context.board;
    if (guidedRevision === undefined)
      return new Response(null, { status: 404 });
    let tag = `"guided:${context.board.id}:${context.member.id}:${guidedRevision}"`;
    if (context.request.headers.get("If-None-Match") === tag)
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
      "card",
      "fromCategory",
      "categoryId",
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
    let view: SessionView | null;
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
          "card",
          "fromCategory",
          "categoryId",
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
      if (form.has("ownerSearch"))
        command.owner = await resolveOwner(
          context.models,
          context.board.id,
          form.get("ownerSearch"),
        );
      if (command.kind === "convert") {
        if (context.board.organiserMemberId !== context.member.id)
          throw new CommandError("forbidden", 403);
        if (context.board.guidedStage) throw new CommandError("conflict");
        // The insert is the arbiter: a competing conversion that won first is a conflict.
        let started = await createSession(context.db, context.board.id, {
          legacy: true,
        });
        if (!started?.created) throw new CommandError("conflict");
        view = started.view;
      } else {
        if (!context.board.guidedStage) throw new CommandError("invalid", 400);
        view = await commandSession(
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
      // The retry form only needs the current revision, not the whole session.
      let current =
        error.code === "storage"
          ? null
          : await context.models.getGuidedStatus(context.board.id);
      return context.render(
        <CommandRetryPage
          i18n={context.i18n}
          boardId={context.board.id}
          action={context.request.url}
          form={form}
          message={message}
          revision={current?.revision ?? command.revision}
        />,
        { status: error.status },
      );
    }
    if (context.request.headers.get("Accept")?.includes("application/json")) {
      // commandSession returns the committed view; reading it again would only repeat work.
      return Response.json(viewerPayload(view!, context.member.id), {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    const destination = routes.board.href({ boardId: context.board.id });
    return redirect(
      command.kind === "move-note"
        ? `${destination}?category=${encodeURIComponent(String(command.categoryId))}`
        : destination,
      303,
    );
  },
});
