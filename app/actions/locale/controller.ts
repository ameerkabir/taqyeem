import { createAction } from "remix/router";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { isLocale } from "../../i18n/locales.ts";
import { safeReturnTo } from "../../i18n/return-to.ts";
import { serializeLocaleCookie } from "../../middleware/locale.ts";

// Only writes the language cookie. Sessions, membership, votes and boards are untouched.
// Cookies are set here, on the top-level response, because Frame subrequests cannot set them.
export default createAction(routes.setLocale, {
  async handler(context) {
    let data = await context.request.formData();
    let locale = data.get("locale");
    if (!isLocale(locale)) {
      return Response.json({ error: context.i18n.t("locale.invalid") }, { status: 400 });
    }

    let returnTo = safeReturnTo(data.get("returnTo"), context.url.origin);
    let response = redirect(returnTo, 303);
    response.headers.append(
      "Set-Cookie",
      await serializeLocaleCookie(locale, context.url.protocol === "https:"),
    );
    return response;
  },
});
