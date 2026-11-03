import { css } from "remix/component";

export const labelStyle = css({ fontWeight: 500, padding: 0 });
export const fieldStyle = css({ display: "grid", gap: "var(--space-2)" });
export const textareaStyle = css({
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

export const hintStyle = css({ margin: 0, color: "var(--color-text-muted)" });
