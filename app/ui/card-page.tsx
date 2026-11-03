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

export function CardPage(
  handle: Handle<{
    title: string;
    boardTitle: string;
    cancelHref: string;
    children?: RemixNode;
  }>,
) {
  return () => {
    let { title, boardTitle, cancelHref, children } = handle.props;
    return (
      <Document title={`${title} · ${boardTitle}`}>
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
                إلغاء
              </a>
            </header>
            {children}
          </section>
        </main>
      </Document>
    );
  };
}
