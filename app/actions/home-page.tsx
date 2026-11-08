import { mainStyle } from "./home-page.styles.ts";

import { Document } from "./document.tsx";
import { routes } from "../routes.ts";
import type { Handle } from "remix/component";
import type { I18n } from "../middleware/locale.ts";

export function HomePage(handle: Handle<{ i18n: I18n }>) {
  return () => {
    let { i18n } = handle.props;
    return (
    <Document i18n={i18n}>
      <main mix={mainStyle}>
        <p>{i18n.t("app.name")}</p>
        <a href={routes.newBoard.index.href()}>{i18n.t("home.create")}</a>
      </main>
    </Document>
    );
  };
}
