import {
  mainStyle,
  panelStyle,
  headerStyle,
  boardStyle,
  titleStyle,
  cancelStyle,
} from "./card-page.styles.ts";
import type { Handle, RemixNode } from "remix/component";
import { Document } from "../actions/document.tsx";
import type { I18n } from "../middleware/locale.ts";
import { isolate } from "../i18n/translator.ts";

export function CardPage(
  handle: Handle<{
    i18n: I18n;
    title: string;
    boardTitle: string;
    cancelHref: string;
    children?: RemixNode;
  }>,
) {
  return () => {
    let { i18n, title, boardTitle, cancelHref, children } = handle.props;
    return (
      <Document
        i18n={i18n}
        title={i18n.t("page.title", { title, suffix: isolate(boardTitle) })}
      >
        <main mix={mainStyle}>
          <section mix={panelStyle} aria-labelledby="card-page-title">
            <header mix={headerStyle}>
              <div>
                <p mix={boardStyle}>{boardTitle}</p>
                <h1 id="card-page-title" mix={titleStyle}>
                  {title}
                </h1>
              </div>
              <a href={cancelHref} mix={cancelStyle}>
                {i18n.t("common.cancel")}
              </a>
            </header>
            {children}
          </section>
        </main>
      </Document>
    );
  };
}
