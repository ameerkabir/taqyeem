import type { Handle } from "remix/component";
import type { Board } from "../../data/fake-board.ts";
import { routes } from "../../routes.ts";
import { CardPage } from "../../ui/card-page.tsx";
import { DeleteCardForm, type DeleteCardFormProps } from "./public/form.tsx";

export interface DeleteCardPageProps extends DeleteCardFormProps {
  board: Board;
}
export function DeleteCardPage(handle: Handle<DeleteCardPageProps>) {
  return () => {
    let { board, ...formProps } = handle.props;
    let cancelHref = `${routes.board.href({ boardId: board.id })}?section=${encodeURIComponent(formProps.card.categoryId)}`;
    return (
      <CardPage
        title="حذف الملاحظة"
        boardTitle={board.title}
        cancelHref={cancelHref}
      >
        <DeleteCardForm {...formProps} />
      </CardPage>
    );
  };
}
