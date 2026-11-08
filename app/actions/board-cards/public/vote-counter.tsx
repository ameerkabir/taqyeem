import { clientEntry, on, type Handle } from "remix/component";
import type { Card } from "../../../data/board.ts";
import { routes } from "../../../routes.ts";
import { errorStyle } from "../../../ui/public/card-form-styles.ts";
import { votePillStyle } from "../styles.ts";
import { createVoteModel } from "./vote-model.ts";
import type { Locale } from "../../../i18n/locales.ts";
import { createTranslator } from "../../../i18n/translator.ts";

interface VoteCounterProps {
  locale: Locale;
  card: Card;
  voted: boolean;
  disabled: boolean;
}

export const VoteCounter = clientEntry(
  "/app/actions/board-cards/public/vote-counter.tsx#VoteCounter",
  function VoteCounter(handle: Handle<VoteCounterProps>) {
    let model = createVoteModel(undefined, createTranslator(handle.props.locale).t);
    let pending = false;
    // Keep a message key, not text, so the message follows the current locale prop.
    let error: "vote.refreshFailed" | "vote.confirmFailed" | undefined;

    return () => {
      let { locale, card, voted, disabled } = handle.props;
      let { t, formatNumber } = createTranslator(locale);
      let displayed = model.read({ voted, count: card.voteCount });
      return (
        <form
          method="post"
          action={routes.vote.href({ boardId: card.boardId, cardId: card.id })}
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
                error = "vote.refreshFailed";
              }
            } catch {
              if (!handle.signal.aborted) {
                error = "vote.confirmFailed";
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
            aria-label={t("vote.count", { count: displayed.count })}
            disabled={disabled || pending}
          >
            <span aria-hidden="true">👍</span> {formatNumber(displayed.count)}
          </button>
          {error && <p role="alert" mix={errorStyle}>{t(error)}</p>}
        </form>
      );
    };
  },
);
