/** How often an open, visible workspace checks for shared changes. */
export const pollIntervalMs = 2500;

/**
 * Calls `tick` every `ms` while `active()` holds, and once more whenever the
 * browser comes back online. Stops when `signal` aborts.
 */
export function startPolling(
  signal: AbortSignal,
  tick: (afterReconnect: boolean) => void,
  active: () => boolean,
  ms = pollIntervalMs,
): void {
  const interval = setInterval(() => {
    if (active()) {
      tick(false);
    }
  }, ms);
  window.addEventListener("online", () => tick(true), { signal });
  signal.addEventListener("abort", () => clearInterval(interval), { once: true });
}

/**
 * Opens collapsed `<details>` matching `selector` while printing, so evidence
 * and agreements appear on paper, then closes exactly those again afterwards.
 */
export function expandForPrint(
  root: () => HTMLElement,
  selector: string,
  signal: AbortSignal,
): void {
  let opened: HTMLDetailsElement[] = [];
  window.addEventListener(
    "beforeprint",
    () => {
      opened = [...root().querySelectorAll<HTMLDetailsElement>(selector)].filter(
        (detail) => !detail.open,
      );
      for (let detail of opened) {
        detail.open = true;
      }
    },
    { signal },
  );
  window.addEventListener(
    "afterprint",
    () => {
      for (let detail of opened) {
        detail.open = false;
      }
      opened = [];
    },
    { signal },
  );
}
