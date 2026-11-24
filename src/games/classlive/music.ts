/**
 * Background music for the Class Live big screen (James, 25 Nov 2026 NZ: free CC0 tracks). One looping track at a
 * time, chosen by what is on screen: the picker and lobby, each game, Mystery Mural's guessing time, and each Class
 * Showdown arena. Tracks cross-fade when the screen changes. Only the projector plays music, never pupils' devices.
 *
 * The tracks are CC0 from OpenGameArt (music/CREDITS.json has each title, author and page), loudness-matched to about
 * -18 LUFS. The teacher turns music on or off and sets its volume (kept on this computer); the Sound off button
 * silences it too.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';

export type Track = 'picker' | 'stars' | 'serpent' | 'mural' | 'guess' | 'boss' | 'goldrush' | 'skyclimb' | 'island' | 'hill' | 'auction';

const FILES = import.meta.glob('./music/*.mp3', { eager: true, import: 'default' }) as Record<string, string>;
export const trackUrl = (t: Track): string | undefined => FILES[`./music/${t}.mp3`];

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

  /** What a screen wants playing (null: silence, or gone). The newest screen that wants a track wins. */
  want(who: object, track: Track | null) {
    this.wishes.delete(who);
    if (track) this.wishes.set(who, track);
    this.refresh();
  }

  refresh() {
    const t = settings.on ? [...this.wishes.values()].pop() ?? null : null;
    if (t === this.track && this.el) {
      fade(this.el, settings.volume);
      return;
    }
    const old = this.el;
    if (old) fade(old, 0, () => { old.pause(); old.src = ''; });
    this.el = null;
    this.track = t;
    const url = t ? trackUrl(t) : undefined;
    if (!t || !url || typeof Audio === 'undefined') return;
    const el = new Audio(url);
    el.loop = true;
    el.volume = 0;
    this.el = el;
    start(el, () => fade(el, settings.volume), () => this.afterTap());
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

/** Plays `track` while the calling screen is shown (null: silence), unless music or sound is off. */
export function useMusic(track: Track | null, soundOn: boolean) {
  const me = useRef({}).current;
  useEffect(() => { player.want(me, soundOn ? track : null); }, [me, track, soundOn]);
  useEffect(() => () => player.want(me, null), [me]);
}

/** The track for a Class Live room: the lobby and the end share the picker's, Mystery Mural's guessing has its own. */
export function classLiveTrack(state: 'lobby' | 'live' | 'over' | null, kind: 'stars' | 'serpent' | 'mural' | null, guessing: boolean): Track {
  if (!state || !kind || state !== 'live') return 'picker';
  if (kind === 'mural') return guessing ? 'guess' : 'mural';
  return kind;
}
