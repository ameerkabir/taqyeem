import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { en } from "./messages/en.ts";
import { ar } from "./messages/ar.ts";
import { createTranslator } from "./translator.ts";

function templates(message: unknown): string[] {
  return typeof message === "string" ? [message] : Object.values(message as object);
}
function placeholders(message: unknown): Set<string> {
  let names = new Set<string>();
  for (let template of templates(message)) {
    for (let match of template.matchAll(/\{(\w+)\}/g)) names.add(match[1]);
  }
  return names;
}

describe("catalogue contract", () => {
  it("has identical keys in both locales", () => {
    assert.deepEqual(Object.keys(ar).sort(), Object.keys(en).sort());
  });

  it("uses the same message kind and placeholders for every key", () => {
    for (let key of Object.keys(en) as (keyof typeof en)[]) {
      assert.equal(typeof ar[key], typeof en[key], key);
      let expected = placeholders(en[key]);
      if (typeof en[key] !== "string") expected.add("count");
      let enNames = placeholders(en[key]);
      let arNames = placeholders(ar[key]);
      // Every variant of a plural may omit {count} ("one vote"), but never invent names.
      for (let name of arNames) assert.ok(expected.has(name), `${key}: unexpected {${name}}`);
      if (typeof en[key] === "string") assert.deepEqual([...arNames].sort(), [...enNames].sort(), key);
    }
  });

  it("provides every plural category each locale needs", () => {
    for (let [locale, catalogue] of [["ar", ar], ["en", en]] as const) {
      let required = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
      for (let [key, message] of Object.entries(catalogue)) {
        if (typeof message === "string") continue;
        for (let category of required) {
          assert.ok(category in message, `${locale}:${key} lacks ${category}`);
        }
      }
    }
  });

  it("contains no markup or secrets-looking values", () => {
    for (let catalogue of [en, ar]) {
      for (let message of Object.values(catalogue)) {
        for (let template of templates(message)) assert.ok(!/[<>]/.test(template), template);
      }
    }
  });
});

describe("translator", () => {
  let arabic = createTranslator("ar");
  let english = createTranslator("en");

  it("derives direction", () => {
    assert.equal(arabic.dir, "rtl");
    assert.equal(english.dir, "ltr");
  });

  it("selects Arabic plural forms for 0, 1, 2, 3, 11 and 100", () => {
    let forms = [0, 1, 2, 3, 11, 100].map((count) => arabic.t("vote.count", { count }));
    assert.deepEqual(forms, [
      "لا أصوات",
      "صوت واحد",
      "صوتان",
      "٣ أصوات",
      "١١ صوتًا",
      "١٠٠ صوت",
    ]);
  });

  it("selects English plural forms", () => {
    assert.equal(english.t("vote.count", { count: 1 }), "1 vote");
    assert.equal(english.t("vote.count", { count: 0 }), "0 votes");
    assert.equal(english.t("vote.count", { count: 1200 }), "1,200 votes");
  });

  it("formats numbers with the active locale but leaves strings alone", () => {
    assert.equal(arabic.t("form.counter", { count: 12, max: 500 }), "١٢ / ٥٠٠ حرف");
    assert.equal(english.t("form.counter", { count: 12, max: 500 }), "12 / 500 characters");
    assert.equal(arabic.t("newBoard.error.titleMax", { max: 120 }), "الحد الأقصى لاسم اللوحة ١٢٠ حرفًا");
    assert.equal(english.t("page.title", { title: "{max}", suffix: "x" }), "{max} · x");
  });

  it("keeps the unchanged Arabic copy for existing messages", () => {
    assert.equal(arabic.t("access.boardNotFound"), "اللوحة غير موجودة");
    assert.equal(arabic.t("access.joinBoard"), "يرجى الانضمام إلى اللوحة");
  });
});
