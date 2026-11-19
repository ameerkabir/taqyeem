import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createTranslator } from "../../../i18n/translator.ts";
import type { Card } from "../../../data/board.ts";
import { formatDate } from "../../../i18n/format-date.ts";
import { buildSummaryText } from "./summary-text.ts";

const t = createTranslator("en").t;
const card = (id: string, overrides: Partial<Card> = {}): Card => ({
  id,
  boardId: "b",
  memberId: "m2",
  categoryId: "c1",
  body: `Note ${id}`,
  isAnonymous: false,
  createdAt: "2026-11-01T00:00:00.000Z",
  voteCount: 0,
  ...overrides,
});
const base = {
  boardTitle: "Sprint 9",
  categories: [{ id: "c1", boardId: "b", label: "Went well", position: 0 }],
  members: [
    { id: "m1", boardId: "b", displayName: "Sam" },
    { id: "m2", boardId: "b", displayName: "Lee" },
  ],
  t,
  locale: "en-GB",
};

describe("buildSummaryText", () => {
  it("lists a closed meeting's topics, outcomes, decisions, notes and actions", () => {
    let at = "2026-11-17T10:00:00.000Z";
    let text = buildSummaryText({
      ...base,
      closure: {
        at,
        topics: [{ id: "n1", title: "Note n1", notes: ["n1"] }],
        outcomes: { n1: "discussed" },
        decisions: { n1: "Keep pairing" },
        proposals: [
          {
            id: "p1",
            text: "Write a checklist",
            topic: "n1",
            author: "m1",
            owner: "m1",
            due: "2026-12-01",
            disposition: "agreed",
            completed: false,
            updatedAt: at,
          },
        ],
        cards: [card("n1")],
        categories: base.categories,
      },
      closureVersion: 2,
      ranked: [],
      cards: [],
    });
    assert.deepEqual(text.split("\n\n"), [
      "Sprint 9",
      t("guided.history"),
      t("history.version", { version: 2 }),
      t("guided.closedAt", { date: formatDate("en-GB", at, "long-time") }),
      "Note n1",
      t("guided.discussed"),
      "Keep pairing",
      "Note n1",
      "Went well · Lee",
      `Write a checklist — ${t("guided.agreed")} · Sam · ${formatDate("en-GB", "2026-12-01", "due")} · Note n1`,
    ]);
  });

  it("keeps anonymous authors anonymous and marks missing outcomes and owners", () => {
    let text = buildSummaryText({
      ...base,
      closure: null,
      ranked: [{ id: "n1", title: "Note n1", notes: ["n1", "missing"] }],
      cards: [card("n1", { isAnonymous: true })],
    });
    let lines = text.split("\n\n");
    assert.equal(lines[2], t("guided.legacyHistory"));
    assert.ok(lines.includes(t("guided.unaddressed")));
    assert.ok(lines.includes(t("guided.noDecision")));
    assert.ok(lines.includes(`Went well · ${t("cards.anonymous")}`));
    assert.ok(!text.includes("Lee"));
  });
});
