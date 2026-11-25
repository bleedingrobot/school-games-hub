/**
 * Star Web's painted pictures (docs/STARWEB-ART-PLAN.md), found by file name in ./art/paint/back. A picture not painted yet gives null
 * and the drawn sky shows instead. The sky backdrop falls back to Class Live's painted night sky.
 */
import { painted as classLivePainted } from '../classlive/paintedArt';

const ART = import.meta.glob('./art/paint/back/*.webp', { eager: true, import: 'default' }) as Record<string, string>;

/** `painted('map')`, or `painted('sky-dusk', true)` for the 800 px copy. */
export function painted(file: string, small = false): string | null {
  return ART[`./art/paint/back/${file}${small ? '-800' : ''}.webp`] ?? ART[`./art/paint/back/${file}.webp`] ?? null;
}

const SKIES = ['sky-dusk', 'sky-aurora'];

/** A sky's backdrop, picked from its seed so it stays the same when carried on. */
export function skyBackdrop(seed: string, small: boolean): string | null {
  const own = SKIES.map((s) => painted(s, small)).filter((s): s is string => !!s);
  const all = [classLivePainted('back', 'star-sky', small), ...own].filter((s): s is string => !!s);
  return all.length ? all[parseInt(seed.slice(0, 4), 16) % all.length] : null;
}
