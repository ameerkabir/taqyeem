import type { Handle, RemixNode } from "remix/component";
import { css } from "remix/component";

export interface DocumentProps {
  children?: RemixNode;
  head?: RemixNode;
  title?: string;
  locale?: string;
}

const DEFAULT_LOCALE = "ar";
const RTL_LOCALES = new Set(["ar", "he", "fa", "ur"]);

function directionFor(locale: string): "rtl" | "ltr" {
  return RTL_LOCALES.has(locale.split("-")[0]) ? "rtl" : "ltr";
}

const DEFAULT_TITLE = readAppDisplayName("Taqyeem");

// Vite serves the client entry itself in dev; the built, hashed chunk in production.
const CLIENT_ENTRY_SRC = import.meta.env?.DEV
  ? "/client.ts"
  : "/assets/client.js";

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let {
      children,
      head,
      title = DEFAULT_TITLE,
      locale = DEFAULT_LOCALE,
    } = handle.props;

    return (
      <html lang={locale} dir={directionFor(locale)}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="stylesheet" href="/app.css" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <title>{title}</title>
          {head}
          <script type="module" src={CLIENT_ENTRY_SRC}></script>
        </head>
        <body mix={css({ margin: 0 })}>{children}</body>
      </html>
    );
  };
}

function readAppDisplayName(value: string): string {
  return value.startsWith("%%") ? "Remix App" : decodeURIComponent(value);
}
