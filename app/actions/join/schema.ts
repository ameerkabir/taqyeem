import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { MAX_MEMBER_NAME_LENGTH } from "../../data/limits.ts";
import type { Translator } from "../../i18n/translator.ts";
import { memberNameKey } from "../../models/members/name-key.ts";

const joinForm = s.object({
  displayName: s
    .string()
    // A name made only of invisible characters is as good as empty.
    .refine((value) => memberNameKey(value) !== "")
    .transform((value) => value.trim())
    .pipe(checks.minLength(1), checks.maxLength(MAX_MEMBER_NAME_LENGTH)),
});

export function readJoinValues(data: FormData) {
  let name = data.get("displayName");
  return { displayName: typeof name === "string" ? name : "" };
}

export function parseJoinForm(data: FormData, t: Translator["t"]) {
  let names = data.getAll("displayName");
  return s.parseSafe(
    joinForm,
    // A repeated field is rejected, like the other forms.
    { displayName: names.length === 1 ? names[0] : undefined },
    {
      abortEarly: true,
      errorMap(context) {
        return context.code === "string.max_length"
          ? t("join.error.nameMax", { max: MAX_MEMBER_NAME_LENGTH })
          : t("join.error.nameRequired");
      },
    },
  );
}
