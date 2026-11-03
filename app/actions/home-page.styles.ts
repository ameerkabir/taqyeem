import { css } from "remix/component";

export const mainStyle = css({
  minBlockSize: "100vh",
  paddingBlock: "var(--space-8)",
  paddingInline: "var(--space-6)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-4)",
});
