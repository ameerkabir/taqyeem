import { on } from "remix/component";
import { routes } from "../../../../routes.ts";
import type { WorkspaceView } from "./types.ts";

/**
 * Group and Discuss: the facilitator's switch to reopen note-taking, and Add
 * note while it is open. In Discuss the note joins the topic being read.
 */
export function lateNotes(v: WorkspaceView) {
  let { data, t } = v;
  if (v.readOnly) {
    return null;
  }
  let open = data.state.notesOpen === true;
  let discuss = data.state.stage === "discuss";
  let query = new URLSearchParams({ category: v.category });
  if (discuss && v.active) {
    query.set("attachTopic", v.active.id);
  }
  return (
    <div class="late-notes" data-open={open ? "true" : "false"}>
      {open && (
        <a
          class="add-note"
          href={`${routes.newCard.index.href({ boardId: data.board.id })}?${query}`}
          mix={on("click", (e) => {
            e.preventDefault();
            v.openNote();
          })}
        >
          {discuss ? t("notes.addToTopic") : t("guided.add")}
        </a>
      )}
      {open && !v.canManage && <p>{t("notes.openHint")}</p>}
      {v.canManage &&
        v.command(
          "notes",
          { value: !open },
          open ? t("notes.close") : t("notes.reopen"),
        )}
    </div>
  );
}
