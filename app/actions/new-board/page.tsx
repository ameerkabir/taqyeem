import { Document } from "../document.tsx";
import { routes } from "../../routes.ts";
import type { Handle } from "remix/component";
import { MAX_BOARD_TITLE_LENGTH, MAX_MEMBER_NAME_LENGTH } from "./schema.ts";
import { DEFAULT_CATEGORY_LABELS } from "../../data/board-defaults.ts";
import {
  pageStyle,
  panelStyle,
  titleStyle,
  hintStyle,
  formStyle,
  fieldStyle,
  inputStyle,
  categoriesStyle,
  submitStyle,
  errorStyle,
} from "./styles.ts";

interface NewBoardPageProps {
  values?: { title: string; organiserDisplayName: string };
  titleError?: string;
  organiserNameError?: string;
}

export function NewBoardPage(handle: Handle<NewBoardPageProps>) {
  return () => {
    let { values, titleError, organiserNameError } = handle.props;

    return (
      <Document title="إنشاء لوحة · تقييم">
        <main mix={pageStyle}>
          <section mix={panelStyle} aria-labelledby="new-board-title">
            <a href={routes.home.href()}>العودة للرئيسية</a>
            <h1 id="new-board-title" mix={titleStyle}>
              ابدأ لوحة جديدة
            </h1>
            <p mix={hintStyle}>
              مساحة لفريقك لمشاركة الملاحظات ومناقشتها
            </p>

            <form method="post" action={routes.newBoard.action.href()} mix={formStyle}>
              <label mix={fieldStyle}>
                <span>اسم اللوحة</span>
                <input
                  type="text"
                  name="title"
                  defaultValue={values?.title ?? ""}
                  maxLength={MAX_BOARD_TITLE_LENGTH}
                  aria-invalid={titleError ? "true" : undefined}
                  aria-describedby={titleError ? "board-title-error" : undefined}
                  placeholder="مثلًا: مراجعة السبرنت ١٥"
                  required
                  dir="auto"
                  mix={inputStyle}
                />
              </label>

              {titleError && (
                <p id="board-title-error" role="alert" mix={errorStyle}>
                  {titleError}
                </p>
              )}

              <label mix={fieldStyle}>
                <span>اسمك</span>
                <input
                  type="text"
                  name="organiserDisplayName"
                  defaultValue={values?.organiserDisplayName ?? ""}
                  maxLength={MAX_MEMBER_NAME_LENGTH}
                  required
                  autoComplete="name"
                  dir="auto"
                  aria-invalid={organiserNameError ? "true" : undefined}
                  aria-describedby={
                    organiserNameError
                      ? "organiser-name-hint organiser-name-error"
                      : "organiser-name-hint"
                  }
                  mix={inputStyle}
                />
              </label>

              <p id="organiser-name-hint" mix={hintStyle}>
                ستصبح منظم اللوحة، وسيظهر هذا الاسم لفريقك
              </p>

              {organiserNameError && (
                <p id="organiser-name-error" role="alert" mix={errorStyle}>
                  {organiserNameError}
                </p>
              )}

              <section aria-labelledby="default-categories-title">
                <h2 id="default-categories-title">أقسام اللوحة</h2>
                <p mix={hintStyle}>ستبدأ لوحتك بهذه الأقسام الثلاثة</p>
                <ul mix={categoriesStyle}>
                  {DEFAULT_CATEGORY_LABELS.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </section>

              <button type="submit" mix={submitStyle}>
                إنشاء اللوحة
              </button>
            </form>
          </section>
        </main>
      </Document>
    );
  };
}
