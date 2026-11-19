/** The subset of Web Storage the stores use; tests pass a Map-backed fake. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface SessionStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** Parsed JSON, or null when missing or malformed. */
  getJson<T>(key: string): T | null;
}

/**
 * Prefixed access to sessionStorage that never throws. Storage can be missing
 * (private windows, blocked site data); callers keep working from the live form.
 */
export function createSessionStore(
  prefix: string,
  storage: () => KeyValueStorage = () => sessionStorage,
): SessionStore {
  const attempt = <T>(run: () => T, fallback: T): T => {
    try {
      return run();
    } catch {
      return fallback;
    }
  };
  return {
    get: (key) => attempt(() => storage().getItem(prefix + key), null),
    set: (key, value) => attempt(() => storage().setItem(prefix + key, value), undefined),
    remove: (key) => attempt(() => storage().removeItem(prefix + key), undefined),
    getJson<T>(key: string) {
      return attempt(() => JSON.parse(this.get(key) ?? "null") as T | null, null);
    },
  };
}
