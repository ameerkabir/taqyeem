import { css } from "remix/component";

export const mainStyle = css({
  minBlockSize: "100svh",
  padding: "var(--space-4)",
  display: "grid",
  alignItems: "start",
  "@media (min-width: 40rem)": {
    alignItems: "center",
    padding: "var(--space-8)",
  },
});
export const panelStyle = css({
  inlineSize: "100%",
  minInlineSize: 0,
  maxInlineSize: "36rem",
  marginInline: "auto",
  padding: "var(--space-4)",
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  "@media (min-width: 40rem)": { padding: "var(--space-6)" },
});
export const headerStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-3)",
  marginBlockEnd: "var(--space-6)",
});
export const boardStyle = css({
  margin: 0,
  color: "var(--color-text-muted)",
  overflowWrap: "anywhere",
});
export const titleStyle = css({ margin: 0, fontSize: "var(--text-lg)" });
export const cancelStyle = css({
  display: "inline-flex",
  alignItems: "center",
  minBlockSize: "var(--target-min)",
  paddingInline: "var(--space-2)",
  color: "var(--color-primary)",
});
