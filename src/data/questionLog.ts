/**
 * Sends the question box's notes (answered or skipped, src/maths/questionLog.ts) to the database, for the teacher's skip
 * counts. See docs/QUESTION-SKIPS-PLAN.md.
 *
 * Notes wait in a small queue kept in this browser, one per student (so a shared Chromebook never sends one student's notes as
 * another's), and go in batches: every 30 seconds while there are any, when the page is hidden, and when the site opens. A
 * failed send just tries again later. Nothing here ever shows an error: a note is never worth interrupting a game.
 */
import { supabase } from '../lib/supabase';
import { setQuestionSink, type QuestionNote } from '../maths/questionLog';

export interface LoggedNote extends QuestionNote {
  game: string;
  at: number;
}

/** The most notes one request carries (the database refuses more). */
export const BATCH = 100;
/** The most notes kept waiting per student; the oldest go first. */
export const MAX_QUEUED = 500;
const SEND_EVERY_MS = 30_000;

const queueKey = (player: string) => `sgh-question-log:${player}`;
const memory = new Map<string, LoggedNote[]>();

export function queuedNotes(player: string): LoggedNote[] {
  const kept = memory.get(player);
  if (kept) return kept;
  try {
    const text = localStorage.getItem(queueKey(player));
    const parsed: unknown = text ? JSON.parse(text) : [];
    return Array.isArray(parsed) ? (parsed as LoggedNote[]) : [];
  } catch {
    return [];
  }
}

function setQueue(player: string, notes: LoggedNote[]) {
  memory.set(player, notes);
  try {
    if (notes.length) localStorage.setItem(queueKey(player), JSON.stringify(notes));
    else localStorage.removeItem(queueKey(player));
  } catch {
    // Storage blocked: the queue lasts until the page closes.
  }
}

/** Which game a page belongs to, from its address: "#/marble" → "marble", "#/space-game/<id>" → "space". */
export function gameFromHash(hash: string): string {
  const first = hash.replace(/^#?\/?/, '').split(/[/?]/)[0].toLowerCase();
  const game = { 'space-game': 'space', 'card-game': '101', 'power-game': 'power-clash', play: 'friend-game' }[first] ?? first;
  return /^[a-z0-9-]{1,30}$/.test(game) ? game : 'other';
}

export function addNote(player: string, note: LoggedNote): void {
  setQueue(player, [...queuedNotes(player), note].slice(-MAX_QUEUED));
}

const sending = new Set<string>();

/** Sends what's waiting for this student, a batch at a time. Returns how many went. */
export async function sendNotes(player: string): Promise<number> {
  if (sending.has(player)) return 0;
  sending.add(player);
  let sent = 0;
  try {
    for (;;) {
      const batch = queuedNotes(player).slice(0, BATCH);
      if (!batch.length) break;
      const items = batch.map((n) => ({ game: n.game, spot: n.spot, skipped: n.skipped, ms: n.ms, at: n.at }));
      const { error } = await supabase.rpc('log_questions', { items });
      if (error) break;
      // Notes added while sending stay; only the ones sent go.
      setQueue(player, queuedNotes(player).slice(batch.length));
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

/** Called once when the site starts: the question box's notes are queued for whoever is signed in and sent now and then. */
export function startQuestionLog(): void {
  if (started) return;
  started = true;
  let player: string | null = null;
  let timer: number | null = null;
  const sendSoon = () => {
    if (timer !== null || !player) return;
    timer = window.setTimeout(() => {
      timer = null;
      if (player) void sendNotes(player);
    }, SEND_EVERY_MS);
  };
  supabase.auth.onAuthStateChange((_event, session) => {
    const next = session?.user.id ?? null;
    if (next === player) return;
    player = next;
    if (player && queuedNotes(player).length) void sendNotes(player);
  });
  setQuestionSink((note) => {
    if (!player) return;
    addNote(player, { ...note, game: gameFromHash(window.location.hash) });
    sendSoon();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && player) void sendNotes(player);
  });
}

// ---------------------------------------------------------------------------
// The teacher's view
// ---------------------------------------------------------------------------

export interface SkipStudent {
  id: string;
  name: string;
  realName: string;
  shown: number;
  answered: number;
  skipped: number;
  topSkip: { game: string; spot: string; skipped: number } | null;
}

export interface SkipSpot {
  game: string;
  spot: string;
  shown: number;
  skipped: number;
}

export interface QuestionSkips {
  students: SkipStudent[];
  spots: SkipSpot[];
}

/** Questions shown, answered and skipped by each student in the class (all the teacher's students with no class), over `days` days. */
export async function fetchQuestionSkips(classId: string | null, days: number): Promise<QuestionSkips> {
  const { data, error } = await supabase.rpc('teacher_question_skips', { target_class: classId, days });
  if (error || !data || typeof data !== 'object') throw new Error(error?.message ?? 'We couldn’t load the skip counts.');
  const d = data as Partial<QuestionSkips>;
  return { students: Array.isArray(d.students) ? d.students : [], spots: Array.isArray(d.spots) ? d.spots : [] };
}
