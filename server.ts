import { createAppRouter } from "./app/router.ts";

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
      return new Response("Internal Server Error", { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
