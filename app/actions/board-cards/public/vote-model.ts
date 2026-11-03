export interface VoteState {
  voted: boolean;
  count: number;
}

export function createVoteModel(request: typeof fetch = fetch) {
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
          throw new Error(typeof result.error === "string"
            ? result.error : "تعذّر حفظ التصويت");
        }
        if (typeof result.voted !== "boolean" ||
            typeof result.count !== "number" ||
            !Number.isInteger(result.count) || result.count < 0) {
          throw new Error("تعذّر تأكيد التصويت");
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
