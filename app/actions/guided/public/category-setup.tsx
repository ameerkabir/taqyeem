import type { Handle } from "remix/component";
import type { ViewerPayload } from "../payload.ts";
import type { Locale } from "../../../i18n/locales.ts";
import { createTranslator } from "../../../i18n/translator.ts";
import { CommandForm } from "./command-form.tsx";

export function CategorySetup(
  handle: Handle<{
    data: ViewerPayload;
    locale: Locale;
    pending: boolean;
    error: string;
  }>,
) {
  return () => {
    const { data, locale, pending, error } = handle.props,
      { t } = createTranslator(locale),
      facilitator = data.memberId === data.board.organiserMemberId;
    return (
      <section class="category-setup" aria-labelledby="category-setup-heading">
        <div class="setup-intro">
          <p class="eyebrow">{t("setup.before")}</p>
          <h2 id="category-setup-heading">{t("setup.heading")}</h2>
          <p>{t(facilitator ? "setup.intro" : "setup.waiting")}</p>
        </div>
        {facilitator ? (
          <CommandForm data={data} kind="configure" draft="category-setup">
            <fieldset class="template-choices">
              <legend class="sr-only">{t("setup.heading")}</legend>
              <label class="template-choice">
                <input
                  type="radio"
                  name="choice"
                  value="classic"
                  defaultChecked
                />
                <span class="template-choice-body">
                  <strong>{t("setup.classic")}</strong>
                  <span>{t("setup.classicHint")}</span>
                  <span class="template-preview">
                    {data.categories.map((c) => (
                      <span key={c.id} data-tone={c.tone}>
                        <bdi>{c.label}</bdi>
                      </span>
                    ))}
                  </span>
                </span>
                <span class="choice-check" aria-hidden="true">
                  ✓
                </span>
              </label>
              <label class="template-choice">
                <input type="radio" name="choice" value="custom" />
                <span class="template-choice-body">
                  <strong>{t("setup.custom")}</strong>
                  <span>{t("setup.customHint")}</span>
                  <span class="custom-preview" aria-hidden="true">
                    <i>+</i>
                    <i>+</i>
                    <i>+</i>
                  </span>
                </span>
                <span class="choice-check" aria-hidden="true">
                  ✓
                </span>
              </label>
            </fieldset>
            <div class="custom-category-fields">
              <label>
                {t("setup.labels")}
                <textarea
                  name="labels"
                  rows={5}
                  maxLength={1000}
                  dir="auto"
                  aria-describedby="category-labels-hint"
                  placeholder={t("setup.placeholder")}
                />
              </label>
              <p id="category-labels-hint">{t("setup.limits")}</p>
            </div>
            {error && (
              <p role="alert" class="error">
                {error}
              </p>
            )}
            <div class="setup-footer">
              <p>{t("setup.stable")}</p>
              <button class="primary" disabled={pending}>
                {pending ? t("guided.saving") : t("setup.start")}
                <span aria-hidden="true" class="icon-directional">
                  →
                </span>
              </button>
            </div>
          </CommandForm>
        ) : (
          <div class="setup-waiting">
            <span class="waiting-mark" aria-hidden="true">
              …
            </span>
            <p>{t("setup.waitingHint")}</p>
          </div>
        )}
      </section>
    );
  };
}
