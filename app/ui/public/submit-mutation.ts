import { navigate } from "remix/component";

// Keep native form URLs and fields as the single mutation contract.
export async function submitMutation(
  form: HTMLFormElement,
  signal: AbortSignal,
  messages: { failure: string; network: string },
): Promise<string | undefined> {
  try {
    let response = await fetch(form.action, {
      method: form.method,
      body: new FormData(form),
      headers: { Accept: "application/json" },
      signal,
    });
    if (signal.aborted) return;
    if (!response.ok) {
      if (response.headers.get("Content-Type")?.includes("application/json")) {
        let result = (await response.json()) as { error?: unknown };
        if (signal.aborted) return;
        return typeof result.error === "string" ? result.error : messages.failure;
      }
      return messages.failure;
    }
    await navigate(response.url, { history: "replace" });
  } catch {
    if (!signal.aborted)
      return messages.network;
  }
}
