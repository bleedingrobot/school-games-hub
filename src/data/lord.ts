/**
 * Dragon Maths' saving and loading (docs/LORD-PLAN.md, stage L.4).
 *
 * The server is the boss. Everything that matters (the next forest fight, a master, a dragon stage, every
 * purchase) waits for the `lord` server function, which hands back the hero as it now is. The one thing played
 * in the browser is the fight itself, from the seed the server gave; when it ends the actions are sent as a
 * "finish". That one is queued on this device if the connection is down ("saving later"), so a fight that was
 * won is never lost to flaky Wi-Fi. Sending a finish twice is safe (each carries its own id, and the fight is
 * finished once on the server).
 *
 * If the server turns a finish down ("tampered"), the pupil is told in plain words that the fight couldn't be
 * saved and can be played again from the start: the open fight is still on the server.
 */
import type { FactStats } from '../../shared/maths/leitner';
import type { LordAction, LordReply, LordRequest, LordState } from '../../shared/lord/server';
import { FINISH_ACTIONS } from '../../shared/lord/server';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { readSettings } from './classSettings';
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

export type { LordAction, LordReply, LordRequest, LordState };

export type PackFact = FactStats & { pack: string };

export interface LordSettings {
  enabled: boolean;
  forestPerDay: number;
  seasonStart: string | null;
  /** The day the game was switched off, while the season clock waits (null when it is running). */
  pausedSince?: string | null;
}

/** A line of the Daily News, newest first. `kind` picks the little picture. */
export interface NewsItem {
  day: string;
  kind: 'village' | 'computer' | 'master' | 'dragon' | 'arena' | 'flattened';
  line: string;
}

/** The Warriors list for this season: level and stars (and dragons beaten this season), never maths. */
export interface WarriorRow {
  place: number;
  display_name: string;
  avatar: unknown;
  level: number;
  stars: number;
  dragons: number;
  is_me: boolean;
}

/** The Hall of Heroes: who beat the Red Dragon in each season. */
export interface HallRow {
  season: number;
  display_name: string;
  avatar: unknown;
  kills: number;
  is_me: boolean;
}

/** What opening the game finds. */
export type LordLoad =
  | { kind: 'ready'; state: LordState; facts: PackFact[]; teacher: boolean; abandoned?: 'forest' | 'master' | 'dragon' }
  | { kind: 'closed' }
  | { kind: 'not-started'; message: string }
  | { kind: 'offline' };

/** What one request came to. 'queued': a finish that couldn't be sent yet and will be. */
export type Sent = { kind: 'reply'; reply: LordReply } | { kind: 'offline' } | { kind: 'queued' };

/** The two places Dragon Maths can keep its hero: the school's server, or this browser only (the trial in preview/lord). */
export interface LordBackend {
  /** True for the browser-only trial, which has the test tools. The live game never shows them. */
  trial: boolean;
  load(): Promise<LordLoad>;
  send(request: LordRequest): Promise<Sent>;
  /** Sends the queued finishes. 'later' if some are still waiting. */
  flush(): Promise<'done' | 'later'>;
  /** How many finished fights are waiting to be sent. */
  waiting(): number;
  /** The Daily News, the Warriors list and the Hall of Heroes. Null if they couldn't be fetched just now. */
  fetchNews(): Promise<NewsItem[] | null>;
  fetchWarriors(): Promise<WarriorRow[] | null>;
  fetchHall(): Promise<HallRow[] | null>;
}

export const isFinish = (action: string) => (FINISH_ACTIONS as readonly string[]).includes(action);

// ---------------------------------------------------------------------------
// Browser storage for the queue (each read and write can fail: private windows, blocked storage)
// ---------------------------------------------------------------------------

const queueKey = (player: string) => `sgh-lord-queue:${player}`;
const memoryQueues = new Map<string, LordRequest[]>();

function read(player: string): LordRequest[] {
  try {
    const text = localStorage.getItem(queueKey(player));
    return text ? (JSON.parse(text) as LordRequest[]) : [];
  } catch {
    return [];
  }
}

export const queuedFinishes = (player: string): LordRequest[] => memoryQueues.get(player) ?? read(player);

