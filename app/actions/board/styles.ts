import { css } from "remix/component";

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

export const listStyle = css({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "var(--space-3)",
});

export const cardStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
  padding: "var(--space-4)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-surface)",
});

export const cardBodyStyle = css({
  margin: 0,
  fontSize: "var(--text-md)",
});

export const cardAuthorStyle = css({
  margin: 0,
  color: "var(--color-text-muted)",
});

export const cardHeaderStyle = css({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "var(--space-2)",
});

export const menuStyle = css({
  position: "relative",
  flexShrink: 0,
  "&[open] > summary": {
    backgroundColor: "var(--color-bg)",
    borderColor: "var(--color-primary)",
  },
});

export const menuTriggerStyle = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minBlockSize: "var(--target-min)",
  minInlineSize: "var(--target-min)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-surface)",
  color: "var(--color-text)",
  cursor: "pointer",
  listStyle: "none",
  "&::-webkit-details-marker": { display: "none" },
  "&:hover": { backgroundColor: "var(--color-bg)" },
});

// Inline SVG instead of a "…" character: it renders identically in every font.
export const menuIconStyle = css({
  inlineSize: "1.25rem",
  blockSize: "1.25rem",
  fill: "currentColor",
});

export const menuListStyle = css({
  position: "absolute",
  insetInlineEnd: 0,
  zIndex: 1,
  margin: 0,
  padding: "var(--space-1)",
  listStyle: "none",
  minInlineSize: "8rem",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-surface)",
});

export const menuItemStyle = css({
  display: "flex",
  alignItems: "center",
  inlineSize: "100%",
  minBlockSize: "var(--target-min)",
  paddingInline: "var(--space-3)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  backgroundColor: "transparent",
  color: "var(--color-text)",
  font: "inherit",
  textAlign: "start",
  textDecoration: "none",
  cursor: "pointer",
  "&:hover": { backgroundColor: "var(--color-bg)" },
});

export const menuHintStyle = css({
  margin: 0,
  padding: "var(--space-3)",
  maxInlineSize: "16rem",
  color: "var(--color-text-muted)",
});

export const cardFooterStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-2)",
});

export const votePillStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-1)",
  minBlockSize: "var(--target-min)",
  minInlineSize: "var(--target-min)",
  paddingInline: "var(--space-3)",
  border: "1px solid var(--color-primary)",
  borderRadius: "var(--radius-lg)",
  backgroundColor: "transparent",
  color: "var(--color-primary)",
  font: "inherit",
  cursor: "pointer",
  '&[aria-pressed="true"]': {
    backgroundColor: "var(--color-primary)",
    color: "var(--color-on-primary)",
  },
});

export const addNoteStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minBlockSize: "var(--target-min)",
  marginBlockStart: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-primary)",
  color: "var(--color-on-primary)",
  textDecoration: "none",
  "&:hover": { backgroundColor: "var(--color-primary-hover)" },
});
