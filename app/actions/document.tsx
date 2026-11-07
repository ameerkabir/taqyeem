import type { Handle, RemixNode } from "remix/component";
import type { I18n } from "../middleware/locale.ts";
import { LocaleSwitcher } from "./locale-switcher.tsx";

export interface DocumentProps {
  children?: RemixNode;
  head?: RemixNode;
  title?: string;
  i18n: I18n;
}

// Vite serves the client entry itself in dev; the built, hashed chunk in production.
const CLIENT_ENTRY_SRC = import.meta.env?.DEV
  ? "/client.ts"
  : "/assets/client.js";

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let {
      children,
      head,
      i18n,
    } = handle.props;
    let title = handle.props.title ?? i18n.t("app.name");

    return (
      <html lang={i18n.locale} dir={i18n.dir}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="stylesheet" href="/app.css" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>{title}</title>
          {head}
          <script type="module" src={CLIENT_ENTRY_SRC}></script>
        </head>
        <body>
          <LocaleSwitcher i18n={i18n} />
          {children}
        </body>
      </html>
    );
  };
}
