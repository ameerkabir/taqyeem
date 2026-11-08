import { css } from "remix/component";

export const stateStyle = css({
  display: "grid",
  justifyItems: "center",
  gap: "var(--space-3)",
  textAlign: "center",
  paddingBlock: "var(--space-6)",
});

export const iconStyle = css({
  display: "grid",
  placeItems: "center",
  inlineSize: "4.5rem",
  blockSize: "4.5rem",
  borderRadius: "50%",
  backgroundColor: "var(--color-primary-soft, var(--color-border))",
  fontSize: "2rem",
});

export const headingStyle = css({
  margin: 0,
  fontSize: "var(--text-lg)",
});

export const bodyStyle = css({
  margin: 0,
  maxInlineSize: "28rem",
  color: "var(--color-text-muted)",
  lineHeight: 1.7,
});

export const actionsStyle = css({
  display: "grid",
  gap: "var(--space-3)",
  inlineSize: "100%",
  maxInlineSize: "20rem",
  marginBlockStart: "var(--space-4)",
});

export const primaryLinkStyle = css({
  display: "grid",
  placeItems: "center",
  minBlockSize: "var(--target-min)",
  padding: "var(--space-3)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-primary)",
  color: "var(--color-on-primary)",
  fontWeight: 600,
  textDecoration: "none",
  "&:focus-visible": {
    outline: "2px solid var(--color-primary)",
    outlineOffset: "2px",
  },
});

export const secondaryLinkStyle = css({
  display: "grid",
  placeItems: "center",
  minBlockSize: "var(--target-min)",
  padding: "var(--space-3)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
  textDecoration: "none",
  "&:focus-visible": {
    outline: "2px solid var(--color-primary)",
    outlineOffset: "2px",
  },
});
