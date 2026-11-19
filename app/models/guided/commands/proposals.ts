import { isCalendarDate, requireThat, text } from "../validation.ts";
import type { Disposition } from "../types.ts";
import type { CommandContext, CommandHandler } from "./types.ts";

/** The owner (a real member or "") and due date shared by propose and edit. */
function proposalFields({ view, command }: CommandContext) {
  let owner = typeof command.owner === "string" ? command.owner : "";
  requireThat(
    !owner || view.members.some((m) => m.id === owner),
    "invalid",
    400,
  );
  let due = typeof command.due === "string" ? command.due : "";
  requireThat(!due || isCalendarDate(due), "invalid", 400);
  return { owner, due };
}

const actionStages = (stage: string) => stage === "discuss" || stage === "actions";

/** Anyone proposes an action; the facilitator's are agreed straight away. */
export const propose: CommandHandler = {
  facilitatorOnly: false,
  apply(ctx) {
    let { state, command, memberId, facilitator, topic } = ctx;
    requireThat(actionStages(state.stage));
    let { owner, due } = proposalFields(ctx);
    state.proposals.push({
      id: command.id,
      text: text(command.text),
      topic: command.topic ? topic() : "",
      author: memberId,
      owner,
      due,
      disposition: facilitator ? "agreed" : "suggested",
      completed: false,
      updatedAt: new Date().toISOString(),
    });
  },
};

/** The facilitator edits any proposal; an author edits theirs while it is only suggested. */
export const editProposal: CommandHandler = {
  facilitatorOnly: false,
  apply(ctx) {
    let { state, command, memberId, facilitator, topic } = ctx;
    requireThat(actionStages(state.stage));
    let { owner, due } = proposalFields(ctx);
    const proposal = state.proposals.find((p) => p.id === command.proposal);
    requireThat(proposal, "invalid", 400);
    requireThat(
      facilitator ||
        (proposal.author === memberId && proposal.disposition === "suggested"),
      "forbidden",
      403,
    );
    Object.assign(proposal, {
      text: text(command.text),
      owner,
      due,
      topic: command.topic ? topic() : "",
      updatedAt: new Date().toISOString(),
    });
  },
};

/** Agrees, defers or declines a proposal. */
export const disposition: CommandHandler = {
  facilitatorOnly: true,
  apply({ state, command }) {
    requireThat(actionStages(state.stage));
    requireThat(
      ["agreed", "deferred", "declined"].includes(String(command.value)),
      "invalid",
      400,
    );
    let p = state.proposals.find((p) => p.id === command.proposal);
    requireThat(p, "invalid", 400);
    p.disposition = command.value as Disposition;
    p.updatedAt = new Date().toISOString();
  },
};

/** Ticks an agreed action done (or not). Allowed in any stage, even after closing. */
export const complete: CommandHandler = {
  facilitatorOnly: false,
  apply({ state, command, memberId, facilitator }) {
    let p = state.proposals.find((p) => p.id === command.proposal);
    requireThat(p && p.disposition === "agreed", "invalid", 400);
    requireThat(facilitator || p.owner === memberId, "forbidden", 403);
    requireThat(typeof command.value === "boolean", "invalid", 400);
    p.completed = command.value;
    p.updatedAt = new Date().toISOString();
  },
};
