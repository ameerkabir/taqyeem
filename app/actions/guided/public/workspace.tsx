import { CategorySetup } from "./category-setup.tsx";
import { CommandForm, type CommandProps } from "./command-form.tsx";
import { NoteCard, Evidence, ActionCard } from "./cards.tsx";
import { clientEntry, on, type Handle } from "remix/component";
import { routes } from "../../../routes.ts";
import { createTranslator } from "../../../i18n/translator.ts";
import { numberLocaleFor } from "../../../i18n/locales.ts";
import type { Locale } from "../../../i18n/locales.ts";
import type { ViewerPayload } from "../payload.ts";
import type { Card } from "../../../data/board.ts";
import type {
  Proposal,
  MeetingRecord,
} from "../../../models/guided/session.ts";
import {
  topics as sourceTopics,
  type Topic,
} from "../../../models/guided/topics.ts";
import { createSessionStore } from "../../../ui/session-store.ts";
import { createDraftStore } from "../client/draft-store.ts";
import { createNoteDrag } from "../client/note-drag.ts";
import { expandForPrint, startPolling } from "../client/page-lifecycle.ts";
import { formSignature } from "../client/form-signature.ts";
import { laneLayout } from "../client/lanes.ts";
import {
  canFilterActions,
  matchesActionFilter,
  parseActionFilter,
} from "../client/action-filter.ts";
import { buildSummaryText } from "../client/summary-text.ts";
import { formatDate } from "../../../i18n/format-date.ts";
import { stages, reviewStage } from "../../../models/guided/stages.ts";

