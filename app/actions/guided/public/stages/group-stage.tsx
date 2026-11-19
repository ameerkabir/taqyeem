import type { Theme } from "../../../../models/guided/session.ts";
import { CommandForm } from "../command-form.tsx";
import type { WorkspaceView } from "./types.ts";

/**
 * The "new theme" form. Theme cards submit it with `name="theme"` to add the
 * selected notes to an existing theme instead, keeping any drafted title.
 */
function newThemeForm(v: WorkspaceView) {
  return (
    <CommandForm data={v.data} kind="theme" draft="theme" id={`${v.rootId}-theme`}>
      <label>
        {v.t("guided.themeTitle")}
        <input name="title" maxLength={160} required dir="auto" />
      </label>
      <button disabled={v.pending}>{v.t("guided.makeTheme")}</button>
    </CommandForm>
  );
}

function themeControls(v: WorkspaceView, theme: Theme) {
  let { t } = v;
  return (
    <>
      <CommandForm data={v.data} kind="rename" fields={{ theme: theme.id }}>
        <label>
          {t("guided.themeTitle")}
          <input
            name="title"
            defaultValue={theme.title}
            maxLength={160}
            required
            dir="auto"
          />
        </label>
        <button disabled={v.pending}>{t("guided.rename")}</button>
      </CommandForm>
      {v.command("ungroup", { theme: theme.id }, t("guided.ungroup"))}
    </>
  );
}

function themeCard(v: WorkspaceView, theme: Theme) {
  return (
    <article key={theme.id} class="topic-card">
      <h4 dir="auto">{theme.title}</h4>
      {v.canManage && (
        <button
          type="submit"
          form={`${v.rootId}-theme`}
          name="theme"
          value={theme.id}
          formNoValidate
          disabled={v.pending}
          aria-label={v.t("guided.addToNamedTheme", { title: theme.title })}
        >
          {v.t("guided.addToTheme")}
        </button>
      )}
      {v.evidence(theme)}
      {v.canManage && themeControls(v, theme)}
    </article>
  );
}

/** Group: ungrouped notes beside the themes they can be gathered into. */
export function groupStage(v: WorkspaceView) {
  let { state, t, rootId } = v;
  let ungrouped = v.data.cards.filter(
    (c) => !state.themes.some((theme) => theme.notes.includes(c.id)),
  );
  return (
    <section>
      <p>{t(v.readOnly ? "review.groupHint" : "guided.groupHint")}</p>
      {v.canManage && (
        <a class="group-selection primary" href={`#${rootId}-group-themes`}>
          {t("guided.groupSelected")}
        </a>
      )}
      <nav class="group-switcher" aria-label={t("guided.group")}>
        <a href={`#${rootId}-group-notes`}>{t("guided.notes")}</a>
        <a href={`#${rootId}-group-themes`}>{t("guided.themes")}</a>
      </nav>
      <div class="group-layout">
        <section id={`${rootId}-group-notes`}>
          <h3>{t("guided.notes")}</h3>
          <div class="note-grid">{ungrouped.map((c) => v.note(c, v.canManage))}</div>
        </section>
        <section id={`${rootId}-group-themes`}>
          <h3>{t("guided.themes")}</h3>
          {v.canManage && newThemeForm(v)}
          {state.themes.map((theme) => themeCard(v, theme))}
        </section>
      </div>
    </section>
  );
}
