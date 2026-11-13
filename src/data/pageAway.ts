/**
 * Leaving the game page (James, 14 Nov 2026 NZ). Notes each time a pupil leaves a game page (another tab or app in front, or
 * another window clicked) and comes back, with how long they were away and the kind of question showing, if any. The teacher
 * sees pupils who do it a lot on the Progress tab (src/teacher/progress/AwayPanel.tsx).
 *
 * A page can tell it was hidden or lost focus, never which app was used, and a second device is invisible: this is a signal,
 * not proof. Blips under 3 seconds are not noted. A pupil who leaves and never comes back (closed the page) is not noted.
 *
 * Notes wait in a small queue in this browser, one per pupil, like the question box's notes (questionLog.ts), and go when the
 * pupil comes back and when the site opens. A failed send tries again later; nothing here ever shows an error.
 */
import { supabase } from '../lib/supabase';
import { openQuestion } from '../maths/questionLog';
import { gameFromHash } from './questionLog';

/** Shorter than this is a blip (a notification, a mis-click), not noted. */
export const MIN_AWAY_MS = 3000;
/** Longer than this is a break, not counted as a time away on the teacher's view (the server keeps it apart). */
export const BREAK_MS = 10 * 60_000;
/** The most notes one request carries (the database refuses more). */
export const BATCH = 50;
/** The most notes kept waiting per pupil. */
export const MAX_QUEUED = 200;

/** Pages that are not a game, a maths activity or training: leaving them is not noted. */
const NOT_PLAY = new Set(['other', 'leaderboard', 'profile', 'points', 'teacher', 'warp', 'activities', 'lobby', 'sign-in', 'badge', 'classes', 'focus', 'skills']);

export function isPlayPage(game: string): boolean {
  return !NOT_PLAY.has(game);
}

export interface AwayNote {
  game: string;
  /** The kind of question showing when they left, or null. */
  spot: string | null;
  /** 'tab': the page was hidden (another tab or app in front). 'window': it only lost focus (another window clicked). */
  kind: 'tab' | 'window';
  ms: number;
  /** When they left, ms since 1970. */
  at: number;
}

interface Away {
  game: string;
  spot: string | null;
  hidden: boolean;
  startedAt: number;
  started: number;
}

/**
 * The timing, kept apart from the page so it can be tested. `left` when the page is hidden or loses focus, `back` when it is
 * seen and focused again; `onNote` gets one note per time away of MIN_AWAY_MS or more.
 */
export function createAwayWatcher(opts: {
  now: () => number;
  wallClock: () => number;
  game: () => string;
  spot: () => string | null;
  onNote: (note: AwayNote) => void;
}) {
  let away: Away | null = null;
  return {
    left(hidden: boolean) {
      if (away) {
        away.hidden ||= hidden;
        return;
      }
      const game = opts.game();
      if (!isPlayPage(game)) return;
      away = { game, spot: opts.spot(), hidden, startedAt: opts.wallClock(), started: opts.now() };
    },
    back() {
      if (!away) return;
      const ms = Math.round(opts.now() - away.started);
      const { game, spot, hidden, startedAt } = away;
      away = null;
      if (ms >= MIN_AWAY_MS) opts.onNote({ game, spot, kind: hidden ? 'tab' : 'window', ms, at: startedAt });
    },
    /** The page is closing or the pupil changed: forget a time away that never ended. */
    forget() {
      away = null;
    },
    get isAway() {
      return away !== null;
    },
  };
}

const queueKey = (player: string) => `sgh-page-away:${player}`;
const memory = new Map<string, AwayNote[]>();

export function queuedAways(player: string): AwayNote[] {
  const kept = memory.get(player);
  if (kept) return kept;
  try {
    const text = localStorage.getItem(queueKey(player));
    const parsed: unknown = text ? JSON.parse(text) : [];
    return Array.isArray(parsed) ? (parsed as AwayNote[]) : [];
  } catch {
    return [];
  }
}

function setQueue(player: string, notes: AwayNote[]) {
  memory.set(player, notes);
  try {
    if (notes.length) localStorage.setItem(queueKey(player), JSON.stringify(notes));
    else localStorage.removeItem(queueKey(player));
  } catch {
    // Storage blocked: the queue lasts until the page closes.
  }
}

export function addAway(player: string, note: AwayNote): void {
  setQueue(player, [...queuedAways(player), note].slice(-MAX_QUEUED));
}

const sending = new Set<string>();

/** Sends what's waiting for this pupil. Returns how many went. */
export async function sendAways(player: string): Promise<number> {
  if (sending.has(player)) return 0;
  sending.add(player);
  let sent = 0;
  try {
    for (;;) {
      const batch = queuedAways(player).slice(0, BATCH);
      if (!batch.length) break;
      const { error } = await supabase.rpc('log_page_away', { items: batch });
      if (error) break;
      setQueue(player, queuedAways(player).slice(batch.length));
      sent += batch.length;
    }
  } catch {
    // Offline: try again later.
  } finally {
    sending.delete(player);
  }
  return sent;
}

let started = false;

/** Called once when the site starts. Teachers' notes are sent too, but the server doesn't keep them. */
export function startAwayLog(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  let player: string | null = null;
  const watcher = createAwayWatcher({
    now: () => performance.now(),
    wallClock: () => Date.now(),
    game: () => gameFromHash(window.location.hash),
    spot: openQuestion,
    onNote: (note) => {
      if (!player) return;
      addAway(player, note);
      void sendAways(player);
    },
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    const next = session?.user.id ?? null;
    if (next === player) return;
    watcher.forget();
    player = next;
    if (player && queuedAways(player).length) void sendAways(player);
  });
  const isBack = () => document.visibilityState === 'visible' && document.hasFocus();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') watcher.left(true);
    else if (isBack()) watcher.back();
  });
  window.addEventListener('blur', () => {
    // Focus moving into a frame on the page (a video, say) is not leaving it.
    if (document.activeElement?.tagName === 'IFRAME') return;
    watcher.left(document.visibilityState === 'hidden');
  });
  window.addEventListener('focus', () => {
    if (isBack()) watcher.back();
  });
  window.addEventListener('pagehide', () => watcher.forget());
}

// ---------------------------------------------------------------------------
// The teacher's view
// ---------------------------------------------------------------------------

export interface AwayPupil {
  id: string;
  name: string;
  realName: string;
  /** Times away of 3 seconds to 10 minutes. */
  times: number;
  /** Of those, how many were while a question box was open. */
  duringQuestion: number;
  /** Seconds away over those times. */
  awaySecs: number;
  /** Times away over 10 minutes (breaks; not in `times`). */
  longBreaks: number;
  /** Questions shown to the pupil in the same days. */
  questions: number;
  /** School days with a time away. */
  days: number;
  topGame: string | null;
  lastAt: string | null;
}

/** Pupils in the class who left a game page in the last `days` days, most times first. */
export async function fetchPageAway(classId: string, days = 7): Promise<AwayPupil[]> {
  const { data, error } = await supabase.rpc('teacher_page_away', { target_class: classId, days });
  if (error || !Array.isArray(data)) throw new Error(error?.message ?? 'We couldn’t load the times away.');
  return data as AwayPupil[];
}

/** "A lot": 15 or more times away in the week, or 6 or more during a question. James: "only a problem if some kids do it a lot". */
export const OFTEN_TIMES = 15;
export const OFTEN_DURING_QUESTION = 6;

export function isOften(p: Pick<AwayPupil, 'times' | 'duringQuestion'>): boolean {
  return p.times >= OFTEN_TIMES || p.duringQuestion >= OFTEN_DURING_QUESTION;
}
