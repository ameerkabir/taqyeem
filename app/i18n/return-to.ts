const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const LOCALE_PATH = "/locale";

/**
 * Reduces a posted return destination to a same-origin path + query.
 * Anything else (absolute URLs, protocol-relative URLs, backslashes) becomes "/".
 */
export function safeReturnTo(value: unknown, origin: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\") || CONTROL_CHARACTERS.test(value)) return "/";

  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return "/";
  }
  if (url.origin !== origin) return "/";
  if (url.pathname === LOCALE_PATH) return "/";
  return url.pathname + url.search;
}
