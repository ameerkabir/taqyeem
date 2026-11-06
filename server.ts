import { createAppRouter } from "./app/router.ts";
import { resolveLocale } from "./app/i18n/resolve.ts";
import { createTranslator } from "./app/i18n/translator.ts";

interface Env {
  SESSION_SECRET: string;
}

let cached:
  | { secret: string; router: ReturnType<typeof createAppRouter> }
  | undefined;

export default {
  async fetch(request, env) {
    try {
      if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET is required");

      if (!cached || cached.secret !== env.SESSION_SECRET) {
        cached = {
          secret: env.SESSION_SECRET,
          router: createAppRouter(env.SESSION_SECRET),
        };
      }

      return await cached.router.fetch(request);
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
} satisfies ExportedHandler<Env>;
