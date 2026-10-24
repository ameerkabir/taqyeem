import { clientEntry, css, on, type Handle } from "remix/component";

export const Counter = clientEntry(
  "/app/actions/public/counter.tsx#Counter",
  function Counter(handle: Handle<{ initialCount: number }>) {
    let counter = handle.props.initialCount;
    return () => (
      <div>
        <button
          mix={[
            on("click", () => {
              counter += 1;
              handle.update();
            }),
            css({display: 'flex', backgroundColor: 'green'})
          ]}
        >
          Counter: {counter}
        </button>

        <button
          mix={[
            on("click", () => {
              counter = handle.props.initialCount;
              handle.update();
            }),
            css({display: 'flex', backgroundColor: 'green'})
          ]}
        >
          Rest Counter
        </button>
      </div>
    );
  },
);
