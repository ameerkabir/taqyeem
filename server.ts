import type { Database } from "remix/data-table";
import { openDatabase } from "./bootstrap/database.ts";
import { createAppRouter, type AppRouterOptions } from "./app/router.ts";
import { resolveLocale } from "./app/i18n/resolve.ts";
import { createTranslator } from "./app/i18n/translator.ts";

// Runtime values are narrowed here before entering the application.
export function createRequestOptions(
  env: Pick<Cloudflare.Env, "APP_ENV" | "SESSION_SECRET">,
  ctx: Pick<ExecutionContext, "waitUntil">,
  db: Database,
): AppRouterOptions {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET is required");
  return {
    db,
    sessionSecret: env.SESSION_SECRET,
    config: { appEnv: env.APP_ENV },
    waitUntil: ctx.waitUntil.bind(ctx),
  };
}

export default {
  async fetch(request, env, ctx) {
    try {
      let router = createAppRouter(createRequestOptions(env, ctx, openDatabase(env.DB)));
      return await router.fetch(request);
    } catch (error) {
      console.error(error);
      // Outside the router: only Accept-Language is available here.
      let locale = resolveLocale({ acceptLanguage: request.headers.get("Accept-Language") });
      return new Response(createTranslator(locale).t("server.error"), {
        status: 500,
        headers: { "Content-Language": locale, "Cache-Control": "no-store" },
      });
    }
  },
} satisfies ExportedHandler<Cloudflare.Env>;
