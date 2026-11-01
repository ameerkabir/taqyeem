import { css, type Handle } from "remix/component";
import type { Board, Card } from "../../data/fake-board.ts";
import { routes } from "../../routes.ts";
import { CardPage } from "../../ui/card-page.tsx";
import {
  formStyle,
  submitStyle,
  dangerStyle,
  cancelStyle,
  errorStyle,
} from "../../ui/public/card-form-styles.ts";

export interface DeleteCardPageProps {
  board: Board;
  card: Card;
  error?: string;
}
export function DeleteCardPage(handle: Handle<DeleteCardPageProps>) {
  return () => {
    let { board, card, error } = handle.props;
    let cancelHref = `${routes.board.href()}?section=${encodeURIComponent(card.categoryId)}`;
    return (
      <CardPage
        title="حذف الملاحظة"
        boardTitle={board.title}
        cancelHref={cancelHref}
      >
        <form
          method="post"
          action={routes.deleteCard.action.href({ cardId: card.id })}
          mix={formStyle}
        >
          <p mix={questionStyle}>هل تريد حذف هذه الملاحظة؟</p>
          <blockquote dir="auto" mix={previewStyle}>
            {card.body}
          </blockquote>
          <p mix={hintStyle}>لا يمكن التراجع عن الحذف.</p>
          {error && (
            <p role="alert" mix={errorStyle}>
              {error}
            </p>
          )}
          <button type="submit" mix={[submitStyle, dangerStyle]}>
            حذف الملاحظة
          </button>
          <a href={cancelHref} mix={cancelStyle}>
            إلغاء
          </a>
        </form>
      </CardPage>
    );
  };
}
const questionStyle = css({
  margin: 0,
  fontWeight: 500,
  fontSize: "var(--text-md)",
});
const previewStyle = css({
  margin: 0,
  padding: "var(--space-4)",
  borderInlineStart: "var(--space-1) solid var(--color-border)",
  backgroundColor: "var(--color-bg)",
  borderRadius: "var(--radius-md)",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
});
const hintStyle = css({ margin: 0, color: "var(--color-text-muted)" });
