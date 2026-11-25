/**
 * Background music for the Class Live big screen (James, 25 Nov 2026 NZ: free CC0 tracks). One looping track at a
 * time, chosen by what is on screen: the picker and lobby, each game, Mystery Mural's guessing time, and each Class
 * Showdown arena. Tracks cross-fade when the screen changes. Only the projector plays music, never pupils' devices.
 *
 * The tracks are original, made on James's PC with a local music model (ACE-Step in ComfyUI, 25 Nov 2026 NZ; prompts
 * and seeds in music/MAKING.json), about -18 LUFS calm and -16 LUFS hot. The teacher turns music on or off and sets its volume (kept on this computer); the Sound off button
 * silences it too.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';

type Calm = 'stars' | 'serpent' | 'boss' | 'goldrush' | 'skyclimb' | 'island' | 'hill' | 'auction';
/**
 * Each game and arena has a calm track and a "-hot" one: the same tune made more dramatic and high-energy, for the
 * last 30 seconds and the big moments (James, 25 Nov 2026 NZ). Mystery Mural's hot one is its guessing music.
 */
export type Track = 'picker' | 'win' | 'mural' | 'guess' | Calm | `${Calm}-hot` | `game-${string}` | `corners-${string}` | `shark-${string}`;

const FILES = import.meta.glob('./music/*.mp3', { eager: true, import: 'default' }) as Record<string, string>;
const file = (t: string): string | undefined => FILES[`./music/${t}.mp3`];
/** The file for a track; a missing hot track plays its calm one, a missing win plays the picker's. */
export const trackUrl = (t: Track): string | undefined =>
  file(t) ?? (t.endsWith('-hot') ? file(t.slice(0, -4)) : t === 'win' ? file('picker') : undefined);

const KEY = 'classlive.music';
const FADE_MS = 900;
export const DEFAULT_VOLUME = 0.35;

interface Settings {
  on: boolean;
  volume: number;
  /** The teacher's choice: pupils' devices play the music too (James, 25 Nov 2026 NZ). Off: the big screen only. */
  pads: boolean;
}

function load(): Settings {
  try {
    const s = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return { on: s.on !== false, volume: typeof s.volume === 'number' && s.volume >= 0 && s.volume <= 1 ? s.volume : DEFAULT_VOLUME, pads: s.pads === true };
  } catch {
    return { on: true, volume: DEFAULT_VOLUME, pads: false };
  }
}

let settings: Settings = typeof window === 'undefined' ? { on: true, volume: DEFAULT_VOLUME, pads: false } : load();
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((f) => f());

export function musicSettings(): Settings { return settings; }
export function setMusic(next: Partial<Settings>) {
  settings = { ...settings, ...next };
  try { window.localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* not kept */ }
  player.refresh();
  tell();
}
export function useMusicSettings(): Settings {
  return useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f); }, () => settings, () => settings);
}

