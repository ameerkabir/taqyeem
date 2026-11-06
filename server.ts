import type { Database } from "remix/data-table";
import { openDatabase } from "./bootstrap/database.ts";
import { createAppRouter, type AppRouterOptions } from "./app/router.ts";

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
      return new Response("Internal Server Error", { status: 500 });
    }
  },
} satisfies ExportedHandler<Cloudflare.Env>;
