import { clientEntry, css, on, type Handle } from "remix/component";

const rowStyle = css({
  display: "flex",
  gap: "var(--space-2)",
});

const buttonStyle = css({
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

export const Counter = clientEntry(
  "/app/actions/public/counter.tsx#Counter",
  function Counter(handle: Handle<{ initialCount: number }>) {
    let counter = handle.props.initialCount;
    return () => (
      <div mix={rowStyle}>
        <button
          mix={[
            buttonStyle,
            on("click", () => {
              counter += 1;
              handle.update();
            }),
          ]}
        >
          Counter: {counter}
        </button>

        <button
          mix={[
            buttonStyle,
            on("click", () => {
              counter = handle.props.initialCount;
              handle.update();
            }),
          ]}
        >
          Reset Counter
        </button>
      </div>
    );
  },
);
