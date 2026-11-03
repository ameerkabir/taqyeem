import { css } from "remix/component";

export const rowStyle = css({
  display: "flex",
  gap: "var(--space-2)",
});

export const buttonStyle = css({
  minBlockSize: "var(--target-min)",
  minInlineSize: "var(--target-min)",
  paddingBlock: "var(--space-2)",
  paddingInline: "var(--space-4)",
  border: "none",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-primary)",
  color: "var(--color-on-primary)",
  font: "inherit",
  cursor: "pointer",
  "&:hover": { backgroundColor: "var(--color-primary-hover)" },
});
