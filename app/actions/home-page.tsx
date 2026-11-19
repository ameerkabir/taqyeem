import { Document } from "./document.tsx";
import { routes } from "../routes.ts";
import type { Handle } from "remix/component";
import type { I18n } from "../middleware/locale.ts";
export function HomePage(handle: Handle<{ i18n: I18n }>) {
  return () => {
    let { i18n } = handle.props,
      { t } = i18n;
    return (
      <Document i18n={i18n}>
        <main class="home">
          <section class="home-copy">
            <h1>{t("guided.homeTitle")}</h1>
            <p>{t("guided.homeIntro")}</p>
            <a class="primary" href={routes.newBoard.index.href()}>
              {t("home.create")}
            </a>
          </section>
          <section class="home-preview" aria-labelledby="example-title">
            <h2 id="example-title">{t("guided.example")}</h2>
            <div class="note-grid">
              {[
                "The release went out with zero rollbacks.",
                "نحتاج وقتًا أوضح لمراجعة العمل.",
                "Pairing helped us resolve the blocker.",
                "Thanks for the thoughtful handover.",
              ].map((body, i) => (
                <article key={i} class="feedback-card" data-tone={i}>
                  <p dir="auto" class="note-body">
                    {body}
                  </p>
                  <footer>
                    {t(
                      `guided.exampleCategory${i}` as "guided.exampleCategory0",
                    )}
                  </footer>
                </article>
              ))}
            </div>
            <article class="action-card">
              <p>Agree on a clear release checklist</p>
              <span class="metadata">{t("guided.agreed")}</span>
            </article>
          </section>
        </main>
      </Document>
    );
  };
}
