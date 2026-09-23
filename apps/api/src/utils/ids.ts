/** Stable, human-readable ids (r1, q1, f1...) scoped within a single kit. */
export function makeIdSequence(prefix: string, startAt = 1): () => string {
  let n = startAt;
  return () => `${prefix}${n++}`;
}

/** Next id continuing after the highest existing one of the given prefix, so
 * ids stay stable/unique across regenerations instead of restarting at 1. */
export function nextIdAfter(existingIds: string[], prefix: string): () => string {
  const max = existingIds
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number.parseInt(id.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return makeIdSequence(prefix, max + 1);
}
