import { createAppRouter, type AppRouterOptions } from "./app/router.ts";

// Runtime values are narrowed here before entering the application.
export function createRequestOptions(
  env: Cloudflare.Env,
  ctx: Pick<ExecutionContext, "waitUntil">,
): AppRouterOptions {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET is required");
  return {
    sessionSecret: env.SESSION_SECRET,
    config: { appEnv: env.APP_ENV },
    waitUntil: ctx.waitUntil.bind(ctx),
  };
}

export default {
  async fetch(request, env, ctx) {
    try {
      let router = createAppRouter(createRequestOptions(env, ctx));
      return await router.fetch(request);
    } catch (error) {
      console.error(error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
} satisfies ExportedHandler<Cloudflare.Env>;
