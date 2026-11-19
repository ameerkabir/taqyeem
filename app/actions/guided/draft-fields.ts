// Fields that describe one submission attempt, not what the person typed. Restoring
// them from a saved draft would replay a committed command id or an old revision.
const transientFields = new Set(["id", "revision", "kind", "ballot"]);

/** Whether a named form field belongs in a viewer's saved draft. */
export function isDraftField(name: string): boolean {
  return !transientFields.has(name);
}
