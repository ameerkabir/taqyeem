import type { Handle } from "remix/component";
import type { Board } from "../../data/fake-board.ts";
import { routes } from "../../routes.ts";
import { CardPage } from "../../ui/card-page.tsx";
import { EditCardForm, type EditCardFormProps } from "./public/form.tsx";

export interface EditCardPageProps extends EditCardFormProps {
  board: Board;
}
export function EditCardPage(handle: Handle<EditCardPageProps>) {
  return () => {
    let { board, ...formProps } = handle.props;
    let cancelHref = `${routes.board.href({ boardId: board.id })}?section=${encodeURIComponent(formProps.card.categoryId)}`;
    return (
      <CardPage
        title="تعديل الملاحظة"
        boardTitle={board.title}
        cancelHref={cancelHref}
      >
        <EditCardForm {...formProps} />
      </CardPage>
    );
  };
}
