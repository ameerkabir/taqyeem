import { clientEntry, type Handle } from "remix/component";
import { votingButtonStyle } from "../organiser-controls.styles.ts";
import type { Locale } from "../../../i18n/locales.ts";
import { createTranslator } from "../../../i18n/translator.ts";

interface VotingButtonProps {
  locale: Locale;
  votingOpen: boolean;
  disabled: boolean;
}

export const VotingButton = clientEntry(
  "/app/actions/board/public/voting-button.tsx#VotingButton",
  function VotingButton(handle: Handle<VotingButtonProps>) {
    let pending = false;

    // Register browser listeners after hydration, never during Worker SSR.
    handle.queueTask(() => {
      handle.frame.addEventListener(
        "reloadStart",
        () => {
          pending = true;
          void handle.update();
        },
        { signal: handle.signal },
      );

      handle.frame.addEventListener(
        "reloadComplete",
        () => {
          pending = false;
          void handle.update();
        },
        { signal: handle.signal },
      );
    });

    return () => {
      let { locale, votingOpen, disabled } = handle.props;
      let { t } = createTranslator(locale);

      return (
        <button
          type="submit"
          name="votingOpen"
          value={votingOpen ? "false" : "true"}
          disabled={disabled || pending}
          aria-busy={pending}
          mix={votingButtonStyle}
        >
          {pending
            ? t("organiser.saving")
            : votingOpen
              ? t("organiser.closeVoting")
              : t("organiser.openVoting")}
        </button>
      );
    };
  },
);
