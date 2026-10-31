import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";

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
    .pipe(checks.minLength(1), checks.maxLength(500)),
  categoryId: s.string(),
  isAnonymous: s.boolean(),
});

export function parseNewCardForm(data: FormData) {
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
            return "معرّف الإرسال غير صالح، يرجى فتح النموذج مجددًا";
          case "text":
            return context.code === "string.max_length"
              ? "الحد الأقصى ٥٠٠ حرف"
              : "يرجى كتابة ملاحظة";
          case "categoryId":
            return "التصنيف غير صالح";
          case "isAnonymous":
            return "خيار إخفاء الاسم غير صالح";
        }
      },
    },
  );
}
