import { CategorySetup } from "./category-setup.tsx";
import { CommandForm } from "./command-form.tsx";
import { NoteCard, Evidence, ActionCard } from "./cards.tsx";
import { clientEntry, on, type Handle } from "remix/component";
import { routes } from "../../../routes.ts";
import { createTranslator } from "../../../i18n/translator.ts";
import type { Locale } from "../../../i18n/locales.ts";
import type { ViewerPayload } from "../payload.ts";
import type {
  Proposal,
  MeetingRecord,
} from "../../../models/guided/session.ts";
import { topics as sourceTopics } from "../../../models/guided/topics.ts";
import { createSessionStore } from "../../../ui/session-store.ts";
import { createDraftStore } from "../client/draft-store.ts";
import { createNoteDrag } from "../client/note-drag.ts";
import { expandForPrint, startPolling } from "../client/page-lifecycle.ts";
import { formSignature } from "../client/form-signature.ts";
import {
  commandOutcome,
  isNotMemberResponse,
} from "../client/command-outcome.ts";
import { laneLayout } from "../client/lanes.ts";
import {
  canFilterActions,
  matchesActionFilter,
  parseActionFilter,
} from "../client/action-filter.ts";
import { buildSummaryText } from "../client/summary-text.ts";
import { reviewStage } from "../../../models/guided/stages.ts";
import type { WorkspaceView, InitialView } from "./stages/types.ts";
import { openEditor } from "./stages/editor-launch.ts";
import {
  boardHeading,
  historyTools,
  legacyEvidence,
  reviewBanner,
  sessionStatus,
  stageHeading,
  stageRail,
} from "./stages/header.tsx";
import { budgetSettings, collectStage } from "./stages/collect-stage.tsx";
import { groupStage } from "./stages/group-stage.tsx";
import { voteStage } from "./stages/vote-stage.tsx";
import { discussStage } from "./stages/discuss-stage.tsx";
import { actionsStage } from "./stages/actions-stage.tsx";
import { captureEditors } from "./stages/capture-editors.tsx";
import {
  noteDialog as noteDialogSection,
  updateNoteCounter,
} from "./stages/note-dialog.tsx";

