/**
 * Opens one of the workspace's capture editors (`details[data-editor]`),
 * lets `fill` pre-fill it only when its text is still empty, focuses it, then
 * calls `saved` so the draft is stored, and scrolls it into view.
 */
export function openEditor(
  root: HTMLElement,
  name: "action" | "decision",
  fill: (form: HTMLFormElement, topic: HTMLSelectElement, text: HTMLTextAreaElement) => void,
  saved: (form: HTMLFormElement) => void,
): void {
  let detail = root.querySelector<HTMLDetailsElement>(`details[data-editor="${name}"]`)!;
  detail.open = true;
  let form = detail.querySelector<HTMLFormElement>("form")!;
  let text = form.querySelector<HTMLTextAreaElement>("textarea")!;
  let topic = form.querySelector('select[name="topic"]') as unknown as HTMLSelectElement;
  if (!text.value.trim()) {
    fill(form, topic, text);
  }
  text.focus();
  saved(form);
  detail.scrollIntoView({ block: "start" });
}
