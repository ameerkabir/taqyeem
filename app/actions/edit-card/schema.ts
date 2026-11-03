import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";

const editCardForm = s.object({
  text: s
    .string()
    .transform((value) => value.trim())
    .pipe(checks.minLength(1), checks.maxLength(500)),
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

export function parseEditCardForm(data: FormData) {
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
        if (context.path?.[0] === "categoryId") return "التصنيف غير صالح";
        if (context.path?.[0] === "text")
          return context.code === "string.max_length"
            ? "الحد الأقصى ٥٠٠ حرف"
            : "يرجى كتابة ملاحظة";
      },
    },
  );
}
