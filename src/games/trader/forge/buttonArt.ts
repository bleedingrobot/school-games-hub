/**
 * A painted picture for a Forge button (`buttons/<group>-<key>.webp`), asked of `./art.ts` if it exists. Today it doesn't, so
 * every button shows its emoji and colour. The lookup tries a few names so it works with whatever art.ts exports.
 */
const mods = import.meta.glob('./art.ts', { eager: true }) as Record<string, Record<string, unknown>>;

export function buttonArt(group: string, key: string): string | undefined {
  const m = mods['./art.ts'];
  if (!m) return undefined;
  for (const name of ['buttonArt', 'buttonUrl', 'forgeButton', 'buttonPicture']) {
    const f = m[name];
    if (typeof f === 'function') {
      try {
        const url = (f as (g: string, k: string) => unknown)(group, key);
        if (typeof url === 'string' && url) return url;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
