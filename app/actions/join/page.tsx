import type { Handle } from "remix/component";
import { MAX_MEMBER_NAME_LENGTH } from "../../data/limits.ts";
import type { I18n } from "../../middleware/locale.ts";
import { isolate } from "../../i18n/translator.ts";
import { routes } from "../../routes.ts";
import { Document } from "../document.tsx";
import {
  errorStyle,
  fieldStyle,
  formStyle,
  hintStyle,
  inputStyle,
  pageStyle,
  panelStyle,
  submitStyle,
  titleStyle,
} from "../new-board/styles.ts";

interface JoinPageProps {
  i18n: I18n;
  boardId: string;
  boardTitle: string;
  values?: { displayName: string };
  nameError?: string;
  /** Something went wrong saving; nothing was kept, so trying again is safe. */
  submitError?: string;
  /** The board no longer accepts members: explain instead of showing the form. */
  closed?: boolean;
}

export function JoinPage(handle: Handle<JoinPageProps>) {
  return () => {
    let { i18n, boardId, boardTitle, values, nameError, submitError, closed } = handle.props;
    let { t } = i18n;
    let heading = t("join.heading", { title: isolate(boardTitle) });

    return (
      <Document
        i18n={i18n}
        title={t("page.title", { title: t("join.documentTitle"), suffix: t("app.name") })}
      >
        <main mix={pageStyle}>
          <section mix={panelStyle} aria-labelledby="join-title">
            <a href={routes.home.href()}>{t("newBoard.back")}</a>
            <h1 id="join-title" mix={titleStyle}>
              {heading}
            </h1>

            {closed ? (
              <p role="alert" mix={errorStyle}>
                {t("join.closedNote")}
              </p>
            ) : (
              <>
                <p mix={hintStyle}>{t("join.intro")}</p>
                <form
                  method="post"
                  action={routes.joinBoard.action.href({ boardId })}
                  mix={formStyle}
                >
                  {submitError && (
                    <p id="join-submit-error" role="alert" mix={errorStyle}>
                      {submitError}
                    </p>
                  )}

                  <label mix={fieldStyle}>
                    <span>{t("join.nameLabel")}</span>
                    <input
                      type="text"
                      name="displayName"
                      defaultValue={values?.displayName ?? ""}
                      maxLength={MAX_MEMBER_NAME_LENGTH}
                      required
                      autoComplete="name"
                      dir="auto"
                      aria-invalid={nameError ? "true" : undefined}
                      aria-describedby={nameError ? "join-name-hint join-name-error" : "join-name-hint"}
                      mix={inputStyle}
                    />
                  </label>
                  <p id="join-name-hint" mix={hintStyle}>
                    {t("join.nameHint")}
                  </p>
                  {nameError && (
                    <p id="join-name-error" role="alert" mix={errorStyle}>
                      {nameError}
                    </p>
                  )}

                  <button type="submit" mix={submitStyle}>
                    {t("join.submit")}
                  </button>
                </form>
              </>
            )}
          </section>
        </main>
      </Document>
    );
  };
}
