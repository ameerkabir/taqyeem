import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import type { Translator } from "../../i18n/translator.ts";

import { MAX_CARD_TEXT_LENGTH } from "../../data/limits.ts";

const submissionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSubmissionId(value: unknown): value is string {
  return typeof value === "string" && submissionIdPattern.test(value);
}

export const newCardForm = s.object({
  submissionId: s.string().refine(isSubmissionId),
  text: s
    .string()
    .transform((value) => value.trim())
    .pipe(checks.minLength(1), checks.maxLength(MAX_CARD_TEXT_LENGTH)),
  categoryId: s.string(),
  isAnonymous: s.boolean(),
});

export function parseNewCardForm(data: FormData, t: Translator["t"]) {
  // Keep raw entries so missing values and files fail the string schemas.
  return s.parseSafe(
    newCardForm,
    {
      submissionId: data.get("submissionId"),
      text: data.get("text"),
      categoryId: data.get("categoryId"),
      // Native forms omit unchecked checkboxes.
      isAnonymous: data.get("isAnonymous") === "true",
    },
    {
      abortEarly: true,
      errorMap(context) {
        switch (context.path?.[0]) {
          case "submissionId":
            return t("card.error.submissionInvalid");
          case "text":
            return context.code === "string.max_length"
              ? t("card.error.textMax", { max: MAX_CARD_TEXT_LENGTH })
              : t("card.error.textRequired");
          case "categoryId":
            return t("card.error.invalidCategory");
          case "isAnonymous":
            return t("card.error.invalidAnonymous");
        }
      },
    },
  );
}
