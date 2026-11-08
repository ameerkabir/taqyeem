import {
  formStyle,
  fieldsetStyle,
  labelStyle,
  choicesStyle,
  choiceStyle,
  submitStyle,
  errorStyle,
} from "./styles.ts";
import { clientEntry, navigate, on, type Handle } from "remix/component";
import type { Category } from "../../../data/board.ts";
import { routes } from "../../../routes.ts";
import { NoteField } from "./note-field.tsx";
import type { Locale } from "../../../i18n/locales.ts";
import { createTranslator } from "../../../i18n/translator.ts";

export interface NewCardFormProps {
  locale: Locale;
  boardId: string;
  categories: Category[];
  activeCategoryId?: string;
  submissionId: string;
  values?: { text: string; isAnonymous: boolean };
  error?: string;
}

export const NewCardForm = clientEntry(
  "/app/actions/new-card/public/form.tsx#NewCardForm",
  function NewCardForm(handle: Handle<NewCardFormProps>) {
    let pending = false;
    let error = handle.props.error;

    return () => {
      let { locale, boardId, categories, activeCategoryId, submissionId, values } =
        handle.props;
      let { t } = createTranslator(locale);
      return (
        <form
          method="post"
          action={routes.newCard.action.href({ boardId })}
          aria-busy={pending}
          mix={[
            formStyle,
            on("submit", async (event) => {
              event.preventDefault();
              if (pending) return;

              let form = event.currentTarget;
              let data = new FormData(form);
              // Use the component lifetime so repeated submits cannot abort an active request.
              let signal = handle.signal;
              pending = true;
              error = undefined;
              handle.update();

              try {
                let response = await fetch(form.action, {
                  method: form.method,
                  body: data,
                  headers: { Accept: "application/json" },
                  signal,
                });
                if (signal.aborted) return;

                if (!response.ok) {
                  if (
                    response.headers
                      .get("Content-Type")
                      ?.includes("application/json")
                  ) {
                    let result = (await response.json()) as { error?: unknown };
                    if (signal.aborted) return;
                    error =
                      typeof result.error === "string"
                        ? result.error
                        : t("newCard.failed");
                  } else {
                    error = t("newCard.failed");
                  }
                  return;
                }

                await navigate(response.url, { history: "replace" });
              } catch {
                if (!signal.aborted) {
                  error = t("form.networkError");
                }
              } finally {
                if (!signal.aborted) {
                  pending = false;
                  handle.update();
                }
              }
            }),
          ]}
        >
          <input type="hidden" name="submissionId" value={submissionId} />
          <fieldset mix={fieldsetStyle}>
            <legend mix={labelStyle}>{t("form.category")}</legend>
            <div mix={choicesStyle}>
              {categories.map((category) => (
                <label mix={choiceStyle}>
                  <input
                    type="radio"
                    name="categoryId"
                    value={category.id}
                    defaultChecked={category.id === activeCategoryId}
                    required
                  />
                  <span dir="auto">{category.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <NoteField locale={locale} initialValue={values?.text} />

          <label mix={choiceStyle}>
            <input
              type="checkbox"
              name="isAnonymous"
              value="true"
              defaultChecked={values?.isAnonymous}
            />
            <span>{t("form.anonymous")}</span>
          </label>

          {error && (
            <p role="alert" mix={errorStyle}>
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} mix={submitStyle}>
            {pending ? t("newCard.submitting") : t("newCard.submit")}
          </button>
        </form>
      );
    };
  },
);
