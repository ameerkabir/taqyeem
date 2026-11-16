import { CategorySetup } from "./category-setup.tsx";
import { CommandForm, type CommandProps } from "./command-form.tsx";
import { NoteCard, Evidence, ActionCard } from "./cards.tsx";
import { clientEntry, on, type Handle, type RemixNode } from "remix/component";
import { routes } from "../../../routes.ts";
import { createTranslator } from "../../../i18n/translator.ts";
import { numberLocaleFor } from "../../../i18n/locales.ts";
import type { Locale } from "../../../i18n/locales.ts";
import type { ViewerPayload } from "../payload.ts";
import type { Card } from "../../../data/board.ts";
import type { Topic, Stage, Proposal } from "../../../models/guided/session.ts";

const stages: Stage[] = [
  "collect",
  "group",
  "vote",
  "discuss",
  "actions",
  "summary",
];
function sourceTopics(data: ViewerPayload): Topic[] {
  let grouped = new Set(data.state.themes.flatMap((t) => t.notes)),
    order = new Map(data.cards.map((c, i) => [c.id, i]));
  return [
    ...data.state.themes,
    ...data.cards
      .filter((c) => !grouped.has(c.id))
      .map((c) => ({ id: c.id, title: c.body, notes: [c.id] })),
  ].sort(
    (a, b) =>
      Math.min(...a.notes.map((id) => order.get(id) ?? Infinity)) -
      Math.min(...b.notes.map((id) => order.get(id) ?? Infinity)),
  );
}
type WorkspaceProps = {
  origin: string;
  initial: ViewerPayload;
  locale: Locale;
  initialView?: {
    category: string;
    topic: string;
    filter: string;
    capture?: string;
    captureNote?: string;
    decision?: string;
  };
};
export const Workspace = clientEntry(
  "/app/actions/guided/public/workspace.tsx#Workspace",
  function Workspace(handle: Handle<WorkspaceProps>) {
    // Keys are reconciled in sibling arrays by the installed Remix runtime.
    // This Remix version matches keys in sibling arrays; changing board/member remounts the editor subtree.
    return () => [
      <SessionWorkspace
        key={`${handle.props.initial.board.id}:${handle.props.initial.memberId}`}
        {...handle.props}
      />,
    ];
  },
);
function SessionWorkspace(handle: Handle<WorkspaceProps>) {
  let data = handle.props.initial,
    privateTopic = handle.props.initialView?.topic ?? "",
    expanded = false,
    filter = [
      "all",
      "suggested",
      "agreed",
      "deferred",
      "declined",
      "open",
      "completed",
      "mine",
    ].includes(handle.props.initialView?.filter ?? "")
      ? handle.props.initialView!.filter
      : "all",
    category =
      handle.props.initialView?.category || data.categories[0]?.id || "";
  let lastInitial = handle.props.initial,
    lastView = JSON.stringify(handle.props.initialView);
  // HTML option defaults must survive later browsing/polling without retargeting a draft.
  const initialTopics = sourceTopics(data);
  const initialCaptureTopic =
    initialTopics.find(
      (topic) => topic.id === handle.props.initialView?.capture,
    )?.id ?? "";
  const initialDecisionTopic = [
    handle.props.initialView?.decision,
    handle.props.initialView?.topic,
    data.state.liveTopic,
  ].find((id) => initialTopics.some((topic) => topic.id === id));
  let status = "",
    error = "",
    pending = false;
  let needsJoin = false;
  const rootId = handle.id,
    prefix = `taqyeem:${data.board.id}:${data.memberId}:`;
  let submission = crypto.randomUUID(),
    noteOpened = false;
  const root = () => document.getElementById(rootId)!;
  const noteDialog = () => root().querySelector<HTMLDialogElement>("dialog")!;
  const translator = () => createTranslator(handle.props.locale);
  function get(key: string) {
    try {
      return sessionStorage.getItem(prefix + key);
    } catch {
      return null;
    }
  }
  function set(key: string, value: string) {
    try {
      sessionStorage.setItem(prefix + key, value);
    } catch {
      /* Mounted inputs retain the draft if storage is unavailable. */
    }
  }
  function save(form: HTMLFormElement) {
    if (!form.dataset.draft) return;
    if (form.dataset.draft === "note" && !noteOpened && !get("note")) return;
    let fields: Record<string, string | boolean> = {};
    for (let element of form.querySelectorAll("[name]")) {
      let node = element as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement;
      if (["revision", "kind", "ballot"].includes(node.name)) continue;
      if (
        node instanceof HTMLInputElement &&
        node.type === "radio" &&
        !node.checked
      )
        continue;
      fields[node.name] =
        node instanceof HTMLInputElement && node.type === "checkbox"
          ? node.checked
          : node.value;
    }
    let active = document.activeElement;
    let text = form.querySelector("textarea");
    let previous;
    try {
      previous = JSON.parse(get(form.dataset.draft) ?? "null");
    } catch {}
    let focus = form.contains(active) ? (active as HTMLInputElement).name : "";
    set(
      form.dataset.draft,
      JSON.stringify({
        fields,
        notes: new FormData(form).getAll("notes"),
        focus: focus || previous?.focus || "",
        start: text?.selectionStart ?? null,
        end: text?.selectionEnd ?? null,
      }),
    );
  }
  function restore(form: HTMLFormElement) {
    try {
      let saved = JSON.parse(get(form.dataset.draft!) ?? "null");
      if (!saved) return;
      if (form.dataset.draft === "note") noteOpened = true;
      for (let element of form.querySelectorAll("[name]")) {
        let node = element as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement;
        let value = saved.fields[node.name];
        if (value === undefined) continue;
        if (node instanceof HTMLInputElement && node.type === "radio") {
          node.checked = node.value === String(value);
          continue;
        }
        if (node instanceof HTMLInputElement && node.type === "checkbox")
          node.checked = !!value;
        else node.value = String(value);
      }
      if (Array.isArray(saved.notes))
        for (let element of root().querySelectorAll<HTMLInputElement>(
          "input[form][name=notes]",
        ))
          if (element.form === form)
            element.checked = saved.notes.includes(element.value);
      if (saved.focus) {
        let field = form.elements.namedItem(saved.focus);
        if (
          field instanceof HTMLElement &&
          form.closest("dialog[open],details[open]")
        ) {
          field.focus();
          if (field instanceof HTMLTextAreaElement && saved.start !== null)
            field.setSelectionRange(saved.start, saved.end);
        }
      }
      if (form.dataset.draft === "note") {
        let categoryField = form.elements.namedItem("categoryId");
        if (
          categoryField instanceof HTMLSelectElement &&
          !data.categories.some((c) => c.id === categoryField.value)
        )
          categoryField.value = category;
        let field = form.elements.namedItem("text") as HTMLTextAreaElement;
        let count = root().querySelector("[data-note-count]");
        if (count)
          count.textContent = translator().t("form.counter", {
            count: field.value.length,
            max: 500,
          });
      }
    } catch {
      /* Ignore malformed local data; server records are unaffected. */
    }
  }
  function persist() {
    for (let f of root().querySelectorAll<HTMLFormElement>("form[data-draft]"))
      save(f);
    set(
      "viewer",
      JSON.stringify({
        privateTopic,
        category,
        filter,
        expanded,
        open: noteDialog().open,
        details: [
          ...root().querySelectorAll<HTMLDetailsElement>(
            "details[data-editor]",
          ),
        ]
          .filter((d) => d.open)
          .map((d) => d.dataset.editor),
      }),
    );
  }
  async function refresh(announce = false) {
    try {
      let response = await fetch(
        routes.sessionState.href({ boardId: data.board.id }),
        {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "If-None-Match": `"guided:${data.board.id}:${data.memberId}:${data.revision}"`,
          },
          signal: handle.signal,
        },
      );
      if (response.status === 304) return;
      if (
        response.status === 403 &&
        response.headers.get("X-Access-Reason") === "not_member"
      ) {
        needsJoin = true;
        error = translator().t("access.joinBoard");
        status = "";
        handle.update();
        return;
      }
      if (!response.ok) throw new Error();
      let next: ViewerPayload = await response.json();
      if (!pending && next.revision >= data.revision) {
        let changed = next.revision !== data.revision;
        data = next;
        if (changed || announce) {
          status = translator().t("guided.updated");
          handle.update();
        }
      }
    } catch {
      if (!handle.signal.aborted) {
        status = translator().t("guided.reconnecting");
        handle.update();
      }
    }
  }
  handle.queueTask(() => {
    root().dataset.enhanced = "true";
    try {
      let v = JSON.parse(get("viewer") ?? "null");
      if (v) {
        privateTopic = v.privateTopic ?? "";
        category = v.category ?? category;
        filter = v.filter ?? "all";
        expanded = !!v.expanded;
        if (v.open && data.state.categorySetup?.confirmed !== false)
          noteDialog().showModal();
        for (let d of root().querySelectorAll<HTMLDetailsElement>(
          "details[data-editor]",
        ))
          d.open = v.details?.includes(d.dataset.editor);
      }
    } catch {}
    for (let f of root().querySelectorAll<HTMLFormElement>("form[data-draft]"))
      restore(f);
    const interval = setInterval(() => {
      if (!pending && !needsJoin && document.visibilityState === "visible")
        void refresh();
    }, 2500);
    window.addEventListener("online", () => void refresh(true), {
      signal: handle.signal,
    });
    document.addEventListener(
      "submit",
      (event) => {
        if (
          event.target instanceof HTMLFormElement &&
          !root().contains(event.target)
        )
          persist();
      },
      { capture: true, signal: handle.signal },
    );
    window.addEventListener("beforeunload", persist, {
      signal: handle.signal,
    });
    let printDetails: HTMLDetailsElement[] = [];
    window.addEventListener(
      "beforeprint",
      () => {
        printDetails = [
          ...root().querySelectorAll<HTMLDetailsElement>(
            "details.evidence:not([open])",
          ),
        ];
        for (let detail of printDetails) detail.open = true;
      },
      { signal: handle.signal },
    );
    window.addEventListener(
      "afterprint",
      () => {
        for (let detail of printDetails) detail.open = false;
        printDetails = [];
      },
      { signal: handle.signal },
    );
    handle.signal.addEventListener("abort", () => clearInterval(interval), {
      once: true,
    });
    handle.update();
  });
  function openNote() {
    if (data.state.categorySetup?.confirmed === false) return;
    let form = noteDialog().querySelector<HTMLFormElement>("form")!;
    if (!noteOpened && !get("note")) {
      let select = form.elements.namedItem("categoryId");
      if (select instanceof HTMLSelectElement) select.value = category;
    }
    noteOpened = true;
    noteDialog().showModal();
    restore(form);
    persist();
  }
  function closeNote() {
    save(noteDialog().querySelector("form")!);
    noteDialog().close();
    persist();
  }
  async function submit(
    form: HTMLFormElement,
    submitter: HTMLElement | null = null,
  ) {
    if (pending) return;
    save(form);
    let submitted = new URLSearchParams(
      [...new FormData(form)].map(([k, v]) => [k, String(v)]),
    ).toString();
    // Capture the clicked theme button before pending UI disables it.
    let body = new FormData(form, submitter);
    pending = true;
    error = "";
    status = translator().t("guided.saving");
    handle.update();
    try {
      let response = await fetch(form.action, {
        method: "post",
        body,
        headers: { Accept: "application/json" },
        signal: handle.signal,
      });
      if (!response.ok) {
        if (
          response.status === 403 &&
          response.headers.get("X-Access-Reason") === "not_member"
        )
          needsJoin = true;
        let result = (await response.json()) as { error?: string };
        error = result.error ?? translator().t("guided.failed");
        return;
      }
      if (form.classList.contains("command-form")) {
        let next: ViewerPayload = await response.json();
        if (next.revision >= data.revision) data = next;
        let kind = (form.elements.namedItem("kind") as HTMLInputElement).value;
        if (kind === "live") {
          privateTopic = "";
          expanded = false;
          persist();
        }
        if (
          ["theme", "propose", "decision"].includes(kind) &&
          new URLSearchParams(
            [...new FormData(form)].map(([k, v]) => [k, String(v)]),
          ).toString() === submitted
        ) {
          // Adding to an existing theme does not consume a drafted new title.
          let title = form.querySelector<HTMLInputElement>(
            'input[name="title"]',
          );
          let retainedTitle =
            kind === "theme" && body.has("theme") ? title?.value : undefined;
          form.reset();
          if (title && retainedTitle !== undefined) title.value = retainedTitle;
          save(form);
          let disclosure = form.closest(
            "details[data-editor]",
          ) as HTMLDetailsElement | null;
          if (disclosure) disclosure.open = false;
        }
        (form.elements.namedItem("id") as HTMLInputElement).value =
          crypto.randomUUID();
      } else {
        let unchanged =
          new URLSearchParams(
            [...new FormData(form)].map(([k, v]) => [k, String(v)]),
          ).toString() === submitted;
        if (unchanged) form.reset();
        submission = crypto.randomUUID();
        (form.elements.namedItem("submissionId") as HTMLInputElement).value =
          submission;
        save(form);
        if (unchanged) {
          closeNote();
          noteOpened = false;
          try {
            sessionStorage.removeItem(prefix + "note");
          } catch {}
        }
      }
      status = translator().t("guided.saved");
    } catch {
      if (!handle.signal.aborted) error = translator().t("guided.failed");
    } finally {
      pending = false;
      if (!handle.signal.aborted) {
        handle.update();
        await refresh();
      }
    }
  }
  return () => {
    if (handle.props.initial !== lastInitial) {
      lastInitial = handle.props.initial;
      if (lastInitial.revision >= data.revision) data = lastInitial;
    }
    let nextView = JSON.stringify(handle.props.initialView);
    if (nextView !== lastView) {
      lastView = nextView;
      let view = handle.props.initialView;
      if (view?.category && data.categories.some((c) => c.id === view.category))
        category = view.category;
      privateTopic = view?.topic ?? privateTopic;
      filter = view?.filter ?? filter;
    }
    if (!data.categories.some((c) => c.id === category))
      category = data.categories[0]?.id ?? "";
    const { t, formatNumber } = translator();
    let state = data.state,
      facilitator = data.memberId === data.board.organiserMemberId;
    let topics = sourceTopics(data),
      ranked = [...topics].sort(
        (a, b) => (data.counts[b.id] ?? 0) - (data.counts[a.id] ?? 0),
      );
    if (privateTopic && !ranked.some((topic) => topic.id === privateTopic))
      privateTopic = "";
    let sharedTopic = ranked.find((topic) => topic.id === state.liveTopic);
    let active =
        ranked.find((x) => x.id === privateTopic) ?? sharedTopic ?? ranked[0],
      mine = state.votes[data.memberId] ?? [];
    let currentCategory =
        data.categories.find((c) => c.id === category) ?? data.categories[0],
      shelf = Math.floor(data.categories.indexOf(currentCategory) / 3);
    let lanes =
      data.categories.length <= 4
        ? data.categories
        : data.categories.slice(shelf * 3, shelf * 3 + 3);
    const command = (
      kind: string,
      fields: CommandProps["fields"],
      label: string,
    ) => (
      <CommandForm data={data} kind={kind} fields={fields}>
        <button
          disabled={
            pending ||
            (kind === "advance" && state.stage === "vote" && state.ballotOpen)
          }
        >
          {label}
        </button>
      </CommandForm>
    );
    function capture(card?: Card, topic?: Topic) {
      let detail = root().querySelector<HTMLDetailsElement>(
        "details[data-editor=action]",
      )!;
      detail.open = true;
      let form = detail.querySelector<HTMLFormElement>("form")!,
        text = form.querySelector<HTMLTextAreaElement>("textarea")!,
        select = form.querySelector(
          "select[name=topic]",
        ) as unknown as HTMLSelectElement;
      if (!text.value.trim()) {
        if (card) text.value = card.body;
        select.value =
          (
            topic ??
            topics.find((topic) => card && topic.notes.includes(card.id))
          )?.id ?? "";
      }
      text.focus();
      save(form);
      persist();
      detail.scrollIntoView({ block: "start" });
    }
    function recordDecision(topic: Topic) {
      let detail = root().querySelector<HTMLDetailsElement>(
        'details[data-editor="decision"]',
      )!;
      detail.open = true;
      let form = detail.querySelector<HTMLFormElement>("form")!,
        text = form.querySelector<HTMLTextAreaElement>("textarea")!,
        select = form.querySelector(
          'select[name="topic"]',
        ) as unknown as HTMLSelectElement;
      if (!text.value.trim()) {
        select.value = topic.id;
        text.value = state.decisions[topic.id] ?? "";
      }
      text.focus();
      save(form);
      persist();
      detail.scrollIntoView({ block: "start" });
    }
    const note = (card: Card, select = false) => (
      <NoteCard
        key={card.id}
        data={data}
        locale={handle.props.locale}
        card={card}
        select={select}
        rootId={rootId}
        onCapture={(card) =>
          capture(
            card,
            topics.find((topic) => topic.notes.includes(card.id)),
          )
        }
      />
    );
    const evidence = (topic: Topic) => (
      <Evidence data={data} locale={handle.props.locale} topic={topic} />
    );
    const actionCard = (proposal: Proposal, historical = false) => (
      <ActionCard
        key={proposal.id}
        data={data}
        locale={handle.props.locale}
        proposal={proposal}
        historical={historical}
        pending={pending}
      />
    );
    function matches(p: Proposal, value: string) {
      return (
        value === "all" ||
        (value === "mine" && p.owner === data.memberId) ||
        (value === "open" && p.disposition === "agreed" && !p.completed) ||
        (value === "completed" && p.disposition === "agreed" && p.completed) ||
        p.disposition === value
      );
    }
    let filtered = state.proposals.filter((p) => matches(p, filter));
    let invite = new URL(
      routes.joinBoard.index.href({ boardId: data.board.id }),
      handle.props.origin,
    ).href;
    async function copy(value: string) {
      try {
        await navigator.clipboard.writeText(value);
        status = t("guided.copied");
      } catch {
        error = t("guided.copyFailed");
      }
      handle.update();
    }
    const summaryText = () => {
      const record = state.closure;
      const source = record?.cards ?? data.cards;
      const names = new Map(
        data.members.map((member) => [member.id, member.displayName]),
      );
      const date = (value: string) =>
        new Intl.DateTimeFormat(handle.props.locale, {
          dateStyle: "medium",
          timeZone: "UTC",
        }).format(new Date(value));
      return [
        data.board.title,
        t("guided.history"),
        record
          ? t("guided.closedAt", {
              date: new Intl.DateTimeFormat(handle.props.locale, {
                dateStyle: "long",
                timeStyle: "short",
              }).format(new Date(record.at)),
            })
          : t("guided.legacyHistory"),
        ...(record?.topics ?? ranked).flatMap((topic) => [
          topic.title,
          t(
            `guided.${record?.outcomes[topic.id] ?? "unaddressed"}` as "guided.unaddressed",
          ),
          record?.decisions[topic.id] ?? t("guided.noDecision"),
          ...topic.notes.flatMap((id) => {
            let card = source.find((c) => c.id === id);
            return card
              ? [
                  card.body,
                  `${data.categories.find((c) => c.id === card.categoryId)?.label ?? ""} · ${card.isAnonymous ? t("cards.anonymous") : (names.get(card.memberId) ?? "")}`,
                ]
              : [];
          }),
        ]),
        ...(record?.proposals ?? []).map(
          (p) =>
            `${p.text} — ${t(`guided.${p.disposition}`)} · ${names.get(p.owner) ?? t("guided.unassigned")}${p.due ? ` · ${date(p.due)}` : ""}${p.topic ? ` · ${(record?.topics ?? ranked).find((topic) => topic.id === p.topic)?.title ?? ""}` : ""}`,
        ),
      ].join("\n\n");
    };
    return (
      <main
        id={rootId}
        class="workspace"
        data-stage={state.stage}
        data-setup={
          state.categorySetup?.confirmed === false ? "pending" : "ready"
        }
        aria-busy={pending}
        mix={[
          on("submit", (event) => {
            let form = event.target;
            if (
              form instanceof HTMLFormElement &&
              form.hasAttribute("data-view-form")
            ) {
              event.preventDefault();
              let values = new FormData(form);
              if (values.has("category"))
                category = String(values.get("category"));
              if (values.has("filter")) filter = String(values.get("filter"));
              if (values.has("topic")) {
                privateTopic = String(values.get("topic"));
                expanded = false;
              }
              persist();
              handle.update();
              return;
            }
            if (
              form instanceof HTMLFormElement &&
              (form.classList.contains("command-form") ||
                form.dataset.draft === "note")
            ) {
              event.preventDefault();
              void submit(form, event.submitter);
            }
          }),
          on("change", (event) => {
            let el = event.target;
            if (el instanceof HTMLSelectElement && el.dataset.view) {
              if (el.dataset.view === "category") category = el.value;
              if (el.dataset.view === "topic") {
                privateTopic = el.value;
                expanded = false;
              }
              if (el.dataset.view === "filter") filter = el.value;
              persist();
              handle.update();
            }
          }),
          on("input", (event) => {
            if (event.target instanceof HTMLElement) {
              let form = event.target.closest("form");
              if (form) save(form);
            }
          }),
        ]}
      >
        <header class="board-heading">
          <div>
            <h1 dir="auto">{data.board.title}</h1>
            <p>
              {facilitator ? t("guided.facilitator") : t("guided.participant")}{" "}
              · {t("guided.joined", { count: data.members.length })}
            </p>
          </div>
          <details class="invitation">
            <summary>{t("guided.invite")}</summary>
            <label>
              {t("guided.invite")}
              <input readOnly value={invite} />
            </label>
            <button
              class="js-only"
              type="button"
              mix={on("click", () => void copy(invite))}
            >
              {t("guided.copy")}
            </button>
            <p>{t("guided.identityNotice")}</p>
          </details>
        </header>
        {state.legacy && (
          <details class="legacy-evidence">
            <summary>{t("guided.legacy")}</summary>
            <p>{t("guided.legacyVotesHint")}</p>
            <ul>
              {data.cards.map((card) => (
                <li key={card.id}>
                  <bdi>{card.body}</bdi> ·{" "}
                  {t("guided.votes", {
                    count: data.legacyCardVotes[card.id] ?? 0,
                  })}
                </li>
              ))}
            </ul>
          </details>
        )}
        {state.categorySetup?.confirmed === false ? (
          <CategorySetup
            data={data}
            locale={handle.props.locale}
            pending={pending}
            error={error}
          />
        ) : (
          <>
            <ol class="stage-rail" tabIndex={0} aria-label={t("guided.stages")}>
              {stages.map((stage, i) => (
                <li
                  key={stage}
                  aria-current={stage === state.stage ? "step" : undefined}
                >
                  {formatNumber(i + 1)} {t(`guided.${stage}`)}
                </li>
              ))}
            </ol>
            <div class="session-status" role="status" aria-live="polite">
              {status}
            </div>
            {error && (
              <p role="alert" class="error">
                {error}{" "}
                <button
                  type="button"
                  mix={on("click", () => void refresh(true))}
                >
                  {t("guided.reviewLatest")}
                </button>
              </p>
            )}
            <div class="stage-heading">
              <div>
                <h2>{t(`guided.${state.stage}`)}</h2>
                {state.stage === "collect" && (
                  <p class="stage-description">{t("collect.intro")}</p>
                )}
              </div>
              {facilitator &&
                state.stage !== "summary" &&
                command(
                  "advance",
                  {},
                  state.stage === "actions"
                    ? t("guided.closeMeeting")
                    : t("guided.next", {
                        stage: t(
                          `guided.${stages[stages.indexOf(state.stage) + 1]}`,
                        ),
                      }),
                )}
            </div>
            {state.stage === "collect" && (
              <section>
                <div
                  class="collect-toolbar"
                  data-categories={data.categories.length}
                >
                  <form method="get" data-view-form>
                    <label>
                      {t("guided.category")}
                      <select
                        name="category"
                        defaultValue={category}
                        data-view="category"
                      >
                        {data.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label} (
                            {formatNumber(
                              data.cards.filter((n) => n.categoryId === c.id)
                                .length,
                            )}
                            )
                          </option>
                        ))}
                      </select>
                    </label>
                    <button>{t("guided.refresh")}</button>
                  </form>
                  <a
                    class="primary add-note"
                    href={`${routes.newCard.index.href({ boardId: data.board.id })}?category=${category}`}
                    mix={on("click", (e) => {
                      e.preventDefault();
                      openNote();
                    })}
                  >
                    {t("guided.add")}
                  </a>
                  {command(
                    "ready",
                    { value: !state.ready[data.memberId] },
                    state.ready[data.memberId]
                      ? `✓ ${t("guided.notReady")}`
                      : t("guided.done"),
                  )}
                  <span class="readiness-count">
                    {t("guided.doneCount", { count: data.doneCount })}
                  </span>
                  <span class="note-total">
                    {t("collect.total", { count: data.cards.length })}
                  </span>
                </div>
                <div class="lanes" data-lanes={lanes.length}>
                  {lanes.map((cat) => (
                    <section
                      key={cat.id}
                      class="lane"
                      data-tone={cat.tone ?? 0}
                      data-active={
                        cat.id === currentCategory.id ? "true" : "false"
                      }
                    >
                      <h3 dir="auto">
                        {cat.label}{" "}
                        <span class="count">
                          {formatNumber(
                            data.cards.filter((c) => c.categoryId === cat.id)
                              .length,
                          )}
                        </span>
                      </h3>
                      <div class="note-stack">
                        {data.cards
                          .filter((c) => c.categoryId === cat.id)
                          .map((c) => note(c))}
                        {!data.cards.some((c) => c.categoryId === cat.id) && (
                          <div class="lane-empty">
                            <span class="empty-note-mark" aria-hidden="true">
                              <svg viewBox="0 0 40 48" fill="none">
                                <path
                                  d="M7 1h18l13 13v31a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a5 5 0 0 1 5-5Z"
                                  stroke="currentColor"
                                />
                                <path
                                  d="M25 1v13h13M11 26h18M11 33h12"
                                  stroke="currentColor"
                                />
                              </svg>
                            </span>
                            <strong>{t("guided.emptyNotes")}</strong>
                            <p>{t("collect.emptyHint")}</p>
                          </div>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            )}
            {(state.stage === "collect" || state.stage === "group") &&
              facilitator && (
                <details class="settings">
                  <summary>
                    {t("collect.settings")} · {t("guided.budget")}:{" "}
                    {formatNumber(state.budget)}
                  </summary>
                  <CommandForm data={data} kind="budget">
                    <label>
                      {t("guided.budget")}
                      <input
                        type="number"
                        name="value"
                        min={1}
                        max={20}
                        defaultValue={state.budget}
                        required
                      />
                    </label>
                    <button disabled={pending}>{t("guided.setBudget")}</button>
                  </CommandForm>
                </details>
              )}
            {state.stage === "group" && (
              <section>
                <p>{t("guided.groupHint")}</p>
                {facilitator && (
                  <a
                    class="group-selection primary"
                    href={`#${rootId}-group-themes`}
                  >
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
                    <div class="note-grid">
                      {data.cards
                        .filter(
                          (c) =>
                            !state.themes.some((theme) =>
                              theme.notes.includes(c.id),
                            ),
                        )
                        .map((c) => note(c, facilitator))}
                    </div>
                  </section>
                  <section id={`${rootId}-group-themes`}>
                    <h3>{t("guided.themes")}</h3>
                    {facilitator && (
                      <CommandForm
                        data={data}
                        kind="theme"
                        draft="theme"
                        id={`${rootId}-theme`}
                      >
                        <label>
                          {t("guided.themeTitle")}
                          <input
                            name="title"
                            maxLength={160}
                            required
                            dir="auto"
                          />
                        </label>
                        <button disabled={pending}>
                          {t("guided.makeTheme")}
                        </button>
                      </CommandForm>
                    )}
                    {state.themes.map((theme) => (
                      <article key={theme.id} class="topic-card">
                        <h4 dir="auto">{theme.title}</h4>
                        {facilitator && (
                          <button
                            type="submit"
                            form={`${rootId}-theme`}
                            name="theme"
                            value={theme.id}
                            formNoValidate
                            disabled={pending}
                            aria-label={t("guided.addToNamedTheme", {
                              title: theme.title,
                            })}
                          >
                            {t("guided.addToTheme")}
                          </button>
                        )}
                        {evidence(theme)}
                        {facilitator && (
                          <>
                            <CommandForm
                              data={data}
                              kind="rename"
                              fields={{ theme: theme.id }}
                            >
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
                              <button disabled={pending}>
                                {t("guided.rename")}
                              </button>
                            </CommandForm>
                            {command(
                              "ungroup",
                              { theme: theme.id },
                              t("guided.ungroup"),
                            )}
                          </>
                        )}
                      </article>
                    ))}
                  </section>
                </div>
              </section>
            )}
            {state.stage === "vote" && (
              <section>
                <div class="vote-toolbar">
                  <strong>
                    {t("guided.allowance", {
                      used: mine.length,
                      max: state.budget,
                    })}
                  </strong>
                  <span>
                    {state.ballotOpen
                      ? t("guided.hidden")
                      : t("guided.ballotClosed")}
                  </span>
                  {state.ballotOpen &&
                    command(
                      "ready",
                      { value: !state.ready[data.memberId] },
                      state.ready[data.memberId]
                        ? `✓ ${t("guided.notReady")}`
                        : t("guided.ready"),
                    )}
                  <span>
                    {t("guided.readyCount", { count: data.doneCount })}
                  </span>
                  {facilitator &&
                    command(
                      "ballot",
                      { ballot: state.ballot, value: !state.ballotOpen },
                      t(
                        state.ballotOpen
                          ? "guided.closeBallot"
                          : "guided.reopen",
                      ),
                    )}
                </div>
                {mine.length >= state.budget && <p>{t("guided.allUsed")}</p>}
                <div class="topic-grid">
                  {topics.map((topic) => (
                    <article
                      key={topic.id}
                      class="topic-card"
                      data-tone={
                        !state.themes.some((theme) => theme.id === topic.id)
                          ? data.categories.find(
                              (cat) =>
                                cat.id ===
                                data.cards.find((c) => c.id === topic.notes[0])
                                  ?.categoryId,
                            )?.tone
                          : undefined
                      }
                      data-selected={mine.includes(topic.id) ? "true" : "false"}
                    >
                      <h3 dir="auto">{topic.title}</h3>
                      {evidence(topic)}
                      {state.ballotOpen ? (
                        <CommandForm
                          data={data}
                          kind="vote"
                          fields={{
                            topic: topic.id,
                            ballot: state.ballot,
                            value: !mine.includes(topic.id),
                          }}
                        >
                          <button
                            aria-pressed={mine.includes(topic.id)}
                            disabled={
                              pending ||
                              (!mine.includes(topic.id) &&
                                mine.length >= state.budget)
                            }
                          >
                            {mine.includes(topic.id)
                              ? `✓ ${t("guided.remove")}`
                              : t("guided.select")}
                          </button>
                        </CommandForm>
                      ) : (
                        <p>
                          {t("guided.votes", {
                            count: data.counts[topic.id] ?? 0,
                          })}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
                {!topics.length && <p>{t("guided.noTopics")}</p>}
              </section>
            )}
            {state.stage === "discuss" && (
              <section
                class="discussion-workspace"
                aria-label={t("guided.discuss")}
              >
                {(privateTopic || !sharedTopic) && (
                  <div
                    class="discussion-context"
                    data-private={privateTopic ? "true" : "false"}
                  >
                    <div aria-live="polite" aria-atomic="true">
                      <span class="eyebrow">
                        {t(
                          sharedTopic
                            ? "discuss.teamTopic"
                            : "discuss.noShared",
                        )}
                      </span>
                      {sharedTopic && (
                        <strong dir="auto">{sharedTopic.title}</strong>
                      )}
                      {privateTopic && <p>{t("discuss.privateHint")}</p>}
                    </div>
                    {privateTopic && sharedTopic && (
                      <a
                        href={routes.board.href({ boardId: data.board.id })}
                        mix={on("click", (event) => {
                          event.preventDefault();
                          privateTopic = "";
                          expanded = false;
                          persist();
                          handle.update();
                        })}
                      >
                        {t("guided.follow")}
                      </a>
                    )}
                  </div>
                )}
                <div class="discussion-layout">
                  <aside
                    class="agenda discussion-agenda"
                    aria-label={t("guided.agenda")}
                  >
                    <h3>{t("guided.agenda")}</h3>
                    <form method="get" data-view-form>
                      <label>
                        {t("discuss.browse")}
                        <select name="topic" data-view="topic">
                          {ranked.map((topic, i) => (
                            <option
                              key={topic.id}
                              value={topic.id}
                              selected={topic.id === active?.id}
                            >
                              {formatNumber(i + 1)}. {topic.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button>{t("discuss.browse")}</button>
                    </form>
                    <ol>
                      {ranked.map((topic, i) => (
                        <li
                          key={topic.id}
                          data-live={
                            topic.id === sharedTopic?.id ? "true" : "false"
                          }
                        >
                          <a
                            href={`?topic=${topic.id}`}
                            aria-current={
                              topic.id === active?.id ? "true" : undefined
                            }
                            mix={on("click", (event) => {
                              event.preventDefault();
                              privateTopic = topic.id;
                              expanded = false;
                              persist();
                              handle.update();
                            })}
                          >
                            <span class="agenda-number" aria-hidden="true">
                              {formatNumber(i + 1)}
                            </span>
                            <span class="agenda-title">
                              <bdi>{topic.title}</bdi>
                              {topic.id === sharedTopic?.id && (
                                <span class="agenda-live">
                                  {t("discuss.current")}
                                </span>
                              )}
                            </span>
                          </a>
                          <span class="agenda-outcome">
                            {state.outcomes[topic.id]
                              ? t(`guided.${state.outcomes[topic.id]}`)
                              : t("discuss.noOutcome")}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </aside>
                  <section
                    class="discussion-subject"
                    aria-labelledby={`${rootId}-discussion-title`}
                    data-topic={active?.id}
                    data-following={
                      !privateTopic && sharedTopic ? "true" : "false"
                    }
                  >
                    {active ? (
                      <>
                        <header class="discussion-topic-header">
                          <div class="discussion-topic-label">
                            <span class="discussion-mode">
                              {t(
                                privateTopic || !sharedTopic
                                  ? "discuss.viewing"
                                  : "discuss.now",
                              )}
                            </span>
                            <span class="discussion-position">
                              {t("discuss.position", {
                                current: ranked.indexOf(active) + 1,
                                total: ranked.length,
                              })}
                            </span>
                          </div>
                          <h3
                            id={`${rootId}-discussion-title`}
                            dir="auto"
                            aria-live="polite"
                            aria-atomic="true"
                          >
                            {active.title}
                          </h3>
                          <div class="discussion-topic-meta">
                            <span>
                              {t("board.tabCount", {
                                count: active.notes.length,
                              })}
                            </span>
                            {state.ballot > 0 && (
                              <span>
                                {t("vote.count", {
                                  count: data.counts[active.id] ?? 0,
                                })}
                              </span>
                            )}
                          </div>
                          {(privateTopic || !sharedTopic) &&
                            facilitator &&
                            active.id !== sharedTopic?.id &&
                            command(
                              "live",
                              { topic: active.id },
                              t("guided.share"),
                            )}
                        </header>
                        <section
                          class="discussion-feedback"
                          aria-labelledby={`${rootId}-feedback-title`}
                        >
                          <h4 id={`${rootId}-feedback-title`}>
                            {t("discuss.feedback")}
                          </h4>
                          <div class="note-stack">
                            {active.notes
                              .slice(0, 2)
                              .map((id) => data.cards.find((c) => c.id === id))
                              .filter((c): c is Card => !!c)
                              .map((c) => note(c))}
                          </div>
                          {active.notes.length > 2 && (
                            <details class="more-notes">
                              <summary>{t("guided.showAll")}</summary>
                              <div class="note-stack">
                                {active.notes
                                  .slice(2)
                                  .map((id) =>
                                    data.cards.find((c) => c.id === id),
                                  )
                                  .filter((c): c is Card => !!c)
                                  .map((c) => note(c))}
                              </div>
                            </details>
                          )}
                        </section>
                        <section
                          class="discussion-record"
                          aria-label={t("discuss.outcome")}
                        >
                          <div class="discussion-outcome">
                            <h4>{t("discuss.outcome")}</h4>
                            <span
                              class="discussion-outcome-label"
                              data-outcome={
                                state.outcomes[active.id] ?? "unaddressed"
                              }
                            >
                              {state.outcomes[active.id]
                                ? t(`guided.${state.outcomes[active.id]}`)
                                : t("discuss.noOutcome")}
                            </span>
                            {facilitator && (
                              <div class="control-row">
                                {command(
                                  "outcome",
                                  { topic: active.id, value: "discussed" },
                                  t("guided.markDiscussed"),
                                )}
                                {command(
                                  "outcome",
                                  { topic: active.id, value: "skipped" },
                                  t("guided.skip"),
                                )}
                              </div>
                            )}
                          </div>
                          <div class="discussion-decision">
                            <h4>{t("discuss.decision")}</h4>
                            <p dir="auto">
                              {state.decisions[active.id] ??
                                t("guided.noDecision")}
                            </p>
                            {facilitator && (
                              <a
                                class="discussion-record-link"
                                href={`?topic=${active.id}&decision=${active.id}#${rootId}-decision`}
                                mix={on("click", (event) => {
                                  event.preventDefault();
                                  recordDecision(active);
                                })}
                              >
                                {t("guided.recordDecision")}
                              </a>
                            )}
                          </div>
                        </section>
                        <div class="topic-navigation">
                          <a
                            aria-disabled={
                              ranked.indexOf(active) === 0 ? "true" : "false"
                            }
                            href={
                              ranked.indexOf(active) > 0
                                ? `?topic=${ranked[ranked.indexOf(active) - 1].id}`
                                : undefined
                            }
                            mix={on("click", (event) => {
                              event.preventDefault();
                              if (ranked.indexOf(active) > 0) {
                                privateTopic =
                                  ranked[ranked.indexOf(active) - 1].id;
                                expanded = false;
                                persist();
                                handle.update();
                              }
                            })}
                          >
                            {t("guided.previous")}
                          </a>
                          <a
                            aria-disabled={
                              ranked.indexOf(active) === ranked.length - 1
                                ? "true"
                                : "false"
                            }
                            href={
                              ranked.indexOf(active) < ranked.length - 1
                                ? `?topic=${ranked[ranked.indexOf(active) + 1].id}`
                                : undefined
                            }
                            mix={on("click", (event) => {
                              event.preventDefault();
                              if (ranked.indexOf(active) < ranked.length - 1) {
                                privateTopic =
                                  ranked[ranked.indexOf(active) + 1].id;
                                expanded = false;
                                persist();
                                handle.update();
                              }
                            })}
                          >
                            {t("guided.nextTopic")}
                          </a>
                        </div>
                      </>
                    ) : (
                      <div class="empty-state">
                        <p>{t("guided.noTopics")}</p>
                      </div>
                    )}
                  </section>
                  <aside
                    class="discussion-actions"
                    aria-label={t("discuss.actions")}
                  >
                    <div class="discussion-actions-heading">
                      <h3>{t("discuss.actions")}</h3>
                      <a
                        href={`?topic=${active?.id ?? ""}&capture=${active?.id ?? ""}#${rootId}-capture`}
                        mix={on("click", (event) => {
                          event.preventDefault();
                          capture(undefined, active);
                        })}
                      >
                        {t(
                          facilitator
                            ? "guided.addAction"
                            : "guided.suggestAction",
                        )}
                      </a>
                    </div>
                    {!state.proposals.some((p) => p.topic === active?.id) && (
                      <p class="discussion-empty-actions">
                        {t("discuss.noActions")}
                      </p>
                    )}
                    <div class="action-grid compact">
                      {state.proposals
                        .filter((p) => p.topic === active?.id)
                        .map((p) => actionCard(p))}
                    </div>
                    {state.proposals.length > 0 && (
                      <details class="review-actions">
                        <summary>{t("guided.reviewActions")}</summary>
                        <div class="action-grid compact">
                          {state.proposals.map((p) => actionCard(p))}
                        </div>
                      </details>
                    )}
                  </aside>
                </div>
              </section>
            )}
            {(state.stage === "actions" || state.stage === "summary") && (
              <section>
                {state.stage === "summary" && (
                  <section class="meeting-record">
                    <h3>{t("guided.history")}</h3>
                    {state.closure ? (
                      <>
                        <p>
                          {t("guided.closedAt", {
                            date: new Intl.DateTimeFormat(
                              numberLocaleFor(handle.props.locale),
                              {
                                dateStyle: "long",
                                timeStyle: "short",
                              },
                            ).format(new Date(state.closure.at)),
                          })}
                        </p>
                        <p>{t("guided.unresolved")}</p>
                        <div class="control-row">
                          <button
                            class="js-only"
                            type="button"
                            mix={on("click", () => window.print())}
                          >
                            {t("guided.print")}
                          </button>
                          <button
                            class="js-only"
                            type="button"
                            mix={on("click", () => void copy(summaryText()))}
                          >
                            {t("guided.copySummary")}
                          </button>
                        </div>
                        {state.closure.topics.map((topic) => (
                          <article key={topic.id} class="topic-card">
                            <h4 dir="auto">{topic.title}</h4>
                            <p>
                              {t(
                                `guided.${state.closure!.outcomes[topic.id] ?? "unaddressed"}` as "guided.unaddressed",
                              )}
                            </p>
                            <p dir="auto">
                              {state.closure!.decisions[topic.id] ??
                                t("guided.noDecision")}
                            </p>
                            {evidence(topic)}
                          </article>
                        ))}
                        <div class="action-grid">
                          {state.closure.proposals.map((p) =>
                            actionCard(p, true),
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <p>{t("guided.legacyHistory")}</p>
                        <div class="note-grid">
                          {data.cards.map((c) => note(c))}
                        </div>
                      </>
                    )}
                  </section>
                )}
                {state.stage === "summary" && (
                  <h3>{t("guided.currentProgress")}</h3>
                )}
                <p>
                  {t("guided.actionCounts", {
                    agreed: state.proposals.filter(
                      (p) => p.disposition === "agreed",
                    ).length,
                    pending: state.proposals.filter(
                      (p) => p.disposition === "suggested",
                    ).length,
                  })}
                </p>
                <div class="actions-toolbar">
                  <form method="get" data-view-form>
                    <label>
                      {t("guided.filter")}
                      <select
                        name="filter"
                        defaultValue={filter}
                        data-view="filter"
                      >
                        {(
                          [
                            "all",
                            "suggested",
                            "agreed",
                            "deferred",
                            "declined",
                            "open",
                            "completed",
                            "mine",
                          ] as const
                        ).map((value) => (
                          <option key={value} value={value}>
                            {t(`guided.${value}`)} (
                            {formatNumber(
                              state.proposals.filter((p) => matches(p, value))
                                .length,
                            )}
                            )
                          </option>
                        ))}
                      </select>
                    </label>
                    <button>{t("guided.refresh")}</button>
                  </form>
                  {state.stage === "actions" && (
                    <a
                      class="primary"
                      href={`?capture=${active?.id ?? ""}#${rootId}-capture`}
                      mix={on("click", (event) => {
                        event.preventDefault();
                        capture(undefined, active);
                      })}
                    >
                      {t(
                        facilitator
                          ? "guided.addAction"
                          : "guided.suggestAction",
                      )}
                    </a>
                  )}
                </div>
                <p>
                  {t("guided.shown", {
                    shown: filtered.length,
                    total: state.proposals.length,
                  })}
                </p>
                <div class="action-grid">
                  {filtered.map((p) => actionCard(p))}
                </div>
                {!filtered.length && (
                  <div class="empty-state">
                    <p>
                      {t(
                        state.proposals.length
                          ? "guided.noMatch"
                          : "guided.noActions",
                      )}
                    </p>
                    {filter !== "all" && (
                      <a
                        href={routes.board.href({ boardId: data.board.id })}
                        mix={on("click", (event) => {
                          event.preventDefault();
                          filter = "all";
                          handle.update();
                        })}
                      >
                        {t("guided.showAllActions")}
                      </a>
                    )}
                  </div>
                )}
              </section>
            )}
            <section id={`${rootId}-capture-wrapper`} class="capture-editors">
              <details
                data-editor="action"
                open={
                  !!handle.props.initialView?.capture &&
                  topics.some(
                    (topic) => topic.id === handle.props.initialView?.capture,
                  )
                }
              >
                <summary>
                  {t(facilitator ? "guided.addAction" : "guided.suggestAction")}
                </summary>
                <CommandForm data={data} kind="propose" draft="action">
                  <label>
                    {t("guided.actionText")}
                    <textarea
                      id={`${rootId}-capture`}
                      defaultValue={
                        data.cards.find(
                          (card) =>
                            card.id === handle.props.initialView?.captureNote,
                        )?.body ?? ""
                      }
                      name="text"
                      rows={4}
                      maxLength={500}
                      required
                      dir="auto"
                    />
                  </label>
                  <label>
                    {t("guided.agenda")}
                    <select name="topic">
                      <option value="" selected={!initialCaptureTopic}>
                        {t("guided.unassigned")}
                      </option>
                      {topics.map((topic) => (
                        <option
                          key={topic.id}
                          value={topic.id}
                          selected={topic.id === initialCaptureTopic}
                        >
                          {topic.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("guided.owner")}
                    <input
                      name="ownerSearch"
                      list={`${rootId}-members`}
                      autoComplete="off"
                    />
                    <datalist id={`${rootId}-members`}>
                      {data.members.map((m) => (
                        <option key={m.id} value={m.displayName} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    {t("guided.due")}
                    <input name="due" type="date" />
                  </label>
                  {error && (
                    <p role="alert" class="error">
                      {error}
                      {needsJoin && (
                        <a
                          href={routes.joinBoard.index.href({
                            boardId: data.board.id,
                          })}
                        >
                          {t("join.submit")}
                        </a>
                      )}
                    </p>
                  )}
                  <button
                    class="primary"
                    disabled={
                      pending || !["discuss", "actions"].includes(state.stage)
                    }
                  >
                    {t(
                      facilitator ? "guided.addAction" : "guided.suggestAction",
                    )}
                  </button>
                </CommandForm>
              </details>
              <details
                data-editor="decision"
                open={
                  facilitator &&
                  state.stage === "discuss" &&
                  topics.some(
                    (topic) => topic.id === handle.props.initialView?.decision,
                  )
                }
              >
                <summary>{t("guided.recordDecision")}</summary>
                <CommandForm data={data} kind="decision" draft="decision">
                  <label>
                    {t("guided.agenda")}
                    <select name="topic" required>
                      {topics.map((topic) => (
                        <option
                          key={topic.id}
                          value={topic.id}
                          selected={topic.id === initialDecisionTopic}
                        >
                          {topic.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("guided.decision")}
                    <textarea
                      id={`${rootId}-decision`}
                      name="text"
                      rows={4}
                      maxLength={2000}
                      required
                      dir="auto"
                    />
                  </label>
                  {error && (
                    <p role="alert" class="error">
                      {error}
                      {needsJoin && (
                        <a
                          href={routes.joinBoard.index.href({
                            boardId: data.board.id,
                          })}
                        >
                          {t("join.submit")}
                        </a>
                      )}
                    </p>
                  )}
                  <button
                    class="primary"
                    disabled={
                      pending || !facilitator || state.stage !== "discuss"
                    }
                  >
                    {t("guided.recordDecision")}
                  </button>
                </CommandForm>
              </details>
            </section>
          </>
        )}
        <dialog
          aria-labelledby={`${rootId}-note-title`}
          mix={on("cancel", (e) => {
            e.preventDefault();
            closeNote();
          })}
        >
          <h2 id={`${rootId}-note-title`}>{t("guided.add")}</h2>
          <form
            data-draft="note"
            method="post"
            action={routes.newCard.action.href({ boardId: data.board.id })}
          >
            <input
              type="hidden"
              name="submissionId"
              defaultValue={submission}
            />
            <label>
              {t("form.category")}
              <select name="categoryId" defaultValue={category}>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("form.note")}
              <textarea
                name="text"
                dir="auto"
                rows={7}
                maxLength={500}
                required
                aria-describedby={`${rootId}-count`}
                mix={on("input", (e) => {
                  let count = root().querySelector("[data-note-count]");
                  if (count)
                    count.textContent = t("form.counter", {
                      count: e.currentTarget.value.length,
                      max: 500,
                    });
                })}
              />
            </label>
            <p id={`${rootId}-count`} data-note-count>
              {t("form.counter", { count: 0, max: 500 })}
            </p>
            <label class="checkbox">
              <input type="checkbox" name="isAnonymous" value="true" />
              {t("form.anonymous")}
            </label>
            <p>{t("guided.privacy")}</p>
            {state.categorySetup?.confirmed === false && (
              <p>{t("setup.required")}</p>
            )}
            {state.stage !== "collect" && <p>{t("guided.collectOnly")}</p>}
            {error && (
              <p role="alert" class="error">
                {error}
                {needsJoin && (
                  <a
                    href={routes.joinBoard.index.href({
                      boardId: data.board.id,
                    })}
                  >
                    {t("join.submit")}
                  </a>
                )}
              </p>
            )}
            <button
              class="primary"
              disabled={
                pending ||
                state.stage !== "collect" ||
                state.categorySetup?.confirmed === false
              }
            >
              {pending ? t("guided.saving") : t("guided.post")}
            </button>
          </form>
          <div class="control-row">
            <button type="button" mix={on("click", closeNote)}>
              {t("guided.close")}
            </button>
            <button
              type="button"
              disabled={pending}
              mix={on("click", () => {
                if (confirm(t("guided.discardConfirm"))) {
                  let f = noteDialog().querySelector("form")!;
                  f.reset();
                  submission = crypto.randomUUID();
                  (
                    f.elements.namedItem("submissionId") as HTMLInputElement
                  ).value = submission;
                  save(f);
                  closeNote();
                }
              })}
            >
              {t("guided.discard")}
            </button>
          </div>
        </dialog>
      </main>
    );
  };
}
