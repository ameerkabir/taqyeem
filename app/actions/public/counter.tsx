import { rowStyle, buttonStyle } from "./counter.styles.ts";
import { clientEntry, on, type Handle } from "remix/component";

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
