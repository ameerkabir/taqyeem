import {
  labelStyle,
  fieldStyle,
  textareaStyle,
  hintStyle,
} from "./note-field.styles.ts";
import { clientEntry, on, type Handle } from "remix/component";

export const NoteField = clientEntry(
  "/app/actions/new-card/public/note-field.tsx#NoteField",
  function NoteField(handle: Handle<{ initialValue?: string }>) {
    let characterCount = handle.props.initialValue?.length ?? 0;

    return () => (
      <div mix={fieldStyle}>
        <label htmlFor="card-text" mix={labelStyle}>
          ملاحظتك
        </label>

        <textarea
          id="card-text"
          name="text"
          defaultValue={handle.props.initialValue}
          dir="auto"
          rows={6}
          required
          maxLength={500}
          placeholder="ما الذي تود مشاركته مع الفريق؟"
          aria-describedby="card-text-hint"
          mix={[
            textareaStyle,
            on("input", (event) => {
              characterCount = event.currentTarget.value.length;
              handle.update();
            }),
          ]}
        />

        <p id="card-text-hint" mix={hintStyle}>
          {characterCount.toLocaleString("ar-u-nu-arab")} / ٥٠٠ حرف
        </p>
      </div>
    );
  },
);
