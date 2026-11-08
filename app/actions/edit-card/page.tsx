import type { Handle } from "remix/component";
import type { Board } from "../../data/board.ts";
import { routes } from "../../routes.ts";
import type { I18n } from "../../middleware/locale.ts";
import { CardPage } from "../../ui/card-page.tsx";
import { EditCardForm, type EditCardFormProps } from "./public/form.tsx";

export interface EditCardPageProps extends Omit<EditCardFormProps, "locale"> {
  board: Board;
  i18n: I18n;
}
export function EditCardPage(handle: Handle<EditCardPageProps>) {
  return () => {
    let { board, i18n, ...formProps } = handle.props;
    let cancelHref = `${routes.board.href({ boardId: board.id })}?section=${encodeURIComponent(formProps.card.categoryId)}`;
    return (
      <CardPage
        i18n={i18n}
        title={i18n.t("editCard.title")}
        boardTitle={board.title}
        cancelHref={cancelHref}
      >
        <EditCardForm locale={i18n.locale} {...formProps} />
      </CardPage>
    );
  };
}
