import {
  pageStyle,
  panelStyle,
  headerStyle,
  boardNameStyle,
  titleStyle,
  cancelStyle,
} from "./styles.ts";
import type { Handle } from "remix/component";
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
