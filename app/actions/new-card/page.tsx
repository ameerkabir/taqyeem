import { css, type Handle } from "remix/component";
import type { Board } from "../../data/fake-board.ts";
import { routes } from "../../routes.ts";
import { Document } from "../document.tsx";
import { NewCardForm, type NewCardFormProps } from "./public/form.tsx";

interface NewCardPageProps extends NewCardFormProps {
  board: Board;
}

export function NewCardPage(handle: Handle<NewCardPageProps>) {
  return () => {
    let { board, ...formProps } = handle.props;

    return (
      <Document title={`إضافة ملاحظة · ${board.title}`}>
        <main mix={pageStyle}>
          <section mix={panelStyle} aria-labelledby="new-card-title">
            <header mix={headerStyle}>
              <div>
                <p mix={boardNameStyle}>{board.title}</p>
                <h1 id="new-card-title" mix={titleStyle}>
                  إضافة ملاحظة
                </h1>
              </div>
              <a href={routes.board.href()} mix={cancelStyle}>
                إلغاء
              </a>
            </header>

            <NewCardForm {...formProps} />
          </section>
        </main>
      </Document>
    );
  };
}

// Logical properties follow the document's RTL direction automatically.
const pageStyle = css({
  minBlockSize: "100svh",
  display: "grid",
  alignItems: "end",
  paddingBlockStart: "var(--space-8)",
  "@media (min-width: 40rem)": {
    alignItems: "center",
    padding: "var(--space-8)",
  },
});

const panelStyle = css({
  inlineSize: "100%",
  maxInlineSize: "36rem",
  minInlineSize: 0,
  marginInline: "auto",
  padding: "var(--space-6)",
  paddingBlockEnd: "max(var(--space-6), env(safe-area-inset-bottom))",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
  backgroundColor: "var(--color-surface)",
  "@media (min-width: 40rem)": {
    borderRadius: "var(--radius-lg)",
  },
});

const headerStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-4)",
  marginBlockEnd: "var(--space-6)",
});

const boardNameStyle = css({
  margin: 0,
  color: "var(--color-text-muted)",
  overflowWrap: "anywhere",
});

const titleStyle = css({ margin: 0, fontSize: "var(--text-lg)" });

const cancelStyle = css({
  display: "inline-flex",
  alignItems: "center",
  minBlockSize: "var(--target-min)",
  paddingInline: "var(--space-3)",
  color: "var(--color-primary)",
  borderRadius: "var(--radius-md)",
  textUnderlineOffset: "0.25em",
});
