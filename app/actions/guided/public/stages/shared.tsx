import { routes } from "../../../../routes.ts";
import type { WorkspaceView } from "./types.ts";

/** The command error with a Join link when the viewer is no longer a member. */
export function errorAlert(v: WorkspaceView) {
  if (!v.error) {
    return null;
  }
  return (
    <p role="alert" class="error">
      {v.error}
      {v.needsJoin && (
        <a href={routes.joinBoard.index.href({ boardId: v.data.board.id })}>
          {v.t("join.submit")}
        </a>
      )}
    </p>
  );
}

/** Keeps a review view (`?step=`) when a native view form is submitted. */
export function reviewStepField(v: WorkspaceView) {
  return v.readOnly && !v.record ? (
    <input type="hidden" name="step" value={v.state.stage} />
  ) : null;
}

/** Notes in the order a topic lists them, skipping any no longer on the board. */
export function topicCards(v: WorkspaceView, ids: string[]) {
  return ids
    .map((id) => v.data.cards.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);
}
