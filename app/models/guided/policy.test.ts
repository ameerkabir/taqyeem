import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { board } from "../../test/fake-board.ts";
import {
  canChangeCardCategory,
  guidedContributionsClosed,
  guidedNotesClosed,
  isGuided,
  withGuidedStatus,
} from "./policy.ts";
import type { Stage } from "./stages.ts";

const guided = (stage: Stage, categorySetupRequired = false, notesOpen = false) =>
  withGuidedStatus(
    { ...board, status: "collecting", votingOpen: true },
    { stage, revision: 7, categorySetupRequired, notesOpen },
  );

describe("guided board policy", () => {
  it("leaves legacy boards exactly as stored", () => {
    let legacy = { ...board, votingOpen: true };
    assert.equal(withGuidedStatus(legacy, null), legacy);
    assert.equal(isGuided(legacy), false);
    assert.equal(guidedContributionsClosed(legacy), false);
    assert.equal(canChangeCardCategory(legacy, "anyone"), true);
  });

  it("projects each guided stage onto the legacy status and never opens legacy voting", () => {
    assert.equal(guided("collect").status, "collecting");
    for (let stage of ["group", "vote", "discuss", "actions"] as const) {
      assert.equal(guided(stage).status, "meeting", stage);
    }
    assert.equal(guided("summary").status, "closed");
    assert.equal(guided("vote").votingOpen, false);
    assert.equal(guided("discuss").guidedRevision, 7);
    assert.equal(guided("collect", true).categorySetupRequired, true);
  });

  it("allows note changes only while collecting", () => {
    assert.equal(guidedContributionsClosed(guided("collect")), false);
    for (let stage of ["group", "vote", "discuss", "actions", "summary"] as const) {
      assert.equal(guidedContributionsClosed(guided(stage)), true, stage);
    }
  });

  it("accepts new notes after Collect only where the facilitator reopened them", () => {
    assert.equal(guidedNotesClosed({ ...board }), false);
    assert.equal(guidedNotesClosed(guided("collect")), false);
    for (let stage of ["group", "discuss"] as const) {
      assert.equal(guidedNotesClosed(guided(stage)), true, stage);
      assert.equal(guidedNotesClosed(guided(stage, false, true)), false, stage);
      // Reopening adds notes; editing and deleting stay Collect-only.
      assert.equal(guidedContributionsClosed(guided(stage, false, true)), true, stage);
    }
    for (let stage of ["vote", "actions", "summary"] as const) {
      assert.equal(guidedNotesClosed(guided(stage, false, true)), true, stage);
    }
  });

  it("lets only the organiser move notes between categories on guided boards", () => {
    let b = guided("collect");
    assert.equal(isGuided(b), true);
    assert.equal(canChangeCardCategory(b, b.organiserMemberId), true);
    assert.equal(canChangeCardCategory(b, "participant"), false);
  });
});
