import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { memberNameKey } from "./name-key.ts";

function same(...names: string[]) {
  let keys = new Set(names.map(memberNameKey));
  assert.equal(keys.size, 1, `expected one key, got ${JSON.stringify([...keys])} for ${JSON.stringify(names)}`);
}
function different(a: string, b: string) {
  assert.notEqual(memberNameKey(a), memberNameKey(b), `${a} and ${b} should stay different`);
}

describe("memberNameKey", () => {
  it("ignores case", () => same("Sam", "sam", "SAM", "sAm"));
  it("ignores surrounding and repeated whitespace", () => {
    same("Sam Lee", "  Sam Lee  ", "Sam   Lee", "Sam\tLee", "Sam\nLee");
  });
  it("folds accented capitals, which SQLite's lower() would not", () => same("Élodie", "élodie", "ÉLODIE"));
  it("treats full-width and compatibility characters as their plain forms", () => {
    same("Sam", "Ｓａｍ");
    same("Sam Lee", "Sam Lee"); // non-breaking space
    same("ffi", "ﬃ"); // the ligature
  });
  it("removes zero-width and direction characters", () => {
    same("Sam", "Sa​m", "‎Sam", "S‍am", "﻿Sam", "Sam‮");
  });
  it("treats Arabic marks and tatweel as the same name", () => {
    same("محمد", "مُحَمَّد", "محـــمد");
  });
  it("treats alef variants as one letter", () => same("أحمد", "احمد", "إحمد", "آحمد"));
  it("leaves different names different", () => {
    different("Sam", "Sam Lee");
    different("Sam", "Sami");
    different("محمد", "أحمد");
    different("سارة", "ساره"); // ة and ه are deliberately not folded: they can be different names
  });
  it("is stable: normalising a key again changes nothing", () => {
    for (let name of ["  Élodie  ", "Ｓａｍ", "أحمد", "Sa​m"]) {
      let key = memberNameKey(name);
      assert.equal(memberNameKey(key), key);
    }
  });
  it("is empty for a name with nothing visible in it", () => {
    for (let name of ["", "   ", "​", "​ ﻿", "ًـ"]) {
      assert.equal(memberNameKey(name), "", JSON.stringify(name));
    }
  });
  it("does not merge Latin and Cyrillic look-alikes (a known limit)", () => {
    different("Sam", "Sаm"); // Cyrillic а
  });
});
