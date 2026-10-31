import { clientEntry, css, on, type Handle } from "remix/component";

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

const labelStyle = css({ fontWeight: 500, padding: 0 });
const fieldStyle = css({ display: "grid", gap: "var(--space-2)" });
const textareaStyle = css({
  inlineSize: "100%",
  minInlineSize: 0,
  minBlockSize: "10rem",
  padding: "var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  font: "inherit",
  color: "var(--color-text)",
  backgroundColor: "var(--color-surface)",
  resize: "vertical",
  "&::placeholder": { color: "var(--color-text-muted)" },
});

const hintStyle = css({ margin: 0, color: "var(--color-text-muted)" });
