import { clientEntry, on, type Handle } from "remix/component";
import { routes } from "../../../routes.ts";

export const RefreshCards = clientEntry(
  "/app/actions/board/public/refresh-cards.tsx#RefreshCards",
  function RefreshCards(handle: Handle<{ sectionId: string }>) {
    return () => (
      <form
        method="get"
        action={routes.board.href({ boardId: "demo" })}
        mix={on("submit", async (event) => {
          let frame = handle.frames.get("board-cards");

          // Keep ordinary form navigation if the frame isn't mounted.
          if (!frame) {
            return;
          }

          event.preventDefault();
          await frame.reload();
        })}
      >
        <input type="hidden" name="section" value={handle.props.sectionId} />

        <button type="submit">تحديث الملاحظات</button>
      </form>
    );
  },
);
