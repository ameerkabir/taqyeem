import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { board } from "../../test/fake-board.ts";
import {
  canChangeCardCategory,
  guidedContributionsClosed,
  isGuided,
  withGuidedStatus,
} from "./policy.ts";
import type { Stage } from "./stages.ts";

const guided = (stage: Stage, categorySetupRequired = false) =>
  withGuidedStatus(
    { ...board, status: "collecting", votingOpen: true },
    { stage, revision: 7, categorySetupRequired },
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
    for (let stage of ["group", "vote", "discuss", "actions"] as const)
      assert.equal(guided(stage).status, "meeting", stage);
    assert.equal(guided("summary").status, "closed");
    assert.equal(guided("vote").votingOpen, false);
    assert.equal(guided("discuss").guidedRevision, 7);
    assert.equal(guided("collect", true).categorySetupRequired, true);
  });

  it("allows note changes only while collecting", () => {
    assert.equal(guidedContributionsClosed(guided("collect")), false);
    for (let stage of ["group", "vote", "discuss", "actions", "summary"] as const)
      assert.equal(guidedContributionsClosed(guided(stage)), true, stage);
  });

  it("lets only the organiser move notes between categories on guided boards", () => {
    let b = guided("collect");
    assert.equal(isGuided(b), true);
    assert.equal(canChangeCardCategory(b, b.organiserMemberId), true);
    assert.equal(canChangeCardCategory(b, "participant"), false);
  });
});