type WorkspaceProps = {
  origin: string;
  initial: ViewerPayload;
  locale: Locale;
  record?: MeetingRecord | null;
  initialView?: InitialView;
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
  /** The stage on screen and whether it is read-only (a past record or a reviewed earlier step). */
  function viewing() {
    const stage = handle.props.record
      ? "summary"
      : reviewStage(data.state.stage, handle.props.initialView?.step);
    return {
      stage,
      readOnly: !!handle.props.record || stage !== data.state.stage,
    };
  }
  /** Only the organiser can move notes between categories, while collecting on the live stage. */
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
  /** Stores a form's draft fields in session storage, keyed by its `data-draft`. */
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
  /** Refills a form from its stored draft; a restored note draft also re-opens the note editor state. */
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
    updateNoteCounter(translator(), root(), field.value.length);
  }
  /** Saves every draft plus the viewer's private view state so a reload resumes where they were. */
  function persist() {
    for (let f of root().querySelectorAll<HTMLFormElement>("form[data-draft]")) {
      save(f);
    }
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
  /**
   * Polls the session with an ETag of the current revision and adopts a newer one.
   * @param announce Show "updated" even when nothing changed (after reconnecting).
   */
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
      if (response.status === 304) {
        return;
      }
      if (isNotMemberResponse(response)) {
        needsJoin = true;
        error = translator().t("access.joinBoard");
        status = "";
        handle.update();
        return;
      }
      if (!response.ok) {
        throw new Error();
      }
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
        ) {
          noteDialog().showModal();
        }
        for (let d of root().querySelectorAll<HTMLDetailsElement>(
          "details[data-editor]",
        )) {
          d.open = v.details?.includes(d.dataset.editor);
        }
      }
    } catch {}
    for (let f of root().querySelectorAll<HTMLFormElement>("form[data-draft]")) {
      restore(f);
    }
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
        ) {
          persist();
        }
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
  /** Opens the note dialog, defaulting its category to the lane being viewed. */
  function openNote() {
    if (viewing().readOnly || data.state.categorySetup?.confirmed === false) {
      return;
    }
    let form = noteDialog().querySelector<HTMLFormElement>("form")!;
    if (!noteOpened && !get("note")) {
      let select = form.elements.namedItem("categoryId");
      if (select instanceof HTMLSelectElement) {
        select.value = category;
      }
    }
    noteOpened = true;
    noteDialog().showModal();
    restore(form);
    persist();
  }
  /** Closes the note dialog, keeping its draft. */
  function closeNote() {
    save(noteDialog().querySelector("form")!);
    noteDialog().close();
    persist();
  }
  /** Records a failed post: the join prompt for non-members, otherwise the server's message. */
  async function failed(response: Response) {
    if (isNotMemberResponse(response)) {
      needsJoin = true;
    }
    let result = (await response.json()) as { error?: string };
    error = result.error ?? translator().t("guided.failed");
  }
  /**
   * Adopts the committed session from a command response and applies its local
   * follow-up (lane, private topic, draft reset). `submitted` is the form's
   * signature at send time, so edits made while saving are kept.
   */
  async function afterCommand(
    form: HTMLFormElement,
    body: FormData,
    submitted: string,
    response: Response,
  ) {
    let next: ViewerPayload = await response.json();
    if (next.revision >= data.revision) {
      data = next;
    }
    let kind = (form.elements.namedItem("kind") as HTMLInputElement).value;
    let outcome = commandOutcome(kind, body.has("theme"));
    if (outcome.followCategory) {
      category = String(body.get("categoryId"));
      persist();
    }
    if (outcome.clearPrivateTopic) {
      privateTopic = "";
      expanded = false;
      persist();
    }
    if (outcome.clearsDraft && formSignature(form) === submitted) {
      clearDraft(form, outcome.keepsTitle);
    }
    (form.elements.namedItem("id") as HTMLInputElement).value =
      crypto.randomUUID();
  }
  /** Resets a drafted form and closes its editor, optionally keeping the drafted title. */
  function clearDraft(form: HTMLFormElement, keepTitle: boolean) {
    let title = form.querySelector<HTMLInputElement>('input[name="title"]');
    let retainedTitle = keepTitle ? title?.value : undefined;
    form.reset();
    if (title && retainedTitle !== undefined) {
      title.value = retainedTitle;
    }
    save(form);
    let disclosure = form.closest<HTMLDetailsElement>("details[data-editor]");
    if (disclosure) {
      disclosure.open = false;
    }
  }
  /** After a note is saved: new submission id, and close the editor unless it was edited meanwhile. */
  function afterNote(form: HTMLFormElement, submitted: string) {
    let unchanged = formSignature(form) === submitted;
    if (unchanged) {
      form.reset();
    }
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
  /**
   * Posts a command or note form with fetch. Command responses carry the
   * committed session; anything else (notes, failures) is followed by a refresh.
   */
  async function submit(
    form: HTMLFormElement,
    submitter: HTMLElement | null = null,
  ) {
    if (pending) {
      return;
    }
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
        await failed(response);
        return;
      }
      if (form.classList.contains("command-form")) {
        await afterCommand(form, body, submitted, response);
        applied = true;
      } else {
        afterNote(form, submitted);
      }
      status = translator().t("guided.saved");
    } catch {
      if (!handle.signal.aborted) {
        error = translator().t("guided.failed");
      }
    } finally {
      pending = false;
      if (error) {
        status = "";
      }
      if (!handle.signal.aborted) {
        handle.update();
        if (!applied) {
          await refresh();
        }
      }
    }
  }
  /** Applies a native view form (category, topic, filter) without leaving the page. */
  function applyViewForm(form: HTMLFormElement) {
    let values = new FormData(form);
    if (values.has("category")) {
      category = String(values.get("category"));
    }
    if (values.has("filter")) {
      filter = String(values.get("filter"));
    }
    if (values.has("topic")) {
      privateTopic = String(values.get("topic"));
      expanded = false;
    }
    persist();
    handle.update();
  }
  /** Enhanced forms: view forms update locally, command and note forms post with fetch. */
  function onSubmit(event: Event, submitter: HTMLElement | null) {
    let form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    if (form.hasAttribute("data-view-form")) {
      event.preventDefault();
      applyViewForm(form);
    } else if (
      form.classList.contains("command-form") ||
      form.dataset.draft === "note"
    ) {
      event.preventDefault();
      void submit(form, submitter);
    }
  }
  /** Selects marked `data-view` change the view at once; the record picker navigates. */
  function onChange(target: EventTarget | null) {
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    if (target.hasAttribute("data-record-picker")) {
      persist();
      target.form?.requestSubmit();
      return;
    }
    let kind = target.dataset.view;
    if (!kind) {
      return;
    }
    if (kind === "category") {
      category = target.value;
    }
    if (kind === "topic") {
      privateTopic = target.value;
      expanded = false;
    }
    if (kind === "filter") {
      filter = target.value;
    }
    persist();
    handle.update();
  }
  return () => {
    if (handle.props.initial !== lastInitial) {
      lastInitial = handle.props.initial;
      if (lastInitial.revision >= data.revision) {
        data = lastInitial;
      }
    }
    let nextView = JSON.stringify(handle.props.initialView);
    if (nextView !== lastView) {
      lastView = nextView;
      let view = handle.props.initialView;
      if (view?.category && data.categories.some((c) => c.id === view.category)) {
        category = view.category;
      }
      privateTopic = view?.topic ?? privateTopic;
      filter = view?.filter ?? filter;
    }
    if (!data.categories.some((c) => c.id === category)) {
      category = data.categories[0]?.id ?? "";
    }
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
    if (privateTopic && !ranked.some((topic) => topic.id === privateTopic)) {
      privateTopic = "";
    }
    let sharedTopic = ranked.find((topic) => topic.id === state.liveTopic);
    let active =
        ranked.find((x) => x.id === privateTopic) ?? sharedTopic ?? ranked[0],
      mine = state.votes[data.memberId] ?? [];
    let { current: currentCategory, lanes } = laneLayout(
      data.categories,
      category,
    );
    const command: WorkspaceView["command"] = (kind, fields, label) => (
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
    const afterEditorOpened = (form: HTMLFormElement) => {
      save(form);
      persist();
    };
    const capture: WorkspaceView["capture"] = (card, topic) =>
      openEditor(
        root(),
        "action",
        (_form, select, text) => {
          if (card) {
            text.value = card.body;
          }
          select.value =
            (topic ?? topics.find((t) => card && t.notes.includes(card.id)))?.id ?? "";
        },
        afterEditorOpened,
      );
    const recordDecision: WorkspaceView["recordDecision"] = (topic) =>
      openEditor(
        root(),
        "decision",
        (_form, select, text) => {
          select.value = topic.id;
          text.value = state.decisions[topic.id] ?? "";
        },
        afterEditorOpened,
      );
    const canFilter = canFilterActions(state.proposals.length);
    // A stale URL or saved choice must never hide items when the filter is absent.
    if (!archived && !canFilter) {
      filter = "all";
    }
    const matches = (p: Proposal, value: string) =>
      matchesActionFilter(p, value, data.memberId);
    const view: WorkspaceView = {
      data,
      display: displayData,
      state,
      record: archived,
      initialView: handle.props.initialView,
      facilitator,
      canManage,
      readOnly,
      pending,
      error,
      status,
      needsJoin,
      rootId,
      locale: handle.props.locale,
      t,
      formatNumber,
      topics,
      ranked,
      sharedTopic,
      active,
      privateTopic,
      mine,
      initialCaptureTopic,
      initialDecisionTopic,
      category,
      currentCategory,
      lanes,
      dropCategory: drag.dropCategory(),
      canMoveNotes: canMoveNotes(),
      submission,
      filter,
      filtered: state.proposals.filter((p) => matches(p, filter)),
      canFilter,
      matches,
      command,
      note: (card, select = false) => (
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
            capture(card, topics.find((topic) => topic.notes.includes(card.id)))
          }
        />
      ),
      evidence: (topic) => (
        <Evidence data={displayData} locale={handle.props.locale} topic={topic} />
      ),
      actionCard: (proposal, historical = false) => (
        <ActionCard
          key={proposal.id}
          data={displayData}
          locale={handle.props.locale}
          readOnly={readOnly}
          proposal={proposal}
          historical={historical}
          pending={pending}
        />
      ),
      viewHref(values = {}) {
        const query = new URLSearchParams(values);
        if (readOnly && !archived) {
          query.set("step", state.stage);
        }
        return (
          routes.board.href({ boardId: data.board.id }) +
          (query.size ? `?${query}` : "")
        );
      },
      viewTopic(topicId) {
        privateTopic = topicId;
        expanded = false;
        persist();
        handle.update();
      },
      showAllActions() {
        filter = "all";
        handle.update();
      },
      openNote,
      closeNote,
      discardNote() {
        let form = noteDialog().querySelector("form")!;
        form.reset();
        submission = crypto.randomUUID();
        (form.elements.namedItem("submissionId") as HTMLInputElement).value =
          submission;
        save(form);
        closeNote();
      },
      capture,
      recordDecision,
      persist,
      refresh: (announce) => void refresh(announce),
      copy: (value) => void copy(value),
      summaryText: () =>
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
        }),
      inviteUrl: new URL(
        routes.joinBoard.index.href({ boardId: data.board.id }),
        handle.props.origin,
      ).href,
    };
    async function copy(value: string) {
      try {
        await navigator.clipboard.writeText(value);
        status = t("guided.copied");
      } catch {
        error = t("guided.copyFailed");
      }
      handle.update();
    }
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
          on("submit", (event) => onSubmit(event, event.submitter)),
          on("change", (event) => onChange(event.target)),
          on("input", (event) => {
            if (event.target instanceof HTMLElement) {
              let form = event.target.closest("form");
              if (form) {
                save(form);
              }
            }
          }),
        ]}
      >
        {boardHeading(view)}
        {historyTools(view)}
        {legacyEvidence(view)}
        {state.categorySetup?.confirmed === false ? (
          <CategorySetup
            data={data}
            locale={handle.props.locale}
            pending={pending}
            error={error}
          />
        ) : (
          <>
            {stageRail(view)}
            {reviewBanner(view)}
            {sessionStatus(view)}
            {stageHeading(view)}
            {state.stage === "collect" && collectStage(view)}
            {budgetSettings(view)}
            {state.stage === "group" && groupStage(view)}
            {state.stage === "vote" && voteStage(view)}
            {state.stage === "discuss" && discussStage(view)}
            {(state.stage === "actions" || state.stage === "summary") &&
              actionsStage(view)}
            {captureEditors(view)}
          </>
        )}
        {noteDialogSection(view, root)}
      </main>
    );
  };
}
