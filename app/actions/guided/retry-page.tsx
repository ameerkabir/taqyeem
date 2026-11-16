import type { Handle } from "remix/component";
import type { I18n } from "../../middleware/locale.ts";
import { Document } from "../document.tsx";
import { routes } from "../../routes.ts";

/** Native POST failures retain fields even when storage cannot be read at all. */
export function CommandRetryPage(
  handle: Handle<{
    i18n: I18n;
    boardId: string;
    action: string;
    form: FormData;
    message: string;
    revision: number;
  }>,
) {
  return () => {
    let { i18n, boardId, action, form, message, revision } = handle.props,
      { t } = i18n,
      kind = form.get("kind");
    return (
      <Document i18n={i18n}>
        <main class="workspace">
          <p role="alert" class="error">
            {message}
          </p>
          <a href={routes.board.href({ boardId })}>{t("guided.refresh")}</a>
          <form method="post" action={action} class="command-form">
            <input type="hidden" name="revision" value={revision} />
            {[...form]
              .filter(([key]) => key !== "revision")
              .map(([key, value], i) =>
                ["text", "title", "ownerSearch", "due", "labels"].includes(
                  key,
                ) ? (
                  <label key={i}>
                    {t(
                      key === "labels"
                        ? "setup.labels"
                        : key === "text"
                          ? kind === "decision"
                            ? "guided.decision"
                            : "guided.actionText"
                          : key === "title"
                            ? "guided.themeTitle"
                            : key === "due"
                              ? "guided.due"
                              : "guided.owner",
                    )}
                    {key === "text" || key === "labels" ? (
                      <textarea
                        name={key}
                        defaultValue={String(value)}
                        dir="auto"
                        maxLength={
                          key === "labels"
                            ? 1000
                            : kind === "decision"
                              ? 2000
                              : 500
                        }
                        required
                      />
                    ) : (
                      <input
                        name={key}
                        defaultValue={String(value)}
                        dir="auto"
                      />
                    )}
                  </label>
                ) : (
                  <input
                    key={i}
                    type="hidden"
                    name={key}
                    value={String(value)}
                  />
                ),
              )}
            <button class="primary">{t("guided.retry")}</button>
          </form>
        </main>
      </Document>
    );
  };
}
