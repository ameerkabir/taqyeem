import { mainStyle } from "./home-page.styles.ts";

import { Document } from "./document.tsx";
import { routes } from "../routes.ts";

export function HomePage() {
  return () => (
    <Document>
      <main mix={mainStyle}>
        <p>Taqyeem</p>
        <a href={routes.newBoard.index.href()}>إنشاء لوحة جديدة</a>
      </main>
    </Document>
  );
}
