/**
 * A stable string of a form's current values. The workspace compares the value
 * captured at submit with the value afterwards to tell whether the person kept
 * typing while the request was in flight.
 */
export function formSignature(
  form: HTMLFormElement,
  submitter?: HTMLElement | null,
): string {
  return formDataSignature(new FormData(form, submitter));
}

/** The same signature for FormData that has already been read. */
export function formDataSignature(data: FormData): string {
  return new URLSearchParams(
    [...data].map(([key, value]) => [key, String(value)]),
  ).toString();
}
