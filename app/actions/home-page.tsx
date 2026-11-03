import { mainStyle } from "./home-page.styles.ts";
// Delete this file and put your own home page in app/actions/controller.tsx

import { Document } from "./document.tsx";
import { Counter } from "./public/counter.tsx";

export function HomePage() {
  return () => (
    <Document>
      <main mix={mainStyle}>
        <p>Taqyeem</p>
        <Counter initialCount={1} />
      </main>
    </Document>
  );
}
