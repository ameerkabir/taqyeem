import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import type { Translator } from "../../i18n/translator.ts";
import { MAX_CARD_TEXT_LENGTH } from "../../data/limits.ts";

const editCardForm = s.object({
  text: s
    .string()
    .transform((value) => value.trim())
    .pipe(checks.minLength(1), checks.maxLength(MAX_CARD_TEXT_LENGTH)),
  categoryId: s.string(),
  isAnonymous: s.boolean(),
});

export function readEditValues(data: FormData) {
  let text = data.get("text");
  let categoryId = data.get("categoryId");
  return {
    text: typeof text === "string" ? text : "",
    categoryId: typeof categoryId === "string" ? categoryId : "",
    isAnonymous: data.get("isAnonymous") === "true",
  };
}

export function parseEditCardForm(data: FormData, t: Translator["t"]) {
  return s.parseSafe(
    editCardForm,
    {
      text: data.get("text"),
      categoryId: data.get("categoryId"),
      isAnonymous: data.get("isAnonymous") === "true",
    },
    {
      abortEarly: true,
      errorMap(context) {
        if (context.path?.[0] === "categoryId") return t("card.error.invalidCategory");
        if (context.path?.[0] === "text")
          return context.code === "string.max_length"
            ? t("card.error.textMax", { max: MAX_CARD_TEXT_LENGTH })
            : t("card.error.textRequired");
      },
    },
  );
}
