/**
 * Today asks each game for its alerts and its hardest questions at the same moment, and both come from the same class report.
 * This shares one request between them: the same key within a few seconds gets the same answer. A failed request is not kept.
 */
const KEEP_MS = 10_000;
const kept = new Map<string, { at: number; value: Promise<unknown> }>();

export function shortCache<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = kept.get(key);
  if (hit && now - hit.at < KEEP_MS) return hit.value as Promise<T>;
  const value = load();
  kept.set(key, { at: now, value });
  value.catch(() => {
    if (kept.get(key)?.value === value) kept.delete(key);
  });
  return value;
}

/** For tests. */
export function clearShortCache() {
  kept.clear();
}
