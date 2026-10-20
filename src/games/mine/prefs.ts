/**
 * A pupil's Mine Runner choices, kept on this device (one set per pupil, as the school's devices are shared).
 */
export interface MinePrefs {
  /** Thumb sticks: which hand steers. The look stick goes on this side. */
  hand: 'right' | 'left';
  /** Show the on-screen thumb sticks: by itself on a touch screen, or always, or never. */
  touch: 'auto' | 'on' | 'off';
  /** Steady flight keeps the ship level (up is always up). Free flight lets it roll. */
  steady: boolean;
  /** The little arrow that points to the next goal. */
  arrow: boolean;
  /** Mouse look without holding a button (the mouse is captured by the page). Needs the browser to allow it. */
  lock: boolean;
  /** Gentler movement: no spinning or bobbing things, fewer sparks. `null` follows the device's own setting. */
  lessMotion: boolean | null;
  /** How fast the mouse and look stick turn the ship, 1 is normal. */
  sensitivity: number;
  /** Looking up and down the other way round. */
  invertY: boolean;
  /** Fly with maths questions at the doors and pads, when the teacher lets pupils choose. */
  maths: boolean;
}

export const DEFAULT_PREFS: MinePrefs = { hand: 'right', touch: 'auto', steady: true, arrow: true, lock: false, lessMotion: null, sensitivity: 2, invertY: false, maths: true };

const keyFor = (player?: string) => `mine-runner-prefs-v1${player ? `:${player}` : ''}`;

export function parsePrefs(raw: unknown): MinePrefs {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const bool = (k: keyof MinePrefs, fallback: boolean) => (typeof o[k] === 'boolean' ? (o[k] as boolean) : fallback);
  const sens = typeof o.sensitivity === 'number' && Number.isFinite(o.sensitivity) ? Math.min(2.5, Math.max(0.4, o.sensitivity)) : DEFAULT_PREFS.sensitivity;
  return {
    hand: o.hand === 'left' ? 'left' : 'right',
    touch: o.touch === 'on' || o.touch === 'off' ? o.touch : 'auto',
    steady: bool('steady', DEFAULT_PREFS.steady),
    arrow: bool('arrow', DEFAULT_PREFS.arrow),
    lock: bool('lock', DEFAULT_PREFS.lock),
    lessMotion: typeof o.lessMotion === 'boolean' ? o.lessMotion : null,
    sensitivity: sens,
    invertY: bool('invertY', DEFAULT_PREFS.invertY),
    maths: bool('maths', DEFAULT_PREFS.maths),
  };
}

export function loadPrefs(player?: string): MinePrefs {
  try {
    return parsePrefs(JSON.parse(localStorage.getItem(keyFor(player)) ?? '{}'));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: MinePrefs, player?: string): void {
  try {
    localStorage.setItem(keyFor(player), JSON.stringify(prefs));
  } catch {
    // Storage blocked: the choices just won't be remembered.
  }
}

/** Does the device ask for less movement? */
export function systemWantsLessMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export const wantsLessMotion = (p: MinePrefs): boolean => (p.lessMotion === null ? systemWantsLessMotion() : p.lessMotion);

/** Does this device have a touch screen as its main way to point? */
export function isTouchDevice(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export const showTouchControls = (p: MinePrefs): boolean => (p.touch === 'on' ? true : p.touch === 'off' ? false : isTouchDevice());

// ——— Best times on this device: only the phone preview uses them (the real game keeps best times on the school's server) ———
const bestsKey = (player?: string) => `mine-runner-bests-v1${player ? `:${player}` : ''}`;
export type Bests = Record<string, number>;

export function loadBests(player?: string): Bests {
  try {
    const raw = JSON.parse(localStorage.getItem(bestsKey(player)) ?? '{}') as Record<string, unknown>;
    const out: Bests = {};
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/** Records a finish. Returns the new bests and whether this was the best so far. */
export function withFinish(bests: Bests, level: string, steps: number): { bests: Bests; isBest: boolean } {
  const old = bests[level];
  if (old !== undefined && old <= steps) return { bests, isBest: false };
  return { bests: { ...bests, [level]: steps }, isBest: true };
}

export function saveBests(bests: Bests, player?: string): void {
  try {
    localStorage.setItem(bestsKey(player), JSON.stringify(bests));
  } catch {
    // Storage blocked.
  }
}
