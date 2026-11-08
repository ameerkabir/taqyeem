import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { negotiateLocale, resolveLocale } from "./resolve.ts";

describe("Accept-Language negotiation", () => {
  let cases: [string, string | null][] = [
    ["en", "en"],
    ["en-GB", "en"],
    ["en-US,en;q=0.9", "en"],
    ["ar-SA", "ar"],
    ["ar", "ar"],
    ["fr-FR,fr;q=0.9,en;q=0.8", "en"],
    ["fr-FR,fr;q=0.9", null],
    ["en;q=0.5, ar;q=0.9", "ar"],
    ["en;q=0.9, ar;q=0.5", "en"],
    ["ar;q=0, en", "en"],
    ["en;q=0, ar;q=0.1", "ar"],
    ["en;q=0, ar;q=0", null],
    ["ar;q=0, *", "en"],
    ["fr, *;q=0.1", "ar"],
    ["*", "ar"],
    ["zh-Hans-CN, en;q=0.2", "en"],
    ["en;q=abc", null],
    ["", null],
    [";;;,,,", null],
    ["xx-YY", null],
  ];
  for (let [header, expected] of cases) {
    it(`${JSON.stringify(header)} -> ${expected}`, () => {
      assert.equal(negotiateLocale(header), expected);
    });
  }

  it("treats a missing header as no preference", () => {
    assert.equal(negotiateLocale(null), null);
    assert.equal(negotiateLocale(undefined), null);
  });
});

describe("locale resolution", () => {
  it("uses a valid explicit cookie over Accept-Language", () => {
    assert.equal(resolveLocale({ cookie: "ar", acceptLanguage: "en-US" }), "ar");
    assert.equal(resolveLocale({ cookie: "en", acceptLanguage: "ar" }), "en");
  });

  it("ignores unsupported or malformed cookie values", () => {
    for (let cookie of ["fr", "EN", "en-GB", "", null, undefined, 1, {}]) {
      assert.equal(resolveLocale({ cookie, acceptLanguage: "en" }), "en");
    }
  });

  it("falls back to Arabic with no usable preference", () => {
    assert.equal(resolveLocale({}), "ar");
    assert.equal(resolveLocale({ acceptLanguage: "fr" }), "ar");
  });
});
