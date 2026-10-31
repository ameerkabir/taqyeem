import { css, type Handle } from "remix/component";
import type { Board, Category } from "../../data/fake-board.ts";
import { routes } from "../../routes.ts";
import { Document } from "../document.tsx";
import { NoteField } from "./public/note-field.tsx";

interface NewCardPageProps {
  board: Board;
  categories: Category[];
  activeCategoryId?: string;
  submissionId: string;
}

export function NewCardPage(handle: Handle<NewCardPageProps>) {
  return () => {
    let { board, categories, activeCategoryId, submissionId } = handle.props;

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

            <form method="post" action={routes.newCard.action.href()} mix={formStyle}>
          <input type="hidden" name="submissionId" value={submissionId} />
          <fieldset mix={fieldsetStyle}>
            <legend mix={labelStyle}>اختر التصنيف</legend>
            <div mix={choicesStyle}>
              {categories.map((category) => (
                <label mix={choiceStyle}>
                  <input
                    type="radio"
                    name="categoryId"
                    value={category.id}
                    defaultChecked={category.id === activeCategoryId}
                    required
                  />
                  <span>{category.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
<NoteField />
          <label mix={choiceStyle}>
            <input
              type="checkbox"
              name="isAnonymous"
              value="true"
            />
            <span>انشر بدون اسمي</span>
          </label>
<button type="submit" mix={submitStyle}>نشر الملاحظة</button>
</form>
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

const formStyle = css({ display: "grid", gap: "var(--space-6)" });
const fieldsetStyle = css({
  border: 0,
  margin: 0,
  padding: 0,
  minInlineSize: 0,
});
const labelStyle = css({ fontWeight: 500, padding: 0 });
const choicesStyle = css({
  display: "grid",
  gap: "var(--space-2)",
  marginBlockStart: "var(--space-3)",
});

const choiceStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  minBlockSize: "var(--target-min)",
  padding: "var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  cursor: "pointer",
  "&:has(input:checked)": {
    borderColor: "var(--color-primary)",
    backgroundColor: "#eef7f2",
  },
  "& input": {
    accentColor: "var(--color-primary)",
    inlineSize: "1.25rem",
    blockSize: "1.25rem",
    margin: 0,
    flexShrink: 0,
  },
});

const submitStyle = css({
  inlineSize: "100%",
  minBlockSize: "3rem",
  paddingBlock: "var(--space-3)",
  paddingInline: "var(--space-4)",
  border: 0,
  borderRadius: "var(--radius-md)",
  font: "inherit",
  fontWeight: 700,
  color: "var(--color-on-primary)",
  backgroundColor: "var(--color-primary)",
  cursor: "pointer",
  "&:hover": { backgroundColor: "var(--color-primary-hover)" },
  "&:disabled": { opacity: 0.65, cursor: "wait" },
});
