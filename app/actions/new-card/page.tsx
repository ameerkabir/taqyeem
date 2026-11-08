import {
  pageStyle,
  panelStyle,
  headerStyle,
  boardNameStyle,
  titleStyle,
  cancelStyle,
} from "./styles.ts";
import type { Handle } from "remix/component";
import type { Board } from "../../data/board.ts";
import { routes } from "../../routes.ts";
import { Document } from "../document.tsx";
import type { I18n } from "../../middleware/locale.ts";
import { isolate } from "../../i18n/translator.ts";
import { NewCardForm, type NewCardFormProps } from "./public/form.tsx";

interface NewCardPageProps extends Omit<NewCardFormProps, "boardId" | "locale"> {
  i18n: I18n;
  board: Board;
}

export function NewCardPage(handle: Handle<NewCardPageProps>) {
  return () => {
    let { board, i18n, ...formProps } = handle.props;

    return (
      <Document
        i18n={i18n}
        title={i18n.t("page.title", {
          title: i18n.t("newCard.title"),
          suffix: isolate(board.title),
        })}
      >
        <main mix={pageStyle}>
          <section mix={panelStyle} aria-labelledby="new-card-title">
            <header mix={headerStyle}>
              <div>
                <p dir="auto" mix={boardNameStyle}>{board.title}</p>
                <h1 id="new-card-title" mix={titleStyle}>
                  {i18n.t("newCard.title")}
                </h1>
              </div>
              <a href={routes.board.href({ boardId: board.id })} mix={cancelStyle}>
                {i18n.t("common.cancel")}
              </a>
            </header>

            <NewCardForm
              boardId={board.id}
              locale={i18n.locale}
              {...formProps}
            />
          </section>
        </main>
      </Document>
    );
  };
}
