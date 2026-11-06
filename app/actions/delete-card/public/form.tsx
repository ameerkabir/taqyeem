import { questionStyle, previewStyle, hintStyle } from "./styles.ts";
import { clientEntry, on, type Handle } from "remix/component";
import type { Card } from "../../../data/fake-board.ts";
import { routes } from "../../../routes.ts";
import { submitMutation } from "../../../ui/public/submit-mutation.ts";
import {
  formStyle,
  submitStyle,
  dangerStyle,
  cancelStyle,
  errorStyle,
} from "../../../ui/public/card-form-styles.ts";

export interface DeleteCardFormProps {
  card: Card;
  error?: string;
}

export const DeleteCardForm = clientEntry(
  "/app/actions/delete-card/public/form.tsx#DeleteCardForm",
  function DeleteCardForm(handle: Handle<DeleteCardFormProps>) {
    let pending = false;
    let error = handle.props.error;
    return () => {
      let { card } = handle.props;
      let cancelHref = `${routes.board.href({ boardId: card.boardId })}?section=${encodeURIComponent(card.categoryId)}`;
      return (
        <form
          method="post"
          action={routes.deleteCard.action.href({ boardId: card.boardId, cardId: card.id })}
          aria-busy={pending}
          mix={[
            formStyle,
            on("submit", async (event) => {
              event.preventDefault();
              if (pending) return;
              pending = true;
              error = undefined;
              handle.update();
              let message = await submitMutation(
                event.currentTarget,
                handle.signal,
                "تعذّر حذف الملاحظة، يرجى المحاولة مجددًا",
              );
              if (!handle.signal.aborted) {
                error = message;
                pending = false;
                handle.update();
              }
            }),
          ]}
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
          <button
            type="submit"
            disabled={pending}
            mix={[submitStyle, dangerStyle]}
          >
            {pending ? "جارٍ الحذف…" : "حذف الملاحظة"}
          </button>
          <a href={cancelHref} mix={cancelStyle}>
            إلغاء
          </a>
        </form>
      );
    };
  },
);
