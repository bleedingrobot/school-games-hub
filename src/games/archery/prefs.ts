/**
 * A pupil's Archery Challenge choices and best fight scores, kept on this device only for now
 * (the server keeps the best scores from Stage 4). Storage can be blocked: everything still works,
 * it just isn't remembered.
 */
import { BOT_LEVELS, type BotLevel } from '../../../shared/archery/bot';
import { WORLD_IDS, type PlayerSetup, type WorldId } from '../../../shared/archery/types';

export interface ArcheryPrefs {
  /** Simpler graphics: fewer layers and sparks, a softer picture. Helps a slow device. */
  simple: boolean;
  /** Gentler movement: no shaking or swooping. `null` follows the device's own setting. */
  lessMotion: boolean | null;
}

export const DEFAULT_PREFS: ArcheryPrefs = { simple: false, lessMotion: null };

const PREFS_KEY = 'archery-prefs-v1';
const BEST_KEY = 'archery-best-v1';

export function parsePrefs(raw: unknown): ArcheryPrefs {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    simple: typeof o.simple === 'boolean' ? o.simple : DEFAULT_PREFS.simple,
    lessMotion: typeof o.lessMotion === 'boolean' ? o.lessMotion : null,
  };
}

export function loadPrefs(): ArcheryPrefs {
  try {
    return parsePrefs(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: ArcheryPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: the choice just won't be remembered.
  }
}

/** Does the pupil want gentler movement (their own choice, or else the device's setting)? */
export function wantsLessMotion(prefs: ArcheryPrefs): boolean {
  if (prefs.lessMotion !== null) return prefs.lessMotion;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type Bests = Partial<Record<WorldId, number>>;

export function loadBests(): Bests {
  try {
    const o = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as Record<string, unknown>;
    const out: Bests = {};
    for (const w of WORLD_IDS) if (typeof o[w] === 'number' && Number.isFinite(o[w]) && (o[w] as number) >= 0) out[w] = Math.floor(o[w] as number);
    return out;
  } catch {
    return {};
  }
}

/** Keeps a fight's score if it's the best in that world. Returns whether it was a new best. */
export function saveBest(world: WorldId, score: number): boolean {
  const bests = loadBests();
  if ((bests[world] ?? -1) >= score) return false;
  bests[world] = score;
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(bests));
  } catch {
    // Storage blocked.
  }
  return true;
}

const CHOICES_KEY = 'archery-choices-v1';

/** The last fight picked and the last quiver packed, so the next fight starts from them (this device only). */
export interface Choices {
  world: WorldId;
  level: BotLevel;
  pack: PlayerSetup | null;
}

export function loadChoices(): Choices {
  try {
    const o = JSON.parse(localStorage.getItem(CHOICES_KEY) ?? '{}') as Record<string, unknown>;
    const world = WORLD_IDS.find((w) => w === o.world) ?? 'forest';
    const level = BOT_LEVELS.find((l) => l === o.level) ?? 'easy';
    const p = o.pack as PlayerSetup | null;
    const pack = p && typeof p === 'object' && p.quiver && typeof p.quiver === 'object' ? { quiver: { ...p.quiver }, shield: p.shield ?? null, bow: p.bow ?? 'starter' } : null;
    return { world, level, pack };
  } catch {
    return { world: 'forest', level: 'easy', pack: null };
  }
}

export function saveChoices(c: Choices): void {
  try {
    localStorage.setItem(CHOICES_KEY, JSON.stringify(c));
  } catch {
    // Storage blocked: not remembered, that's all.
  }
}
