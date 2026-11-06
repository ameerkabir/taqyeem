import { css } from "remix/component";

export const votingBannerStyle = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-3)",
  marginBlock: "var(--space-3)",
  marginInline: 0,
  padding: "var(--space-4)",
  borderRadius: "var(--radius-lg)",
  backgroundColor: "color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))",
  color: "var(--color-primary)",
});

export const votingDotStyle = css({
  flexShrink: 0,
  inlineSize: "0.5rem",
  blockSize: "0.5rem",
  marginBlockStart: "0.55rem",
  borderRadius: "50%",
  backgroundColor: "currentColor",
  boxShadow: "0 0 0 0.25rem color-mix(in srgb, currentColor 12%, transparent)",
});

export const votingTitleStyle = css({
  margin: 0,
  fontWeight: 700,
});

export const votingHintStyle = css({
  margin: 0,
  marginBlockStart: "var(--space-1)",
  fontSize: "0.875rem",
  color: "var(--color-primary-hover)",
  lineHeight: 1.7,
});

export const mainStyle = css({
  paddingInline: "var(--page-gutter)",
  paddingBlock: "var(--space-4)",
});

export const headerStyle = css({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "var(--space-2)",
  marginBlockEnd: "var(--space-3)",
});

export const titleStyle = css({
  margin: 0,
  fontSize: "var(--text-lg)",
});

export const statusPillStyle = css({
  paddingBlock: "var(--space-1)",
  paddingInline: "var(--space-3)",
  borderRadius: "var(--radius-lg)",
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text-muted)",
});

// Bleeds to the screen edges so tabs scroll under them, while the first tab
// still lines up with the page content (negative margin cancels the gutter,
// padding puts it back).
export const navStyle = css({
  display: "flex",
  gap: "var(--space-2)",
  marginInline: "calc(var(--page-gutter) * -1)",
  marginInlineEnd: "var(--space-4)",
  marginBlockEnd: "var(--space-2)",
  paddingInline: "var(--page-gutter)",
  scrollPaddingInline: "var(--page-gutter)",
  overflowX: "auto",
});

export const tabStyle = css({
  display: "flex",
  alignItems: "center",
  minBlockSize: "var(--target-min)",
  paddingInline: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  color: "var(--color-text-muted)",
  textDecoration: "none",
  whiteSpace: "nowrap",
  "&:hover": { color: "var(--color-text)" },
  "&:active": { opacity: 0.8 },
  '&[aria-current="page"]': {
    backgroundColor: "var(--color-primary)",
    color: "var(--color-on-primary)",
  },
});

export const tabCounter = css({
  display: "inline-block",
  marginInline: "var(--space-1)",
});

export const addNoteStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
  inlineSize: "100%",
  border: 0,
  font: "inherit",
  minBlockSize: "var(--target-min)",
  marginBlockStart: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-primary)",
  color: "var(--color-on-primary)",
  textDecoration: "none",
  "&:hover:not(:disabled)": { backgroundColor: "var(--color-primary-hover)" },
  "&:disabled": {
    backgroundColor: "var(--color-border)",
    color: "var(--color-text-muted)",
    cursor: "not-allowed",
  },
});

export const closedNoteStyle = css({
  marginBlock: "var(--space-2)",
  textAlign: "center",
  fontSize: "0.875rem",
  color: "var(--color-text-muted)",
});
