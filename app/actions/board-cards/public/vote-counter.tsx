import { clientEntry, on, type Handle } from "remix/component";
import type { Card } from "../../../data/fake-board.ts";
import { routes } from "../../../routes.ts";
import { errorStyle } from "../../../ui/public/card-form-styles.ts";
import { votePillStyle } from "../styles.ts";
import { createVoteModel } from "./vote-model.ts";

interface VoteCounterProps {
  card: Card;
  voted: boolean;
  disabled: boolean;
}

export const VoteCounter = clientEntry(
  "/app/actions/board-cards/public/vote-counter.tsx#VoteCounter",
  function VoteCounter(handle: Handle<VoteCounterProps>) {
    let model = createVoteModel();
    let pending = false;
    let error: string | undefined;

    return () => {
      let { card, voted, disabled } = handle.props;
      let displayed = model.read({ voted, count: card.voteCount });
      return (
        <form
          method="post"
          action={routes.vote.href({ cardId: card.id })}
          aria-busy={pending}
          mix={on("submit", async (event) => {
            event.preventDefault();
            if (pending) return;
            let form = event.currentTarget;
            // Include the clicked submit button before disabling it.
            let body = new FormData(form, event.submitter);
            pending = true;
            error = undefined;
            handle.update();
            try {
              await model.save({
                action: form.action,
                body,
                previous: displayed,
                signal: handle.signal,
                update: () => handle.update(),
              });
              if (handle.signal.aborted) return;
              try {
                await handle.frame.reload();
                if (!handle.signal.aborted) model.reset();
              } catch {
                // Saving succeeded; retain the confirmed vote if refreshing fails.
                error = "تم حفظ التصويت، لكن تعذّر تحديث القائمة";
              }
            } catch {
              if (!handle.signal.aborted) {
                error = "تعذّر تأكيد التصويت، يرجى التحقق من اتصالك والمحاولة مجددًا";
              }
            } finally {
              if (!handle.signal.aborted) {
                pending = false;
                handle.update();
              }
            }
          })}
        >
          <button
            type="submit"
            name="voted"
            value={displayed.voted ? "false" : "true"}
            mix={votePillStyle}
            aria-pressed={displayed.voted ? "true" : "false"}
            disabled={disabled || pending}
          >
            <span aria-hidden="true">👍</span> {displayed.count}
          </button>
          {error && <p role="alert" mix={errorStyle}>{error}</p>}
        </form>
      );
    };
  },
);
