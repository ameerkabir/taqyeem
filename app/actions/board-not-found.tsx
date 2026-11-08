import type { Handle } from "remix/component";
import { Renderer, type RenderFunction } from "remix/middleware/render";
import type { RequestContext } from "remix/router";
import { getI18n, type I18n } from "../middleware/locale.ts";
import type { BoardAccessErrorHandler } from "../middleware/board.ts";
import { routes } from "../routes.ts";
import { Document } from "./document.tsx";
import {
  actionsStyle,
  bodyStyle,
  headingStyle,
  iconStyle,
  primaryLinkStyle,
  secondaryLinkStyle,
  stateStyle,
} from "./board-not-found.styles.ts";
import { pageStyle, panelStyle } from "./new-board/styles.ts";

export function BoardNotFoundPage(handle: Handle<{ i18n: I18n }>) {
  return () => {
    let { t } = handle.props.i18n;
    return (
      <Document
        i18n={handle.props.i18n}
        title={t("page.title", { title: t("access.boardNotFound"), suffix: t("app.name") })}
      >
        <main mix={pageStyle}>
          <section mix={panelStyle} aria-labelledby="board-not-found-title">
            <div mix={stateStyle}>
              <span aria-hidden="true" mix={iconStyle}>
                🔍
              </span>
              <h1 id="board-not-found-title" mix={headingStyle}>
                {t("access.boardNotFound")}
              </h1>
              <p mix={bodyStyle}>{t("boardNotFound.body")}</p>
              <div mix={actionsStyle}>
                <a href={routes.newBoard.index.href()} mix={primaryLinkStyle}>
                  {t("home.create")}
                </a>
                <a href={routes.home.href()} mix={secondaryLinkStyle}>
                  {t("newBoard.back")}
                </a>
              </div>
            </div>
          </section>
        </main>
      </Document>
    );
  };
}

/**
 * The 404 for a board that does not exist, used by the pages people open from a link.
 * Browsers get a page with a way forward (start a board); JSON clients get JSON.
 * The plain-text default stays for fragments that are embedded in another page.
 */
export const boardNotFound: BoardAccessErrorHandler = (
  context: Pick<RequestContext, "request" | "get">,
  message,
  status,
) => {
  if (context.request.headers.get("Accept")?.includes("application/json")) {
    return Response.json({ error: message }, { status });
  }
  let render = context.get(Renderer) as RenderFunction | undefined;
  if (!render) return new Response(message, { status });
  return render(<BoardNotFoundPage i18n={getI18n(context)} />, { status });
};
