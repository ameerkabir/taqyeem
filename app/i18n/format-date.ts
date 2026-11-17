/**
 * The date formats the app shows. `due` dates are calendar days stored as
 * `YYYY-MM-DD`, so they are formatted in UTC to stop them shifting a day.
 */
const styles = {
  due: { dateStyle: "medium", timeZone: "UTC" },
  "medium-time": { dateStyle: "medium", timeStyle: "short" },
  "long-time": { dateStyle: "long", timeStyle: "short" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateStyle = keyof typeof styles;

/**
 * Formats an ISO date string for display.
 * @param locale An Intl locale, e.g. from `numberLocaleFor()`.
 */
export function formatDate(
  locale: string,
  value: string,
  style: DateStyle,
): string {
  return new Intl.DateTimeFormat(locale, styles[style]).format(new Date(value));
}
