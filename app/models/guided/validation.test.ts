import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { CommandError } from "./errors.ts";
import {
  isCalendarDate,
  nameKey,
  requireThat,
  text,
  uniqueThemeTitle,
  validateCategoryLabels,
} from "./validation.ts";
import type { SharedSession } from "./types.ts";

function refusal(run: () => unknown): CommandError | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof CommandError) {
      return error;
    }
    throw error;
  }
  return undefined;
}

describe("guided validation", () => {
  it("defaults refusals to a 409 locked", () => {
    let error = refusal(() => requireThat(false));
    assert.equal(error?.code, "locked");
    assert.equal(error?.status, 409);
    assert.equal(refusal(() => requireThat(1)), undefined);
  });

  it("trims text and rejects empty, oversized or non-string values", () => {
    assert.equal(text("  hi  "), "hi");
    assert.equal(refusal(() => text("   "))?.code, "invalid");
    assert.equal(refusal(() => text("abc", 2))?.status, 400);
    assert.equal(refusal(() => text(5))?.code, "invalid");
  });

  it("keys names by meaning, not spacing, case, width or invisible characters", () => {
    assert.equal(nameKey(" Went   well "), "went well");
    assert.equal(nameKey("Ideas​"), nameKey("ideas"));
    assert.equal(nameKey("Ｉｄｅａｓ"), "ideas");
    assert.notEqual(nameKey("أفكار"), nameKey("افكار"));
  });

  it("keeps theme titles unique except for the theme being renamed", () => {
    let state = { themes: [{ id: "t1", title: "Deploys", notes: [] }] } as unknown as SharedSession;
    assert.equal(refusal(() => uniqueThemeTitle(state, " deploys "))?.code, "duplicateTheme");
    assert.equal(uniqueThemeTitle(state, "Deploys!", undefined), "Deploys!");
    assert.equal(uniqueThemeTitle(state, "deploys", "t1"), "deploys");
    assert.equal(refusal(() => uniqueThemeTitle(state, "​"))?.code, "invalid");
  });

  it("accepts 1–8 visible distinct category labels", () => {
    assert.deepEqual(validateCategoryLabels([" A ", "ب"]), ["A", "ب"]);
    for (let labels of [[], Array(9).fill("x").map((x, i) => x + i), ["A", "a"], ["A", "A​"], ["​"], ["a\u0007"], "A"])
      assert.equal(refusal(() => validateCategoryLabels(labels))?.code, "invalid", JSON.stringify(labels));
  });

  it("accepts only real calendar days", () => {
    assert.equal(isCalendarDate("2028-02-29"), true);
    for (let value of ["2026-02-30", "2026-2-1", "tomorrow", "2026-13-01"])
      assert.equal(isCalendarDate(value), false, value);
  });
});
