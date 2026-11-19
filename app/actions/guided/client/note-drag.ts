import type { Card } from "../../../data/board.ts";

/** The drag data type; other drags (files, text) never trigger a move. */
export const noteDragType = "application/x-taqyeem-note";

export interface DraggedNote {
  id: string;
  fromCategory: string;
}

/** Ties the drag to this board so a note dragged from another tab is ignored. */
export function notePayload(boardId: string, cardId: string): string {
  return `${boardId}/${cardId}`;
}

/** A note can drop on any other category's lane. */
export function canDropOn(dragged: DraggedNote | null, categoryId: string): boolean {
  return !!dragged && !!categoryId && categoryId !== dragged.fromCategory;
}

const laneOf = (target: EventTarget | null) =>
  target instanceof Element
    ? target.closest<HTMLElement>(".lane[data-category-id]")
    : null;

export interface NoteDragOptions {
  boardId: () => string;
  cards: () => Card[];
  /** Whether the viewer may move notes right now (organiser, Collect, not pending). */
  canMove: () => boolean;
  /** Where each note's native "Move note" form lives. */
  root: () => HTMLElement;
  update: () => void;
}

/**
 * Drag-and-drop for moving notes between Collect lanes. Dropping fills in the
 * note's own native Move form and submits it, so dragging and the keyboard/no-JS
 * picker share one command path.
 */
export function createNoteDrag(options: NoteDragOptions) {
  let dragged: DraggedNote | null = null;
  let dropCategory = "";

  function clear() {
    dragged = null;
    dropCategory = "";
    options.update();
  }

  /** Fills the note's Move form with the drop target and submits it. */
  function submitMove(move: DraggedNote, categoryId: string) {
    const form = options
      .root()
      .querySelector<HTMLFormElement>(`[data-move-card="${move.id}"] form`);
    const select = form?.elements.namedItem("categoryId");
    const from = form?.elements.namedItem("fromCategory");
    clear();
    if (form && select instanceof HTMLSelectElement && from instanceof HTMLInputElement) {
      select.value = categoryId;
      from.value = move.fromCategory;
      form.requestSubmit();
    }
  }

  const handlers = {
    dragStart(event: DragEvent) {
      const target = event.target;
      const element =
        target instanceof Element
          ? target.closest<HTMLElement>(".feedback-card[data-card-id]")
          : null;
      const card = options.cards().find((c) => c.id === element?.dataset.cardId);
      const fromControl =
        target instanceof Element &&
        target.closest("a,button,input,select,textarea,summary");
      if (!options.canMove() || !card || !event.dataTransfer || fromControl) {
        event.preventDefault();
        return;
      }
      dragged = { id: card.id, fromCategory: card.categoryId };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(noteDragType, notePayload(options.boardId(), card.id));
      options.update();
    },
    dragOver(event: DragEvent) {
      const target = laneOf(event.target)?.dataset.categoryId ?? "";
      const allowed =
        options.canMove() &&
        canDropOn(dragged, target) &&
        !!event.dataTransfer?.types.includes(noteDragType);
      if (allowed) {
        event.preventDefault();
        event.dataTransfer!.dropEffect = "move";
      }
      const next = allowed ? target : "";
      if (dropCategory !== next) {
        dropCategory = next;
        options.update();
      }
    },
    dragLeave(event: DragEvent) {
      const current = event.currentTarget as Node;
      if (current.contains(event.relatedTarget as Node | null)) {
        return;
      }
      dropCategory = "";
      options.update();
    },
    dragEnd() {
      clear();
    },
    drop(event: DragEvent) {
      const categoryId = laneOf(event.target)?.dataset.categoryId ?? "";
      const move = dragged;
      const valid =
        options.canMove() &&
        move &&
        canDropOn(move, categoryId) &&
        event.dataTransfer?.getData(noteDragType) ===
          notePayload(options.boardId(), move.id);
      if (!valid) {
        clear();
        return;
      }
      event.preventDefault();
      submitMove(move, categoryId);
    },
  };

  return {
    /** Attach each with `on("dragstart", (e) => handlers.dragStart(e))` and so on. */
    handlers,
    clear,
    /** The note being dragged, if any. */
    draggedId: () => dragged?.id,
    /** The lane currently highlighted as a drop target, or "". */
    dropCategory: () => dropCategory,
  };
}
