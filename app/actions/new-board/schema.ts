import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import type { Translator } from "../../i18n/translator.ts";

export const MAX_BOARD_TITLE_LENGTH = 120;
export const MAX_MEMBER_NAME_LENGTH = 60;

const newBoardForm = s.object({
  title: s
    .string()
    .transform((value) => value.trim())
    .pipe(checks.minLength(1), checks.maxLength(MAX_BOARD_TITLE_LENGTH)),
  organiserDisplayName: s
    .string()
    .transform((value) => value.trim())
    .pipe(checks.minLength(1), checks.maxLength(MAX_MEMBER_NAME_LENGTH)),
});

export function readNewBoardValues(data: FormData) {
  let title = data.get("title");
  let organiserDisplayName = data.get("organiserDisplayName");
  return {
    title: typeof title === "string" ? title : "",
    organiserDisplayName:
      typeof organiserDisplayName === "string" ? organiserDisplayName : "",
  };
}

export function parseNewBoardForm(data: FormData, t: Translator["t"]) {
  let titles = data.getAll("title");
  let names = data.getAll("organiserDisplayName");

  return s.parseSafe(
    newBoardForm,
    {
      title: titles.length === 1 ? titles[0] : undefined,
      organiserDisplayName: names.length === 1 ? names[0] : undefined,
    },
    {
      abortEarly: true,
      errorMap(context) {
        if (context.path?.[0] === "title") {
          return context.code === "string.max_length"
            ? t("newBoard.error.titleMax", { max: MAX_BOARD_TITLE_LENGTH })
            : t("newBoard.error.titleInvalid");
        }
        if (context.path?.[0] === "organiserDisplayName") {
          return context.code === "string.max_length"
            ? t("newBoard.error.nameMax", { max: MAX_MEMBER_NAME_LENGTH })
            : t("newBoard.error.nameRequired");
        }
      },
    },
  );
}