function setQueue(player: string, items: LordRequest[]) {
  memoryQueues.set(player, items);
  try {
    if (items.length) localStorage.setItem(queueKey(player), JSON.stringify(items));
    else localStorage.removeItem(queueKey(player));
  } catch {
    // Storage blocked (or full): it lasts until the page closes.
  }
}

/** The longest the queue may grow (fights can't pile up: only one is open at a time, so this is just a safety net). */
const MAX_QUEUE = 10;

export function enqueueFinish(player: string, request: LordRequest) {
  setQueue(player, [...queuedFinishes(player).filter((r) => r.requestId !== request.requestId), request].slice(-MAX_QUEUE));
}

// ---------------------------------------------------------------------------
// The server
// ---------------------------------------------------------------------------

/** One call to the function. 'offline' covers the network being down and the server being busy or switched off for upkeep. */
async function call(request: LordRequest, keepalive = false): Promise<{ kind: 'reply'; reply: LordReply } | { kind: 'offline' }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { kind: 'offline' };
    const response = await fetch(`${SUPABASE_URL}/functions/v1/lord`, {
      method: 'POST',
      keepalive,
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) return { kind: 'offline' };
    const reply = (await response.json()) as LordReply;
    if (!reply || typeof reply !== 'object' || typeof reply.ok !== 'boolean') return { kind: 'offline' };
    return { kind: 'reply', reply };
  } catch {
    return { kind: 'offline' };
  }
}

/** Reasons that mean "this finish has been dealt with": it is done, or it can never be done. */
const SETTLED: string[] = ['duplicate', 'no-fight', 'tampered', 'stale', 'rule', 'bad-request', 'no-hero'];

/** One of the pupil-readable lists, or null when it can't be fetched (the screen says so and offers to try again). */
async function readList<T>(name: 'lord_news' | 'lord_warriors' | 'lord_hall'): Promise<T[] | null> {
  try {
    const { data, error } = await supabase.rpc(name);
    if (error || !Array.isArray(data)) return null;
    return data as T[];
  } catch {
    return null;
  }
}

