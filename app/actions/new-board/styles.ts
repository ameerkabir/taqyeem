import { css } from "remix/component";

export const pageStyle = css({
  minBlockSize: "100svh",
  boxSizing: "border-box",
  paddingBlock: "var(--space-8)",
  paddingInline: "var(--page-gutter)",
});

export const panelStyle = css({
  boxSizing: "border-box",
  inlineSize: "100%",
  maxInlineSize: "36rem",
  marginInline: "auto",
  padding: "var(--space-4)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  backgroundColor: "var(--color-surface)",
  "@media (min-width: 40rem)": {
    padding: "var(--space-6)",
  },
});

export const titleStyle = css({
  marginBlockStart: "var(--space-6)",
  marginBlockEnd: "var(--space-2)",
  fontSize: "var(--text-lg)",
});

export const hintStyle = css({
  marginBlock: "var(--space-2)",
  color: "var(--color-text-muted)",
  lineHeight: 1.7,
});

export const formStyle = css({
  display: "grid",
  gap: "var(--space-6)",
  marginBlockStart: "var(--space-6)",
});

export const fieldStyle = css({
  display: "grid",
  gap: "var(--space-2)",
  fontWeight: 600,
});

export const inputStyle = css({
  boxSizing: "border-box",
  inlineSize: "100%",
  minInlineSize: 0,
  minBlockSize: "var(--target-min)",
  paddingBlock: "var(--space-3)",
  paddingInline: "var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-text)",
  font: "inherit",
  "&:focus-visible": {
    outline: "2px solid var(--color-primary)",
    outlineOffset: "2px",
  },
});

export const categoriesStyle = css({
  display: "grid",
  gap: "var(--space-2)",
  listStyle: "none",
  padding: 0,
  marginBlock: "var(--space-3)",
  "& li": {
    padding: "var(--space-3)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
  },
});

export const submitStyle = css({
  inlineSize: "100%",
  minBlockSize: "var(--target-min)",
  padding: "var(--space-3)",
  border: 0,
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-primary)",
  color: "var(--color-on-primary)",
  font: "inherit",
  fontWeight: 600,
  "&:disabled": {
    opacity: 0.5,
    cursor: "not-allowed",
  },
});

export const errorStyle = css({
  margin: 0,
  color: "var(--color-text)",
  paddingInlineStart: "var(--space-3)",
  borderInlineStart: "3px solid currentColor",
});
