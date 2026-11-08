/** Which kinds of go a child has seen (S11). No game words in here; the game names its own kinds. See src/kit/README.md. */

/** A body field that names known kinds: an array, no repeats, at most `max`. Anything else is `null` (the server says "unreadable"). */
export function readKinds(value: unknown, allowed: readonly string[], max = 8): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const out: string[] = [];
  for (const k of value) {
    if (typeof k !== 'string' || !allowed.includes(k) || out.includes(k)) return null;
    out.push(k);
  }
  return out;
}

/** The union of any number of lists, no repeats, sorted. */
export function mergeSeen(...lists: readonly (readonly string[])[]): string[] {
  return [...new Set(lists.flat())].sort();
}

/** The kinds a child has already answered, so children who have played for weeks get no demo for what they know. */
export function kindsFromFacts(facts: Iterable<{ key: string; attempts: number }>, kindOfKey: (key: string) => string | null): string[] {
  const kinds: string[] = [];
  for (const f of facts) {
    if (f.attempts <= 0) continue;
    const kind = kindOfKey(f.key);
    if (kind) kinds.push(kind);
  }
  return mergeSeen(kinds);
}

/** What a game's server needs to read and save the list ('busy' = the database could not be reached). */
export type SeenServices = {
  seen(player: string): Promise<string[] | 'busy'>;
  markSeen(player: string, kinds: string[]): Promise<string[] | 'busy'>;
};

/** An in-memory version for the preview's trial backend. */
export function memorySeen(): SeenServices {
  const saved = new Map<string, string[]>();
  return {
    async seen(player) {
      return saved.get(player) ?? [];
    },
    async markSeen(player, kinds) {
      const next = mergeSeen(saved.get(player) ?? [], kinds);
      saved.set(player, next);
      return next;
    },
  };
}
