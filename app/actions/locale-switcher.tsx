import type { Handle } from "remix/component";
import { css } from "remix/component";
import { LOCALES, LOCALE_NAMES } from "../i18n/locales.ts";
import type { I18n } from "../middleware/locale.ts";
import { routes } from "../routes.ts";

const formStyle = css({
  display: "flex",
  justifyContent: "flex-end",
  gap: "var(--space-2)",
  paddingBlock: "var(--space-2)",
  paddingInline: "var(--page-gutter)",
});

const buttonStyle = css({
  minBlockSize: "var(--target-min)",
  minInlineSize: "var(--target-min)",
  paddingInline: "var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  font: "inherit",
  cursor: "pointer",
  "&[aria-current='true']": {
    borderColor: "var(--color-primary)",
    color: "var(--color-primary)",
    fontWeight: 700,
  },
});

// A plain POST form: works without JavaScript and goes through cop() like any mutation.
export function LocaleSwitcher(handle: Handle<{ i18n: I18n }>) {
  return () => {
    let { i18n } = handle.props;
    return (
      <form
        method="post"
        action={routes.setLocale.href()}
        aria-label={i18n.t("locale.switcherLabel")}
        mix={formStyle}
      >
        <input type="hidden" name="returnTo" value={i18n.returnTo} />
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="submit"
            name="locale"
            value={locale}
            lang={locale}
            aria-current={locale === i18n.locale ? "true" : undefined}
            mix={buttonStyle}
          >
            {LOCALE_NAMES[locale]}
          </button>
        ))}
      </form>
    );
  };
}
