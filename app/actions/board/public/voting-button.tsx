import { clientEntry, type Handle } from "remix/component";
import { votingButtonStyle } from "../organiser-controls.styles.ts";

interface VotingButtonProps {
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
      let { votingOpen, disabled } = handle.props;

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
            ? "جارٍ الحفظ…"
            : votingOpen
              ? "إغلاق التصويت"
              : "فتح التصويت"}
        </button>
      );
    };
  },
);
