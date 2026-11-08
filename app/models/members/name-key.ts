// Two names that a person would read as "the same name" must produce the same key, so the
// database's unique index on (board_id, name_key) can refuse the second one. SQLite's lower()
// only folds ASCII, so the folding is done here, where full Unicode is available.
//
// What this does NOT do: it cannot make look-alikes from different scripts (Cyrillic "а" vs
// Latin "a") equal. The organiser badge on notes covers that gap; do not promise more.

const INVISIBLE = /[\u0000-\u001F\u007F-\u009F­​-‏‪-‮⁠-⁤﻿]/g;
// Tatweel (kashida), the vowel marks (harakat) and the dagger alef: written differently,
// read as the same name.
const ARABIC_MARKS = /[ـً-ٰٟ]/g;
// Alef with hamza or madda, and alef wasla, all fold to a plain alef: أحمد and احمد are one name.
const ALEF_VARIANTS = /[آأإٱ]/g;

export function memberNameKey(name: string): string {
  return name
    .normalize("NFKC") // full-width letters, ligatures, non-breaking spaces, ...
    .replace(/\s+/g, " ") // tabs, newlines, repeated spaces
    .replace(INVISIBLE, "") // zero-width spaces, direction marks, other control characters
    .replace(ARABIC_MARKS, "")
    .replace(ALEF_VARIANTS, "ا")
    .replace(/\s+/g, " ") // removing characters can leave two spaces side by side
    .trim()
    .toLowerCase();
}
