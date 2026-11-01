import { css } from "remix/component";

export const formStyle = css({ display: "grid", gap: "var(--space-6)" });
export const fieldsetStyle = css({
  border: 0,
  margin: 0,
  padding: 0,
  minInlineSize: 0,
});
export const labelStyle = css({ fontWeight: 500, padding: 0 });
export const choicesStyle = css({
  display: "grid",
  gap: "var(--space-2)",
  marginBlockStart: "var(--space-3)",
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
  "&:has(input:checked)": {
    borderColor: "var(--color-primary)",
    backgroundColor: "#eef7f2",
  },
  "& input": {
    accentColor: "var(--color-primary)",
    inlineSize: "1.25rem",
    blockSize: "1.25rem",
    margin: 0,
    flexShrink: 0,
  },
});

export const submitStyle = css({
  inlineSize: "100%",
  minBlockSize: "3rem",
  paddingBlock: "var(--space-3)",
  paddingInline: "var(--space-4)",
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

export const errorStyle = css({
  margin: 0,
  padding: "var(--space-3)",
  color: "#8b1e1e",
  backgroundColor: "#fff1f1",
  border: "1px solid #e8b4b4",
  borderRadius: "var(--radius-md)",
});