/** Fades an element's volume to `to` over FADE_MS, then calls done. */
function fade(el: HTMLAudioElement, to: number, done?: () => void) {
  const from = el.volume;
  const start = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - start) / FADE_MS);
    try { el.volume = Math.max(0, Math.min(1, from + (to - from) * k)); } catch { /* some browsers fix the volume */ }
    if (k < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

/** play() returns a promise in browsers, but nothing (or throws) in some test set-ups. */
function start(el: HTMLAudioElement, ok: () => void, refused: () => void) {
  try {
    const p = el.play() as Promise<void> | undefined;
    if (p && typeof p.then === 'function') p.then(ok, refused);
  } catch {
    refused();
  }
}

class Player {
  private el: HTMLAudioElement | null = null;
  private track: Track | null = null;
  /** Each screen's wish, newest last (the Class Live test page shows the projector and a pupil's pad at once). */
  private wishes = new Map<object, Track | null>();
  private waitingForTap = false;
  /** A looping copy still finishing its last 1.5 s, stopped along with the current one when music goes off. */
  private stopped = new Set<HTMLAudioElement>();

  /** What a screen wants playing (null: silence, or gone). The newest screen that wants a track wins. */
  want(who: object, track: Track | null) {
    this.wishes.delete(who);
    if (track) this.wishes.set(who, track);
    this.refresh();
  }

  refresh() {
    // Volume 0 is off too: iPads ignore the volume, so only stopping the track silences it there.
    const t = settings.on && settings.volume > 0 ? [...this.wishes.values()].pop() ?? null : null;
    if (t === this.track && this.el) {
      fade(this.el, settings.volume);
      return;
    }
    const old = this.el;
    // Turning music off stops it at once (a fade-out sounds like the button did nothing, and iPads can't fade).
    if (old) { if (t) fade(old, 0, () => { old.pause(); old.src = ''; }); else { old.pause(); old.src = ''; } }
    this.stopped.forEach((e) => { e.pause(); e.src = ''; });
    this.stopped.clear();
    this.el = null;
    this.track = t;
    const url = t ? trackUrl(t) : undefined;
    if (!t || !url || typeof Audio === 'undefined') return;
    const el = new Audio(url);
    el.volume = 0;
    this.el = el;
    this.chain(el, t, url);
    start(el, () => fade(el, settings.volume), () => this.afterTap());
  }

  /**
   * Seamless looping: the tracks fade in and out at their ends, so a fresh copy starts 1.5 s before the end and the
   * two overlap (a plain loop would dip in volume every time round).
   */
  private chain(el: HTMLAudioElement, t: Track, url: string) {
    let passed = false;
    const tick = () => {
      if (passed || !Number.isFinite(el.duration) || el.currentTime < el.duration - 1.5) return;
      passed = true;
      el.removeEventListener('timeupdate', tick);
      if (this.el !== el || this.track !== t) return;
      const next = new Audio(url);
      next.volume = el.volume;
      this.el = next;
      this.chain(next, t, url);
      start(next, () => fade(next, settings.volume), () => undefined);
      this.stopped.add(el);
      el.addEventListener('ended', () => { el.src = ''; this.stopped.delete(el); }, { once: true });
    };
    el.addEventListener('timeupdate', tick);
  }

  /** Browsers only start sound after a tap or key: try again on the next one. */
  private afterTap() {
    if (this.waitingForTap || typeof window === 'undefined') return;
    this.waitingForTap = true;
    const again = () => {
      this.waitingForTap = false;
      window.removeEventListener('pointerdown', again);
      window.removeEventListener('keydown', again);
      const el = this.el;
      if (el && el.paused) start(el, () => fade(el, settings.volume), () => undefined);
    };
    window.addEventListener('pointerdown', again);
    window.addEventListener('keydown', again);
  }
}

const player = new Player();

/** iPads and iPhones fix a page's volume at full: there the slider would do nothing, so it is not shown. */
export const canSetVolume = (() => {
  if (typeof Audio === 'undefined') return true;
  try { const a = new Audio(); a.volume = 0.5; return a.volume === 0.5; } catch { return false; }
})();

/** Plays `track` while the calling screen is shown (null: silence), unless music or sound is off. */
export function useMusic(track: Track | null, soundOn: boolean) {
  const me = useRef({}).current;
  useEffect(() => { player.want(me, soundOn ? track : null); }, [me, track, soundOn]);
  useEffect(() => () => player.want(me, null), [me]);
}

/** How hot a moment is: the last 30 seconds, a serpent awake, a full web chasing the supernova. */
export const HOT_MS = 30_000;

/**
 * Four Corners plays its map's own track (corners-snow, corners-snow-hot...; made on James's PC, 25 Nov 2026 NZ). A map
 * whose track is missing borrows one from the Class Live and Showdown sets.
 */
const CORNER_TRACKS: Record<string, Calm> = { snow: 'skyclimb', jungle: 'island', castle: 'boss', space: 'stars' };
const MAPS = ['snow', 'jungle', 'castle', 'space'];
/** Shark Bay: its own tracks (shark-lagoon, shark-lagoon-hot...) when made, else a Four Corners map's track. */
const SHARK_BORROWS: Record<string, string> = { lagoon: 'jungle', reef: 'space', pirate: 'castle', icy: 'snow' };

/** The track for a Class Live room: the lobby shares the picker's, the end plays the win, hot moments the hot one. */

export function classLiveTrack(state: 'lobby' | 'live' | 'over' | null, kind: 'stars' | 'serpent' | 'mural' | 'corners' | null, o: { guessing?: boolean; hot?: boolean; /** A Four Corners map, or (with `shark`) a Shark Bay bay. */ map?: string; /** Shark Bay: `map` is a bay. */ shark?: boolean } = {}): Track {
  if (state === 'over') return 'win';
  if (!state || !kind || state !== 'live') return 'picker';
  if (kind === 'mural') return o.guessing || o.hot ? 'guess' : 'mural';
  if (kind === 'corners') {
    if (o.shark) {
      const bay = o.map ?? 'lagoon';
      const mine: Track = o.hot ? `shark-${bay}-hot` : `shark-${bay}`;
      if (trackUrl(mine)) return mine;
      return classLiveTrack(state, kind, { hot: o.hot, map: SHARK_BORROWS[bay] ?? 'jungle' });
    }
    const map = MAPS.includes(o.map ?? '') ? o.map! : 'snow';
    const own: Track = o.hot ? `corners-${map}-hot` : `corners-${map}`;
    if (trackUrl(own)) return own;
    const calm = CORNER_TRACKS[map] ?? 'goldrush';
    return o.hot ? `${calm}-hot` : calm;
  }
  return o.hot ? `${kind}-hot` : kind;
}

/** The track for a Class Showdown arena. */
export function arenaTrack(arena: Calm, state: 'lobby' | 'live' | 'over' | undefined, hot: boolean): Track {
  if (state === 'over') return 'win';
  return state === 'live' && hot ? `${arena}-hot` : arena;
}
