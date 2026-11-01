import type { Handle } from "remix/component";
import type { Board, Card, Category } from "../../data/fake-board.ts";
import { routes } from "../../routes.ts";
import { CardPage } from "../../ui/card-page.tsx";
import { NoteField } from "../new-card/public/note-field.tsx";
import {
  formStyle,
  fieldsetStyle,
  labelStyle,
  choicesStyle,
  choiceStyle,
  submitStyle,
  cancelStyle,
  errorStyle,
} from "../../ui/public/card-form-styles.ts";

export interface EditCardValues {
  text: string;
  categoryId: string;
  isAnonymous: boolean;
}
export interface EditCardPageProps {
  board: Board;
  card: Card;
  categories: Category[];
  values?: EditCardValues;
  error?: string;
}
export function EditCardPage(handle: Handle<EditCardPageProps>) {
  return () => {
    let { board, card, categories, error } = handle.props;
    let values = handle.props.values ?? {
      text: card.body,
      categoryId: card.categoryId,
      isAnonymous: card.isAnonymous,
    };
    let cancelHref = `${routes.board.href()}?section=${encodeURIComponent(card.categoryId)}`;
    return (
      <CardPage
        title="تعديل الملاحظة"
        boardTitle={board.title}
        cancelHref={cancelHref}
      >
        <form
          method="post"
          action={routes.editCard.action.href({ cardId: card.id })}
          mix={formStyle}
        >
          <fieldset mix={fieldsetStyle}>
            <legend mix={labelStyle}>اختر التصنيف</legend>
            <div mix={choicesStyle}>
              {categories.map((category) => (
                <label mix={choiceStyle}>
                  <input
                    type="radio"
                    name="categoryId"
                    value={category.id}
                    defaultChecked={category.id === values.categoryId}
                    required
                  />
                  <span>{category.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <NoteField initialValue={values.text} />
          <label mix={choiceStyle}>
            <input
              type="checkbox"
              name="isAnonymous"
              value="true"
              defaultChecked={values.isAnonymous}
            />
            <span>انشر بدون اسمي</span>
          </label>
          {error && (
            <p role="alert" mix={errorStyle}>
              {error}
            </p>
          )}
          <button type="submit" mix={submitStyle}>
            حفظ التعديلات
          </button>
          <a href={cancelHref} mix={cancelStyle}>
            إلغاء
          </a>
        </form>
      </CardPage>
    );
  };
}
