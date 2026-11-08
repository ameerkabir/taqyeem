import { ACCESS_REASON_HEADER } from "../../../data/access.ts";
import { DEFAULT_LOCALE } from "../../../i18n/locales.ts";
import { createTranslator, type Translator } from "../../../i18n/translator.ts";

export interface VoteState {
  voted: boolean;
  count: number;
}

/** The server answered and said no (as opposed to the request never completing). */
export class VoteRejectedError extends Error {
  readonly reason: string | null;
  constructor(message: string, reason: string | null) {
    super(message);
    this.name = "VoteRejectedError";
    this.reason = reason;
  }
}

type VoteMessages = Pick<Translator, "t">["t"];

// The translator is injected so fallback errors follow the page locale.
export function createVoteModel(
  request: typeof fetch = fetch,
  t: VoteMessages = createTranslator(DEFAULT_LOCALE).t,
) {
  let current: VoteState | undefined;

  return {
    read(server: VoteState): VoteState {
      return current ?? server;
    },
    reset() {
      current = undefined;
    },
    async save(options: {
      action: string;
      body: FormData;
      previous: VoteState;
      signal: AbortSignal;
      update: () => void;
    }) {
      let { action, body, previous, signal, update } = options;
      let previousOverride = current;
      let nextVote = body.get("voted") === "true";
      current = {
        voted: nextVote,
        count: previous.count +
          (nextVote === previous.voted ? 0 : nextVote ? 1 : -1),
      };
      update();

      try {
        let response = await request(action, {
          method: "POST",
          body,
          headers: { Accept: "application/json" },
          signal,
        });
        let result = await response.json() as {
          error?: unknown;
          voted?: unknown;
          count?: unknown;
        };
        signal.throwIfAborted();
        if (!response.ok) {
          throw new VoteRejectedError(
            typeof result.error === "string" ? result.error : t("vote.saveFailed"),
            response.headers.get(ACCESS_REASON_HEADER),
          );
        }
        if (typeof result.voted !== "boolean" ||
            typeof result.count !== "number" ||
            !Number.isInteger(result.count) || result.count < 0) {
          throw new Error(t("vote.unconfirmed"));
        }
        current = { voted: result.voted, count: result.count };
      } catch (cause) {
        // Restore the previous override, or resume reading current server props.
        current = previousOverride;
        throw cause;
      } finally {
        if (!signal.aborted) update();
      }
    },
  };
}
