import type { Database } from "remix/data-table";
import { createContextKey, type Middleware } from "remix/router";

// Application contracts, independent of Cloudflare's generated binding types.
export interface AppConfig {
  readonly appEnv: string;
}

export type WaitUntil = (work: Promise<unknown>) => void;

export interface AppDependencies {
  db: Database;
  config: AppConfig;
  waitUntil: WaitUntil;
}

export const databaseContext = createContextKey<Database>();
export const appConfigContext = createContextKey<AppConfig>();
export const waitUntilContext = createContextKey<WaitUntil>();

export function loadAppDependencies({ db, config, waitUntil }: AppDependencies): Middleware<[
  { key: typeof databaseContext; value: Database; property: "db" },
  { key: typeof appConfigContext; value: AppConfig; property: "config" },
  { key: typeof waitUntilContext; value: WaitUntil; property: "waitUntil" }
]> {
  return (context, next) => {
    context.set(databaseContext, db, { property: "db" });
    context.set(appConfigContext, config, { property: "config" });
    context.set(waitUntilContext, waitUntil, { property: "waitUntil" });
    return next();
  };
}
