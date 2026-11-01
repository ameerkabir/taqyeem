import { css } from "remix/component";

// Logical properties follow the document's RTL direction automatically.
export const pageStyle = css({
  minBlockSize: "100svh",
  display: "grid",
  alignItems: "end",
  paddingBlockStart: "var(--space-8)",
  "@media (min-width: 40rem)": {
    alignItems: "center",
    padding: "var(--space-8)",
  },
});

export const panelStyle = css({
  inlineSize: "100%",
  maxInlineSize: "36rem",
  minInlineSize: 0,
  marginInline: "auto",
  padding: "var(--space-6)",
  paddingBlockEnd: "max(var(--space-6), env(safe-area-inset-bottom))",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
  backgroundColor: "var(--color-surface)",
  "@media (min-width: 40rem)": {
    borderRadius: "var(--radius-lg)",
  },
});

export const headerStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-4)",
  marginBlockEnd: "var(--space-6)",
});

export const boardNameStyle = css({
  margin: 0,
  color: "var(--color-text-muted)",
  overflowWrap: "anywhere",
});

export const titleStyle = css({ margin: 0, fontSize: "var(--text-lg)" });

export const cancelStyle = css({
  display: "inline-flex",
  alignItems: "center",
  minBlockSize: "var(--target-min)",
  paddingInline: "var(--space-3)",
  color: "var(--color-primary)",
  borderRadius: "var(--radius-md)",
  textUnderlineOffset: "0.25em",
});
