import type { Handle } from "remix/component";
import type { BoardStatus } from "../../data/fake-board.ts";
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

interface OrganiserControlsProps {
  boardId: string;
  status: BoardStatus;
  votingOpen: boolean;
  sectionId: string;
}

const stages: { value: BoardStatus; label: string }[] = [
  { value: "collecting", label: "جمع الآراء" },
  { value: "meeting", label: "الاجتماع" },
  { value: "closed", label: "مغلق" },
];

export function OrganiserControls(handle: Handle<OrganiserControlsProps>) {
  return () => {
    let { boardId, status, votingOpen, sectionId } = handle.props;

    return (
      <section aria-label="إدارة اللوحة" mix={panelStyle}>
        <p mix={badgeStyle}>أنت المنظم</p>
        <form method="post" action={routes.boardStatus.href({ boardId })} mix={fieldStyle}>
          <input type="hidden" name="section" value={sectionId} />
          <span id="board-stage-label">مرحلة اللوحة</span>
          <div
            role="group"
            aria-labelledby="board-stage-label"
            mix={stageGroupStyle}
          >
            {stages.map((stage) => (
              <button
                key={stage.value}
                type="submit"
                name="status"
                value={stage.value}
                aria-pressed={status === stage.value ? "true" : "false"}
                mix={stageButtonStyle}
              >
                {stage.label}
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

          <span>{votingOpen ? "التصويت مفتوح" : "التصويت مغلق"}</span>

          <VotingButton
            votingOpen={votingOpen}
            disabled={status === "closed" && !votingOpen}
          />
        </form>
      </section>
    );
  };
}
