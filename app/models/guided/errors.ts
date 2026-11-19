export function isCollectLock(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause)
    if (current.message.includes("collect_only")) return true;
  return false;
}
