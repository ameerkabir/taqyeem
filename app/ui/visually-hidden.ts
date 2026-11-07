import { css } from "remix/component";

// Screen-reader-only text (e.g. a plural count that is only a number visually).
export const visuallyHiddenStyle = css({
  position: "absolute",
  inlineSize: "1px",
  blockSize: "1px",
  margin: "-1px",
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
});
