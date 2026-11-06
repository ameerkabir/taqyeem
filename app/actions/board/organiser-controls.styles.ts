import { css } from "remix/component";

export const panelStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  alignItems: "center",
  gap: "var(--space-3)",
  padding: "var(--space-3)",
  marginBlockEnd: "var(--space-4)",
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  "@media (min-width: 56rem)": {
    gridTemplateColumns: "minmax(0, max-content) minmax(0, max-content)",
    justifyContent: "start",
    columnGap: "var(--space-6)",
  },
});

export const badgeStyle = css({
  gridColumn: "1 / -1",
  justifySelf: "start",
  margin: 0,
  paddingBlock: "var(--space-1)",
  paddingInline: "var(--space-2)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))",
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "var(--color-primary)",
});

export const detailStyle = css({
  margin: 0,
  color: "var(--color-text-muted)",
});

const selectStyles = {
  boxSizing: "border-box",
  inlineSize: "auto",
  maxInlineSize: "100%",
  minInlineSize: 0,
  minBlockSize: "var(--target-min)",
  paddingBlock: "var(--space-2)",
  paddingInline: "var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-text)",
  font: "inherit",
  "&:disabled": {
    opacity: 0.7,
    cursor: "not-allowed",
  },
  "&:focus-visible": {
    outline: "2px solid var(--color-primary)",
    outlineOffset: "2px",
  },
};

export const fieldStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  flexWrap: "wrap",
  gap: "var(--space-2)",
  minInlineSize: 0,
  fontSize: "0.875rem",
  minBlockSize: "var(--target-min)",
  color: "var(--color-text-muted)",
  "& select": selectStyles,
});

export const votingRowStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-start",
  minInlineSize: 0,
  gap: "var(--space-3)",
  minBlockSize: "var(--target-min)",
  color: "var(--color-text-muted)",
  fontSize: "0.875rem",
});

export const checkboxStyle = css({
  flexShrink: 0,
  inlineSize: "1.25rem",
  blockSize: "1.25rem",
  margin: 0,
  accentColor: "var(--color-primary)",
});

export const votingButtonStyle = css({
  flexShrink: 0,
  minBlockSize: "var(--target-min)",
  paddingBlock: "var(--space-2)",
  paddingInline: "var(--space-3)",
  border: "1px solid var(--color-primary)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-primary)",
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
  "&:hover:not(:disabled)": {
    backgroundColor:
      "color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))",
  },
  "&:focus-visible": {
    outline: "2px solid var(--color-primary)",
    outlineOffset: "2px",
  },
  "&:disabled": {
    opacity: 0.5,
    cursor: "not-allowed",
  },
});

export const stageGroupStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "0.25rem",
  boxSizing: "border-box",
  inlineSize: "100%",
  maxInlineSize: "24rem",
  minInlineSize: 0,
  padding: "0.25rem",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  backgroundColor:
    "color-mix(in srgb, var(--color-border) 15%, var(--color-surface))",
  "@media (min-width: 56rem)": {
    inlineSize: "auto",
  },
});

export const stageButtonStyle = css({
  minInlineSize: 0,
  minBlockSize: "var(--target-min)",
  paddingBlock: "var(--space-2)",
  paddingInline: "clamp(0.5rem, 1.5vw, 1rem)",
  border: 0,
  borderRadius: "var(--radius-md)",
  backgroundColor: "transparent",
  color: "var(--color-text-muted)",
  font: "inherit",
  fontWeight: 600,
  lineHeight: 1.5,
  textAlign: "center",
  cursor: "pointer",
  "&:hover:not([aria-pressed=\"true\"])": {
    backgroundColor:
      "color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))",
    color: "var(--color-primary)",
  },
  '&[aria-pressed="true"]': {
    backgroundColor: "var(--color-primary)",
    color: "var(--color-on-primary)",
    boxShadow: "0 1px 3px rgb(0 0 0 / 12%)",
  },
  "&:focus-visible": {
    outline: "2px solid var(--color-primary)",
    outlineOffset: "2px",
  },
});
