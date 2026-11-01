import { css, type Handle, type RemixNode } from "remix/component";
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
const mainStyle = css({
  minBlockSize: "100svh",
  padding: "var(--space-4)",
  display: "grid",
  alignItems: "start",
  "@media (min-width: 40rem)": {
    alignItems: "center",
    padding: "var(--space-8)",
  },
});
const panelStyle = css({
  inlineSize: "100%",
  minInlineSize: 0,
  maxInlineSize: "36rem",
  marginInline: "auto",
  padding: "var(--space-4)",
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  "@media (min-width: 40rem)": { padding: "var(--space-6)" },
});
const headerStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-3)",
  marginBlockEnd: "var(--space-6)",
});
const boardStyle = css({
  margin: 0,
  color: "var(--color-text-muted)",
  overflowWrap: "anywhere",
});
const titleStyle = css({ margin: 0, fontSize: "var(--text-lg)" });
const cancelStyle = css({
  display: "inline-flex",
  alignItems: "center",
  minBlockSize: "var(--target-min)",
  paddingInline: "var(--space-2)",
  color: "var(--color-primary)",
});
