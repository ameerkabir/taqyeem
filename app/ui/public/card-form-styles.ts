import { css } from "remix/component";

export const formStyle = css({ display: "grid", gap: "var(--space-4)" });
export const fieldsetStyle = css({
  border: 0,
  margin: 0,
  padding: 0,
  minInlineSize: 0,
});
export const labelStyle = css({ fontWeight: 500 });
export const choicesStyle = css({
  display: "grid",
  gap: "var(--space-2)",
  marginBlockStart: "var(--space-2)",
});
export const choiceStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  minBlockSize: "var(--target-min)",
  padding: "var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  cursor: "pointer",
  "& input": {
    accentColor: "var(--color-primary)",
    inlineSize: "1.25rem",
    blockSize: "1.25rem",
    margin: 0,
    flexShrink: 0,
  },
  "&:has(input:checked)": { borderColor: "var(--color-primary)" },
});
export const submitStyle = css({
  inlineSize: "100%",
  minBlockSize: "3rem",
  padding: "var(--space-3)",
  border: 0,
  borderRadius: "var(--radius-md)",
  font: "inherit",
  fontWeight: 700,
  color: "var(--color-on-primary)",
  backgroundColor: "var(--color-primary)",
  cursor: "pointer",
  "&:hover": { backgroundColor: "var(--color-primary-hover)" },
  "&:disabled": { opacity: 0.65, cursor: "wait" },
});
export const cancelStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minBlockSize: "var(--target-min)",
  color: "var(--color-primary)",
  textUnderlineOffset: "0.25em",
});
export const errorStyle = css({
  margin: 0,
  padding: "var(--space-3)",
  border: "1px solid var(--color-danger-border)",
  borderRadius: "var(--radius-md)",
  color: "var(--color-danger)",
  backgroundColor: "var(--color-danger-bg)",
});
export const dangerStyle = css({
  backgroundColor: "var(--color-danger)",
  "&:hover": { backgroundColor: "var(--color-danger-hover)" },
});
