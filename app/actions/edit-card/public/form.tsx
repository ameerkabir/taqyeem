import { clientEntry, on, type Handle } from "remix/component";
import type { Card, Category } from "../../../data/board.ts";
import { routes } from "../../../routes.ts";
import { submitMutation } from "../../../ui/public/submit-mutation.ts";
import {
  formStyle,
  fieldsetStyle,
  labelStyle,
  choicesStyle,
  choiceStyle,
  submitStyle,
  cancelStyle,
  errorStyle,
} from "../../../ui/public/card-form-styles.ts";
import { NoteField } from "../../new-card/public/note-field.tsx";
import type { Locale } from "../../../i18n/locales.ts";
import { createTranslator } from "../../../i18n/translator.ts";

export interface EditCardValues {
  text: string;
  categoryId: string;
  isAnonymous: boolean;
}
export interface EditCardFormProps {
  locale: Locale;
  card: Card;
  categories: Category[];
  values?: EditCardValues;
  error?: string;
}

export const EditCardForm = clientEntry(
  "/app/actions/edit-card/public/form.tsx#EditCardForm",
  function EditCardForm(handle: Handle<EditCardFormProps>) {
    let pending = false;
    let error = handle.props.error;
    return () => {
      let { locale, card, categories } = handle.props;
      let { t } = createTranslator(locale);
      let values = handle.props.values ?? {
        text: card.body,
        categoryId: card.categoryId,
        isAnonymous: card.isAnonymous,
      };
      let cancelHref = `${routes.board.href({ boardId: card.boardId })}?section=${encodeURIComponent(card.categoryId)}`;
      return (
        <form
          method="post"
          action={routes.editCard.action.href({ boardId: card.boardId, cardId: card.id })}
          aria-busy={pending}
          mix={[
            formStyle,
            on("submit", async (event) => {
              event.preventDefault();
              if (pending) return;
              pending = true;
              error = undefined;
              handle.update();
              let message = await submitMutation(
                event.currentTarget,
                handle.signal,
                {
                  failure: t("editCard.failed"),
                  network: t("form.networkError"),
                },
              );
              if (!handle.signal.aborted) {
                error = message;
                pending = false;
                handle.update();
              }
            }),
          ]}
        >
          <fieldset mix={fieldsetStyle}>
            <legend mix={labelStyle}>{t("form.category")}</legend>
            <div mix={choicesStyle}>
              {categories.map((category) => (
                <label mix={choiceStyle}>
                  <input
                    type="radio"
                    name="categoryId"
                    value={category.id}
                    defaultChecked={category.id === values.categoryId}
                    required
                  />
                  <span dir="auto">{category.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <NoteField locale={locale} initialValue={values.text} />
          <label mix={choiceStyle}>
            <input
              type="checkbox"
              name="isAnonymous"
              value="true"
              defaultChecked={values.isAnonymous}
            />
            <span>{t("form.anonymous")}</span>
          </label>
          {error && (
            <p role="alert" mix={errorStyle}>
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} mix={submitStyle}>
            {pending ? t("editCard.submitting") : t("editCard.submit")}
          </button>
          <a href={cancelHref} mix={cancelStyle}>
            {t("common.cancel")}
          </a>
        </form>
      );
    };
  },
);
