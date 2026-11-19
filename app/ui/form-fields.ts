/** The controls a draft can read and write. */
export type FieldControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Every named input, textarea and select inside a form, in document order. */
export function namedControls(form: HTMLFormElement): FieldControl[] {
  return [...form.querySelectorAll("input[name],textarea[name],select[name]")] as FieldControl[];
}

const isRadio = (node: FieldControl): node is HTMLInputElement =>
  node instanceof HTMLInputElement && node.type === "radio";
const isCheckbox = (node: FieldControl): node is HTMLInputElement =>
  node instanceof HTMLInputElement && node.type === "checkbox";

/**
 * A form's values by field name: the checked radio's value, a checkbox's
 * checked state, otherwise the text. Fields `include` rejects are skipped.
 */
export function readFieldValues(
  form: HTMLFormElement,
  include: (name: string) => boolean = () => true,
): Record<string, string | boolean> {
  let values: Record<string, string | boolean> = {};
  for (let node of namedControls(form)) {
    if (!include(node.name) || (isRadio(node) && !node.checked)) {
      continue;
    }
    values[node.name] = isCheckbox(node) ? node.checked : node.value;
  }
  return values;
}

/** Puts values from {@link readFieldValues} back; names without a value are left alone. */
export function writeFieldValues(
  form: HTMLFormElement,
  values: Record<string, unknown>,
  include: (name: string) => boolean = () => true,
): void {
  for (let node of namedControls(form)) {
    let value = values[node.name];
    if (!include(node.name) || value === undefined) {
      continue;
    }
    if (isRadio(node)) {
      node.checked = node.value === String(value);
    } else if (isCheckbox(node)) {
      node.checked = !!value;
    } else {
      node.value = String(value);
    }
  }
}
