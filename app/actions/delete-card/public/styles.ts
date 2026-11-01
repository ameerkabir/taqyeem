import { css } from "remix/component";

export const questionStyle = css({
  margin: 0,
  fontWeight: 500,
  fontSize: "var(--text-md)",
});
export const previewStyle = css({
  margin: 0,
  padding: "var(--space-4)",
  borderInlineStart: "var(--space-1) solid var(--color-border)",
  backgroundColor: "var(--color-bg)",
  borderRadius: "var(--radius-md)",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
});
export const hintStyle = css({ margin: 0, color: "var(--color-text-muted)" });