export function createServerBackend(player: string): LordBackend {
  /** One send at a time, so two sends can't race each other. */
  let chain: Promise<unknown> = Promise.resolve();

  /** What the server said to each finish it dealt with this time, by request id. */
  let replies = new Map<string, LordReply>();

  async function flushNow(): Promise<'done' | 'later'> {
    for (let sent = 0; sent < 12; sent++) {
      const next = queuedFinishes(player)[0];
      if (!next) return 'done';
      const out = await call(next);
      if (out.kind === 'offline') return 'later';
      const reply = out.reply;
      // Switched off or not started: keep it for when it is back.
      if (!reply.ok && (reply.reason === 'closed' || reply.reason === 'not-started' || reply.reason === 'busy')) return 'later';
      if (reply.ok || SETTLED.includes(reply.reason)) {
        replies.set(next.requestId ?? '', reply);
        setQueue(player, queuedFinishes(player).filter((r) => r.requestId !== next.requestId));
      } else return 'later';
    }
    return queuedFinishes(player).length === 0 ? 'done' : 'later';
  }

  const flush = () => {
    const next = chain.then(flushNow);
    chain = next.catch(() => 'later');
    return next;
  };

  return {
    trial: false,
    waiting: () => queuedFinishes(player).length,
    flush,
    fetchNews: () => readList<NewsItem>('lord_news'),
    fetchWarriors: () => readList<WarriorRow>('lord_warriors'),
    fetchHall: () => readList<HallRow>('lord_hall'),
    async load() {
      await flush();
      let teacher = false;
      let facts: PackFact[] = [];
      try {
        const { data, error } = await supabase.rpc('my_lord');
        if (error || !data) return { kind: 'offline' };
        const mine = data as { settings: LordSettings; teacher: boolean; facts: PackFact[] };
        teacher = mine.teacher === true;
        facts = mine.facts ?? [];
        // The switch is off: say so without bothering the function (a teacher may still look around).
        if (!mine.settings.enabled && !teacher) return { kind: 'closed' };
      } catch {
        return { kind: 'offline' };
      }
      const out = await call({ action: 'load' });
      if (out.kind === 'offline') return { kind: 'offline' };
      const reply = out.reply;
      if (!reply.ok) {
        if (reply.reason === 'closed') return { kind: 'closed' };
        if (reply.reason === 'not-started') return { kind: 'not-started', message: reply.message ?? 'The season has not started yet.' };
        return { kind: 'offline' };
      }
      const abandoned = (reply.result as { abandoned?: 'forest' | 'master' | 'dragon' } | undefined)?.abandoned;
      return { kind: 'ready', state: reply.state, facts, teacher, abandoned };
    },
    async send(request) {
      if (isFinish(request.action)) {
        // A finished fight is kept on this device until the server has it, so a dropped connection loses nothing.
        enqueueFinish(player, request);
        replies = new Map();
        await flush();
        const mine = replies.get(request.requestId ?? '');
        // Still waiting: it will go when the connection is back.
        return mine ? { kind: 'reply', reply: mine } : { kind: 'queued' };
      }
      const out = await call(request);
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

export async function fetchLordSettings(classId?: string | null): Promise<LordSettings> {
  const data = await readSettings(['lord_enabled', 'lord_forest_per_day', 'lord_season_start', 'lord_paused_since'], classId);
  if (!data) throw new FriendlyError('We couldn’t load the Dragon Maths settings.');
  return {
    enabled: data.lord_enabled === true, forestPerDay: data.lord_forest_per_day as number,
    seasonStart: (data.lord_season_start as string | null) ?? null, pausedSince: (data.lord_paused_since as string | null) ?? null,
  };
}

/** Is the game switched on? (The dashboard hides it when it isn't.) */
export async function fetchLordEnabled(): Promise<boolean> {
  return (await fetchLordSettings()).enabled;
}

export async function saveLordSettings(settings: Partial<LordSettings> & { enabled: boolean }, classId?: string | null): Promise<LordSettings> {
  const { data, error } = await supabase.rpc('teacher_set_lord', { settings, target_class: classId ?? null });
  if (error || !data) {
    if (error?.code === '22023' && error.message) throw new FriendlyError(error.message);
    throw new FriendlyError('We couldn’t save the Dragon Maths settings.');
  }
  return data as LordSettings;
}

export type { LordAction as LordActionRequest };

// ---------------------------------------------------------------------------
// The teacher page
// ---------------------------------------------------------------------------

export interface ClassLord {
  season: { number: number | null; start: string | null; daysLeft: number | null };
  /** Pupils who have a hero (any season), and how many of them are in the current season. */
  players: number;
  thisSeason: number;
  /** How many heroes are at level 1 to 12 this season. */
  levels: number[];
  hardest: { pack: string; key: string; students: number; attempts: number; correct: number }[];
  refusals: { name: string; realName: string; reason: string; action: string; at: string }[];
  hall: { season: number; name: string; realName: string; kills: number }[];
}

export interface StudentLord {
  hero: {
    level: number;
    heroClass: string;
    exp: number;
    stars: number;
    season: number;
    savedAt: string;
    stats: { forestWins: number; masterWins: number; arenaWins: number; riddles: number; dragons: number; bestLevel: number } | null;
    hall: number;
  } | null;
  topics: { pack: string; facts: number; attempts: number; correct: number; fluent: number }[];
  hardest: { pack: string; key: string; attempts: number; correct: number }[];
  refused: number;
}

function fail(error: { code?: string; message?: string } | null, text: string): never {
  if (error?.code === '22023' && error.message) throw new FriendlyError(error.message);
  throw new FriendlyError(text);
}

export async function fetchClassLord(): Promise<ClassLord> {
  const { data, error } = await supabase.rpc('teacher_lord_class');
  if (error || !data) fail(error, 'We couldn’t load Dragon Maths for the class.');
  return data as ClassLord;
}

export async function fetchStudentLord(student: string): Promise<StudentLord> {
  const { data, error } = await supabase.rpc('teacher_lord_student', { student });
  if (error || !data) fail(error, 'We couldn’t load their Dragon Maths.');
  return data as StudentLord;
}

/** Starts one pupil's hero again (they pick a class next time they play). Points, achievements and the Hall stay. */
export async function resetLordHero(student: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_reset_lord_hero', { student });
  if (error) fail(error, 'We couldn’t reset that hero.');
}
