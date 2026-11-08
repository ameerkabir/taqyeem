import type { Handle } from "remix/component";
import type { BoardStatus } from "../../data/board.ts";
import {
  panelStyle,
  badgeStyle,
  fieldStyle,
  votingRowStyle,
  stageGroupStyle,
  stageButtonStyle,
} from "./organiser-controls.styles.ts";
import { routes } from "../../routes.ts";
import { VotingButton } from "./public/voting-button.tsx";
import type { I18n } from "../../middleware/locale.ts";

interface OrganiserControlsProps {
  i18n: I18n;
  boardId: string;
  status: BoardStatus;
  votingOpen: boolean;
  sectionId: string;
}

const stages: BoardStatus[] = ["collecting", "meeting", "closed"];

export function OrganiserControls(handle: Handle<OrganiserControlsProps>) {
  return () => {
    let { i18n, boardId, status, votingOpen, sectionId } = handle.props;
    let { t } = i18n;

    return (
      <section aria-label={t("organiser.panel")} mix={panelStyle}>
        <p mix={badgeStyle}>{t("organiser.badge")}</p>
        <form method="post" action={routes.boardStatus.href({ boardId })} mix={fieldStyle}>
          <input type="hidden" name="section" value={sectionId} />
          <span id="board-stage-label">{t("organiser.stageLabel")}</span>
          <div
            role="group"
            aria-labelledby="board-stage-label"
            mix={stageGroupStyle}
          >
            {stages.map((stage) => (
              <button
                key={stage}
                type="submit"
                name="status"
                value={stage}
                aria-pressed={status === stage ? "true" : "false"}
                mix={stageButtonStyle}
              >
                {t(`organiser.stage.${stage}`)}
              </button>
            ))}
          </div>
        </form>

        <form
          method="post"
          action={routes.boardVoting.href({ boardId })}
          mix={votingRowStyle}
        >
          <input type="hidden" name="section" value={sectionId} />

          <span>{votingOpen ? t("organiser.votingOpen") : t("organiser.votingClosed")}</span>

          <VotingButton
            locale={i18n.locale}
            votingOpen={votingOpen}
            disabled={status === "closed" && !votingOpen}
          />
        </form>
      </section>
    );
  };
}
