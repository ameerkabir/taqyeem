import { router } from "./app/router.ts";

export default {
  async fetch(request, env, context) {
    console.log({ env, context });
    try {
      return await router.fetch(request);
    } catch (error) {
      console.error(error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
} satisfies ExportedHandler;
