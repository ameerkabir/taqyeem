import { createAction } from "remix/router";
import { appearanceCookie } from "../../preferences.ts";
import { redirect } from "remix/response/redirect";
import { routes } from "../../routes.ts";
import { safeReturnTo } from "../../i18n/return-to.ts";

export default createAction(routes.setAppearance, {
  async handler(context) {
    let form = await context.request.formData(),
      value = form.get("appearance");
    if (value !== "light" && value !== "dark") {
      return new Response(context.i18n.t("guided.error.invalid"), {
        status: 400,
      });
    }
    let response = redirect(
      safeReturnTo(form.get("returnTo"), context.url.origin),
      303,
    );
    response.headers.append(
      "Set-Cookie",
      await appearanceCookie.serialize(value, {
        secure: context.url.protocol === "https:",
      }),
    );
    return response;
  },
});
