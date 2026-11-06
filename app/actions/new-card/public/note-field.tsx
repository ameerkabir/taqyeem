import {
  labelStyle,
  fieldStyle,
  textareaStyle,
  hintStyle,
} from "./note-field.styles.ts";
import { clientEntry, on, type Handle } from "remix/component";
import type { Locale } from "../../../i18n/locales.ts";
import { createTranslator } from "../../../i18n/translator.ts";
import { MAX_CARD_TEXT_LENGTH } from "../../../data/limits.ts";

export const NoteField = clientEntry(
  "/app/actions/new-card/public/note-field.tsx#NoteField",
  function NoteField(handle: Handle<{ locale: Locale; initialValue?: string }>) {
    let characterCount = handle.props.initialValue?.length ?? 0;

    return () => {
      let { t, formatNumber } = createTranslator(handle.props.locale);
      return (
      <div mix={fieldStyle}>
        <label htmlFor="card-text" mix={labelStyle}>
          {t("form.note")}
        </label>

        <textarea
          id="card-text"
          name="text"
          defaultValue={handle.props.initialValue}
          dir="auto"
          rows={6}
          required
          maxLength={MAX_CARD_TEXT_LENGTH}
          placeholder={t("form.notePlaceholder")}
          aria-describedby="card-text-hint"
          mix={[
            textareaStyle,
            on("input", (event) => {
              characterCount = event.currentTarget.value.length;
              handle.update();
            }),
          ]}
        />

        <p id="card-text-hint" mix={hintStyle}>
          {t("form.counter", { count: characterCount, max: MAX_CARD_TEXT_LENGTH })}
        </p>
      </div>
      );
    };
  },
);