type WorkspaceProps = {
  origin: string;
  initial: ViewerPayload;
  locale: Locale;
  record?: MeetingRecord | null;
  initialView?: {
    category: string;
    topic: string;
    filter: string;
    capture?: string;
    captureNote?: string;
    decision?: string;
    step?: string;
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
    filter: string = parseActionFilter(handle.props.initialView?.filter),
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
  function viewing() {
    const stage = handle.props.record
      ? "summary"
      : reviewStage(data.state.stage, handle.props.initialView?.step);
    return {
      stage,
      readOnly: !!handle.props.record || stage !== data.state.stage,
    };
  }
  function canMoveNotes() {
    return (
      data.memberId === data.board.organiserMemberId &&
      data.state.stage === "collect" &&
      data.state.categorySetup?.confirmed !== false &&
      data.categories.length > 1 &&
      !viewing().readOnly
    );
  }
  const drag = createNoteDrag({
    boardId: () => data.board.id,
    cards: () => data.cards,
    canMove: () => canMoveNotes() && !pending,
    root,
    update: () => handle.update(),
  });
  const storage = createSessionStore(prefix);
  const drafts = createDraftStore(storage);
  const get = storage.get;
  function save(form: HTMLFormElement) {
    let key = form.dataset.draft;
    if (!key) {
      return;
    }
    // The note editor only keeps a draft once it has been opened.
    if (key === "note" && !noteOpened && !get("note")) {
      return;
    }
    drafts.save(form, key);
  }
  function restore(form: HTMLFormElement) {
    let key = form.dataset.draft!;
    let saved = drafts.restore(form, key, root());
    if (!saved || key !== "note") {
      return;
    }
    noteOpened = true;
    let categoryField = form.elements.namedItem("categoryId");
    if (
      categoryField instanceof HTMLSelectElement &&
      !data.categories.some((c) => c.id === categoryField.value)
    ) {
      categoryField.value = category;
    }
    let field = form.elements.namedItem("text") as HTMLTextAreaElement;
    let count = root().querySelector("[data-note-count]");
    if (count) {
      count.textContent = translator().t("form.counter", {
        count: field.value.length,
        max: 500,
      });
    }
  }
  function persist() {
    for (let f of root().querySelectorAll<HTMLFormElement>("form[data-draft]"))
      save(f);
    storage.set(
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
        category = handle.props.initialView?.category || v.category || category;
        filter = v.filter ?? "all";
        expanded = !!v.expanded;
        if (
          v.open &&
          !viewing().readOnly &&
          data.state.categorySetup?.confirmed !== false
        )
          noteDialog().showModal();
        for (let d of root().querySelectorAll<HTMLDetailsElement>(
          "details[data-editor]",
        ))
          d.open = v.details?.includes(d.dataset.editor);
      }
    } catch {}
    for (let f of root().querySelectorAll<HTMLFormElement>("form[data-draft]"))
      restore(f);
    startPolling(
      handle.signal,
      (afterReconnect) => void refresh(afterReconnect),
      () => !pending && !needsJoin && document.visibilityState === "visible",
    );
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
    expandForPrint(
      root,
      "details.evidence,details.summary-agreement",
      handle.signal,
    );
    handle.update();
  });
  function openNote() {
    if (viewing().readOnly || data.state.categorySetup?.confirmed === false)
      return;
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
    if (viewing().readOnly) {
      error = translator().t("review.readOnly");
      handle.update();
      return;
    }
    save(form);
    let submitted = formSignature(form);
    // Capture the clicked theme button before pending UI disables it.
    let body = new FormData(form, submitter);
    pending = true;
    error = "";
    status = translator().t("guided.saving");
    handle.update();
    let applied = false;
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
        // The response is the committed session, so no follow-up poll is needed.
        applied = true;
        let kind = (form.elements.namedItem("kind") as HTMLInputElement).value;
        if (kind === "move-note") {
          category = String(body.get("categoryId"));
          persist();
        }
        if (kind === "live" || kind === "reopen") {
          privateTopic = "";
          expanded = false;
          persist();
        }
        if (
          ["theme", "propose", "decision"].includes(kind) &&
          formSignature(form) === submitted
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
          formSignature(form) === submitted;
        if (unchanged) form.reset();
        submission = crypto.randomUUID();
        (form.elements.namedItem("submissionId") as HTMLInputElement).value =
          submission;
        save(form);
        if (unchanged) {
          closeNote();
          noteOpened = false;
          storage.remove("note");
        }
      }
      status = translator().t("guided.saved");
    } catch {
      if (!handle.signal.aborted) error = translator().t("guided.failed");
    } finally {
      pending = false;
      if (error) status = "";
      if (!handle.signal.aborted) {
        handle.update();
        if (!applied) await refresh();
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
    const mode = viewing(),
      readOnly = mode.readOnly,
      archived = handle.props.record;
    let state = {
      ...data.state,
      stage: mode.stage,
      ...(archived
        ? {
            closure: archived.closure,
            closureVersion: archived.version,
            proposals: archived.closure.proposals,
          }
        : {}),
    };
    const displayData = {
      ...data,
      state,
      cards: archived?.closure.cards ?? data.cards,
      categories: archived?.closure.categories ?? data.categories,
    };
    const facilitator = data.memberId === data.board.organiserMemberId,
      canManage = facilitator && !readOnly;
    let topics = archived?.closure.topics ?? sourceTopics(data),
      ranked = [...topics].sort(
        (a, b) => (data.counts[b.id] ?? 0) - (data.counts[a.id] ?? 0),
      );
    if (privateTopic && !ranked.some((topic) => topic.id === privateTopic))
      privateTopic = "";
    let sharedTopic = ranked.find((topic) => topic.id === state.liveTopic);
    let active =
        ranked.find((x) => x.id === privateTopic) ?? sharedTopic ?? ranked[0],
      mine = state.votes[data.memberId] ?? [];
    let { current: currentCategory, lanes } = laneLayout(
      data.categories,
      category,
    );
    const command = (
      kind: string,
      fields: CommandProps["fields"],
      label: string,
    ) => (
      <CommandForm data={data} kind={kind} fields={fields}>
        <button
          disabled={
            pending ||
            readOnly ||
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
        data={displayData}
        locale={handle.props.locale}
        readOnly={readOnly}
        canMove={canMoveNotes()}
        pending={pending}
        dragging={drag.draggedId() === card.id}
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
      <Evidence data={displayData} locale={handle.props.locale} topic={topic} />
    );
    const actionCard = (proposal: Proposal, historical = false) => (
      <ActionCard
        key={proposal.id}
        data={displayData}
        locale={handle.props.locale}
        readOnly={readOnly}
        proposal={proposal}
        historical={historical}
        pending={pending}
      />
    );
    const matches = (p: Proposal, value: string) =>
      matchesActionFilter(p, value, data.memberId);
    const canFilter = canFilterActions(state.proposals.length);
    // A stale URL or saved choice must never hide items when the filter is absent.
    if (!archived && !canFilter) filter = "all";
    let filtered = state.proposals.filter((p) => matches(p, filter));
    function viewHref(values: Record<string, string> = {}) {
      const query = new URLSearchParams(values);
      if (readOnly && !archived) query.set("step", state.stage);
      return (
        routes.board.href({ boardId: data.board.id }) +
        (query.size ? `?${query}` : "")
      );
    }
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
    const summaryText = () =>
      buildSummaryText({
        boardTitle: data.board.title,
        closure: state.closure,
        closureVersion: state.closureVersion,
        ranked,
        cards: data.cards,
        categories: data.categories,
        members: data.members,
        t,
        locale: handle.props.locale,
      });
    return (
      <main
        id={rootId}
        class="workspace"
        data-stage={state.stage}
        data-shared-stage={data.state.stage}
        data-review={readOnly ? "true" : "false"}
        data-setup={
          state.categorySetup?.confirmed === false ? "pending" : "ready"
        }
        aria-busy={pending}
        mix={[
          on("dragstart", (event) => drag.handlers.dragStart(event)),
          on("dragover", (event) => drag.handlers.dragOver(event)),
          on("dragleave", (event) => drag.handlers.dragLeave(event)),
          on("dragend", () => drag.handlers.dragEnd()),
          on("drop", (event) => drag.handlers.drop(event)),
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
            if (
              el instanceof HTMLSelectElement &&
              el.hasAttribute("data-record-picker")
            ) {
              persist();
              el.form?.requestSubmit();
              return;
            }
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
        <div class="history-tools">
          {!!data.history?.length && (
            <form
              method="get"
              action={routes.board.href({ boardId: data.board.id })}
              class="history-navigation"
              mix={on("submit", () => persist())}
            >
              <label>
                {t("history.saved")}
                <select name="record" required data-record-picker>
                  <option value="" disabled selected={!handle.props.record}>
                    {t("history.choose")}
                  </option>
                  {data.history.map((record) => (
                    <option
                      key={record.version}
                      value={String(record.version)}
                      selected={record.version === handle.props.record?.version}
                    >
                      {t("history.version", { version: record.version })} ·{" "}
                      {formatDate(
                        numberLocaleFor(handle.props.locale),
                        record.closedAt,
                        "medium-time",
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <button>{t("history.view")}</button>
            </form>
          )}
        </div>
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
                  aria-current={stage === data.state.stage ? "step" : undefined}
                  data-viewed={stage === state.stage ? "true" : "false"}
                  data-state={
                    i < stages.indexOf(data.state.stage)
                      ? "completed"
                      : i === stages.indexOf(data.state.stage)
                        ? "current"
                        : "upcoming"
                  }
                >
                  {i <= stages.indexOf(data.state.stage) ? (
                    <a
                      href={
                        stage === data.state.stage
                          ? routes.board.href({ boardId: data.board.id })
                          : `?step=${stage}`
                      }
                      mix={on("click", () => persist())}
                    >
                      {formatNumber(i + 1)} {t(`guided.${stage}`)}
                    </a>
                  ) : (
                    <span aria-disabled="true">
                      {formatNumber(i + 1)} {t(`guided.${stage}`)}
                    </span>
                  )}
                </li>
              ))}
            </ol>
            {readOnly && (
              <div class="review-banner" role="status">
                <div>
                  <strong>
                    {handle.props.record
                      ? t("history.recordTitle", {
                          version: handle.props.record.version,
                        })
                      : t("review.title", {
                          stage: t(`guided.${state.stage}`),
                        })}
                  </strong>
                  <p>
                    {t("review.teamStage", {
                      stage: t(`guided.${data.state.stage}`),
                    })}{" "}
                    {t("review.readOnly")}
                  </p>
                </div>
                <a
                  href={routes.board.href({ boardId: data.board.id })}
                  mix={on("click", () => persist())}
                >
                  {t("review.back")}
                </a>
              </div>
            )}
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
                {state.stage === "collect" && !readOnly && (
                  <p class="stage-description">{t("collect.intro")}</p>
                )}
              </div>
              {canManage &&
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
                    {readOnly && !archived && (
                      <input type="hidden" name="step" value={state.stage} />
                    )}
                    <label>
                      {t("guided.category")}
                      <select name="category" data-view="category">
                        {data.categories.map((c) => (
                          <option
                            key={c.id}
                            value={c.id}
                            selected={c.id === category}
                          >
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
                  {!readOnly && (
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
                  )}
                  {!readOnly &&
                    command(
                      "ready",
                      { value: !state.ready[data.memberId] },
                      state.ready[data.memberId]
                        ? `✓ ${t("guided.notReady")}`
                        : t("guided.done"),
                    )}
                  {!readOnly && (
                    <span class="readiness-count">
                      {t("guided.doneCount", { count: data.doneCount })}
                    </span>
                  )}
                  <span class="note-total">
                    {t("collect.total", { count: data.cards.length })}
                  </span>
                </div>
                {canMoveNotes() && data.cards.length > 0 && (
                  <p class="note-move-hint">{t("collect.moveHint")}</p>
                )}
                <div class="lanes" data-lanes={lanes.length}>
                  {lanes.map((cat) => (
                    <section
                      key={cat.id}
                      class="lane"
                      data-category-id={cat.id}
                      data-drop-target={
                        canMoveNotes() && drag.dropCategory() === cat.id
                          ? "true"
                          : undefined
                      }
                      data-tone={cat.tone ?? 0}
                      data-active={
                        cat.id === currentCategory?.id ? "true" : "false"
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
                            {!readOnly && <p>{t("collect.emptyHint")}</p>}
                          </div>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            )}
            {(state.stage === "collect" || state.stage === "group") &&
              canManage && (
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
                <p>{t(readOnly ? "review.groupHint" : "guided.groupHint")}</p>
                {canManage && (
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
                        .map((c) => note(c, canManage))}
                    </div>
                  </section>
                  <section id={`${rootId}-group-themes`}>
                    <h3>{t("guided.themes")}</h3>
                    {canManage && (
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
                        {canManage && (
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
                        {canManage && (
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
                    !readOnly &&
                    command(
                      "ready",
                      { value: !state.ready[data.memberId] },
                      state.ready[data.memberId]
                        ? `✓ ${t("guided.notReady")}`
                        : t("guided.ready"),
                    )}
                  {!readOnly && (
                    <span>
                      {t("guided.readyCount", { count: data.doneCount })}
                    </span>
                  )}
                  {canManage &&
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
                      {state.ballotOpen && !readOnly ? (
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
                          {state.ballot > 0
                            ? t("guided.votes", {
                                count: data.counts[topic.id] ?? 0,
                              })
                            : t("review.noBallot")}
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
                            ? readOnly
                              ? "review.sharedTopic"
                              : "discuss.teamTopic"
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
                        href={viewHref()}
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
                      {readOnly && !archived && (
                        <input type="hidden" name="step" value={state.stage} />
                      )}
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
                            href={viewHref({ topic: topic.id })}
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
                                  {t(
                                    readOnly
                                      ? "review.sharedTopicShort"
                                      : "discuss.current",
                                  )}
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
                                readOnly
                                  ? "review.topic"
                                  : privateTopic || !sharedTopic
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
                            canManage &&
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
                            {canManage && (
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
                            {canManage && (
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
                                ? viewHref({
                                    topic:
                                      ranked[ranked.indexOf(active) - 1].id,
                                  })
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
                                ? viewHref({
                                    topic:
                                      ranked[ranked.indexOf(active) + 1].id,
                                  })
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
                      {!readOnly && (
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
                      )}
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
              <section class="actions-workspace">
                {state.stage === "summary" && (
                  <section class="meeting-record">
                    <header class="meeting-record-heading">
                      <div>
                        <h3>{t("guided.history")}</h3>
                        {state.closure && (
                          <p class="record-date">
                            {t("history.version", {
                              version: state.closureVersion ?? 1,
                            })}{" "}
                            ·{" "}
                            {t("guided.closedAt", {
                              date: formatDate(
                                numberLocaleFor(handle.props.locale),
                                state.closure.at,
                                "long-time",
                              ),
                            })}
                          </p>
                        )}
                      </div>
                      {state.closure && (
                        <div class="control-row record-tools">
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
                      )}
                    </header>
                    {state.closure ? (
                      <>
                        <p class="record-overview">
                          {t("summary.overview", {
                            topics: state.closure.topics.length,
                            decisions: Object.keys(state.closure.decisions)
                              .length,
                            actions: state.closure.proposals.filter(
                              (p) => p.disposition === "agreed",
                            ).length,
                          })}
                        </p>
                        <div class="summary-topics">
                          {state.closure.topics.map((topic) => (
                            <article key={topic.id} class="topic-card">
                              <header class="summary-topic-heading">
                                <h4 dir="auto">{topic.title}</h4>
                                <span class="summary-topic-outcome">
                                  {t(
                                    `guided.${state.closure!.outcomes[topic.id] ?? "unaddressed"}` as "guided.unaddressed",
                                  )}
                                </span>
                              </header>
                              <p dir="auto" class="summary-decision">
                                {state.closure!.decisions[topic.id] ??
                                  t("guided.noDecision")}
                              </p>
                              {evidence(topic)}
                            </article>
                          ))}
                        </div>
                        {state.closure.proposals.length > 0 && (
                          <details class="summary-agreement">
                            <summary>{t("summary.recordedActions")}</summary>
                            {state.closure.proposals.some(
                              (p) => p.disposition === "suggested",
                            ) && (
                              <p class="record-unresolved">
                                {t("guided.unresolved")}
                              </p>
                            )}
                            <div class="action-grid historical-actions">
                              {state.closure.proposals.map((p) =>
                                actionCard(p, true),
                              )}
                            </div>
                          </details>
                        )}
                      </>
                    ) : (
                      <>
                        <p>{t("guided.legacyHistory")}</p>
                        <div class="note-grid">
                          {data.cards.map((c) => note(c))}
                        </div>
                      </>
                    )}
                    {canManage &&
                      state.stage === "summary" &&
                      state.closure && (
                        <section class="reopen-meeting">
                          <div>
                            <h3>{t("history.reopen")}</h3>
                            <p>
                              {t("history.reopenHint", {
                                version: state.closureVersion ?? 1,
                              })}
                            </p>
                          </div>
                          <CommandForm
                            data={data}
                            kind="reopen"
                            fields={{ version: state.closureVersion ?? 1 }}
                          >
                            <button disabled={pending}>
                              {t("history.reopen")}
                            </button>
                          </CommandForm>
                        </section>
                      )}
                  </section>
                )}
                {!archived && (
                  <>
                    {state.stage === "summary" && (
                      <div class="current-progress-heading">
                        <h3>{t("guided.currentProgress")}</h3>
                        <p>{t("summary.progressHint")}</p>
                      </div>
                    )}
                    {state.proposals.length > 0 && (
                      <p class="action-counts">
                        {t("guided.actionCounts", {
                          agreed: state.proposals.filter(
                            (p) => p.disposition === "agreed",
                          ).length,
                          pending: state.proposals.filter(
                            (p) => p.disposition === "suggested",
                          ).length,
                        })}
                      </p>
                    )}
                    {(canFilter || state.stage === "actions") && (
                      <div class="actions-toolbar">
                        {canFilter && (
                          <form method="get" data-view-form>
                            {readOnly && !archived && (
                              <input
                                type="hidden"
                                name="step"
                                value={state.stage}
                              />
                            )}
                            <label>
                              {t("guided.filter")}
                              <select name="filter" data-view="filter">
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
                                  <option
                                    key={value}
                                    value={value}
                                    selected={value === filter}
                                  >
                                    {t(`guided.${value}`)} (
                                    {formatNumber(
                                      state.proposals.filter((p) =>
                                        matches(p, value),
                                      ).length,
                                    )}
                                    )
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button>{t("guided.refresh")}</button>
                          </form>
                        )}
                        {state.stage === "actions" && !readOnly && (
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
                    )}
                    {canFilter && (
                      <p class="actions-shown">
                        {t("guided.shown", {
                          shown: filtered.length,
                          total: state.proposals.length,
                        })}
                      </p>
                    )}
                    <div class="action-grid current-action-list">
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
                            href={viewHref()}
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
                  </>
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
                      pending ||
                      readOnly ||
                      !["discuss", "actions"].includes(data.state.stage)
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
                  canManage &&
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
                      pending ||
                      readOnly ||
                      !facilitator ||
                      data.state.stage !== "discuss"
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
                readOnly ||
                data.state.stage !== "collect" ||
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
