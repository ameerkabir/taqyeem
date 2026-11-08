import { Document } from "../document.tsx";
import { routes } from "../../routes.ts";
import type { Handle } from "remix/component";
import type { I18n } from "../../middleware/locale.ts";
import {
  MAX_BOARD_TITLE_LENGTH,
  MAX_MEMBER_NAME_LENGTH,
} from "../../data/limits.ts";
import { defaultCategoryLabels } from "../../data/board-defaults.ts";
import {
  pageStyle,
  panelStyle,
  titleStyle,
  hintStyle,
  formStyle,
  fieldStyle,
  inputStyle,
  categoriesStyle,
  submitStyle,
  errorStyle,
} from "./styles.ts";

interface NewBoardPageProps {
  i18n: I18n;
  values?: { title: string; organiserDisplayName: string };
  titleError?: string;
  organiserNameError?: string;
  /** Something went wrong saving the board; nothing was kept, so trying again is safe. */
  submitError?: string;
}

export function NewBoardPage(handle: Handle<NewBoardPageProps>) {
  return () => {
    let { i18n, values, titleError, organiserNameError, submitError } = handle.props;
    let { t } = i18n;

    return (
      <Document
        i18n={i18n}
        title={t("page.title", { title: t("newBoard.documentTitle"), suffix: t("app.name") })}
      >
        <main mix={pageStyle}>
          <section mix={panelStyle} aria-labelledby="new-board-title">
            <a href={routes.home.href()}>{t("newBoard.back")}</a>
            <h1 id="new-board-title" mix={titleStyle}>
              {t("newBoard.heading")}
            </h1>
            <p mix={hintStyle}>
              {t("newBoard.intro")}
            </p>

            <form method="post" action={routes.newBoard.action.href()} mix={formStyle}>
              {submitError && (
                <p id="board-submit-error" role="alert" mix={errorStyle}>
                  {submitError}
                </p>
              )}

              <label mix={fieldStyle}>
                <span>{t("newBoard.titleLabel")}</span>
                <input
                  type="text"
                  name="title"
                  defaultValue={values?.title ?? ""}
                  maxLength={MAX_BOARD_TITLE_LENGTH}
                  aria-invalid={titleError ? "true" : undefined}
                  aria-describedby={titleError ? "board-title-error" : undefined}
                  placeholder={t("newBoard.titlePlaceholder")}
                  required
                  dir="auto"
                  mix={inputStyle}
                />
              </label>

              {titleError && (
                <p id="board-title-error" role="alert" mix={errorStyle}>
                  {titleError}
                </p>
              )}

              <label mix={fieldStyle}>
                <span>{t("newBoard.nameLabel")}</span>
                <input
                  type="text"
                  name="organiserDisplayName"
                  defaultValue={values?.organiserDisplayName ?? ""}
                  maxLength={MAX_MEMBER_NAME_LENGTH}
                  required
                  autoComplete="name"
                  dir="auto"
                  aria-invalid={organiserNameError ? "true" : undefined}
                  aria-describedby={
                    organiserNameError
                      ? "organiser-name-hint organiser-name-error"
                      : "organiser-name-hint"
                  }
                  mix={inputStyle}
                />
              </label>

              <p id="organiser-name-hint" mix={hintStyle}>
                {t("newBoard.nameHint")}
              </p>

              {organiserNameError && (
                <p id="organiser-name-error" role="alert" mix={errorStyle}>
                  {organiserNameError}
                </p>
              )}

              <section aria-labelledby="default-categories-title">
                <h2 id="default-categories-title">{t("newBoard.categoriesHeading")}</h2>
                <p mix={hintStyle}>{t("newBoard.categoriesHint")}</p>
                <ul mix={categoriesStyle}>
                  {defaultCategoryLabels(t).map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </section>

              <button type="submit" mix={submitStyle}>
                {t("newBoard.submit")}
              </button>
            </form>
          </section>
        </main>
      </Document>
    );
  };
}
