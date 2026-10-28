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
import { topicsOn } from '../../shared/lord/maths';
import { FINISH_ACTIONS } from '../../shared/lord/server';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { readSettings } from './classSettings';
import { supabase } from '../lib/supabase';
import { forgetSettings } from './settingsMemory';
import { FriendlyError } from './profile';

export type { LordAction, LordReply, LordRequest, LordState };

export type PackFact = FactStats & { pack: string };

export interface LordSettings {
  enabled: boolean;
  forestPerDay: number;
  seasonStart: string | null;
  /** The maths topics that are on. */
  topics: string[];
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
  const data = await readSettings(['lord_enabled', 'lord_forest_per_day', 'lord_season_start', 'lord_paused_since', 'lord_topics'], classId);
  if (!data) throw new FriendlyError('We couldn’t load the Dragon Maths settings.');
  return {
    enabled: data.lord_enabled === true, forestPerDay: data.lord_forest_per_day as number,
    seasonStart: (data.lord_season_start as string | null) ?? null, topics: topicsOn(data.lord_topics), pausedSince: (data.lord_paused_since as string | null) ?? null,
  };
}

/** Is the game switched on? (The dashboard hides it when it isn't.) For the pupil's class, or a teacher's class when given. */
export async function fetchLordEnabled(classId?: string | null): Promise<boolean> {
  return (await fetchLordSettings(classId)).enabled;
}

export async function saveLordSettings(settings: Partial<LordSettings> & { enabled: boolean }, classId?: string | null): Promise<LordSettings> {
  const { data, error } = await supabase.rpc('teacher_set_lord', { settings, target_class: classId ?? null });
  forgetSettings();
  forgetSchoolSeason();
  if (error || !data) {
    if ((error?.code === '22023' || error?.code === '42501') && error.message) throw new FriendlyError(error.message);
    throw new FriendlyError('We couldn’t save the Dragon Maths settings.');
  }
  return data as LordSettings;
}

/**
 * The school's season (one date for the whole school, migration 20261028000400). `number`, `dayOfSeason` and `daysLeft` are
 * null before season 1 starts; `startsIn` is the days until it does. `canChange` is true for a school admin.
 */
export interface LordSchoolSeason {
  start: string | null;
  pausedSince: string | null;
  number: number | null;
  dayOfSeason: number | null;
  daysLeft: number | null;
  startsIn: number | null;
  canChange: boolean;
}

/** `live: false` until migration 20261028000400 is on the database: each class still has its own date then. */
export type SchoolSeasonState = { live: true; season: LordSchoolSeason } | { live: false };

let schoolSeason: Promise<SchoolSeasonState> | null = null;

/** Forget the remembered school season, after anything that may change it. */
export function forgetSchoolSeason() {
  schoolSeason = null;
}

/**
 * The school's season, remembered so the Games table's row, its "?" and the drawer ask once. Before the migration is live the
 * server has no `lord_school_season` (PGRST202): then `{ live: false }`, and the teacher pages keep each class's own date.
 */
export function fetchLordSchoolSeason(): Promise<SchoolSeasonState> {
  if (!schoolSeason) {
    const asking: Promise<SchoolSeasonState> = Promise.resolve(supabase.rpc('lord_school_season')).then(({ data, error }) => {
      if (error?.code === NO_SUCH_FUNCTION) return { live: false };
      if (error || !data) throw new FriendlyError('We couldn’t load the school’s Dragon Maths seasons.');
      return { live: true, season: data as LordSchoolSeason };
    });
    schoolSeason = asking;
    asking.catch(() => {
      if (schoolSeason === asking) schoolSeason = null;
    });
  }
  return schoolSeason;
}

async function saveSchool(name: string, args: Record<string, unknown>, text: string): Promise<LordSchoolSeason> {
  const { data, error } = await supabase.rpc(name, args);
  forgetSettings();
  forgetSchoolSeason();
  if (error || !data) {
    if ((error?.code === '22023' || error?.code === '42501') && error.message) throw new FriendlyError(error.message);
    throw new FriendlyError(text);
  }
  return data as LordSchoolSeason;
}

/** A school admin sets the first day of season 1 for the whole school. The server refuses a date that takes the season back. */
export function saveLordSchoolSeason(start: string): Promise<LordSchoolSeason> {
  return saveSchool('admin_set_lord_season', { start }, 'We couldn’t save the season date.');
}

/** A school admin's holiday pause: on closes Dragon Maths for every class and stops the clock; off carries the season on. */
export function saveLordHoliday(paused: boolean): Promise<LordSchoolSeason> {
  return saveSchool('admin_set_lord_holiday', { paused }, 'We couldn’t save the holiday pause.');
}

/**
 * The Games table's switch. Once the school season is live, off closes Dragon Maths for this class only and the school's
 * seasons carry on. Before that, switching off pauses the class's season clock and switching on again carries the season on
 * where it left off (the server moves the start date forward by the days it was off).
 */
export async function saveLordEnabled(enabled: boolean, classId: string): Promise<void> {
  await saveLordSettings({ enabled }, classId);
}

/**
 * One change from the Settings drawer (forest fights, the season date or the topics). The server needs the switch with every
 * save, so this reads the class's current switch first and sends it back unchanged: a stale one would switch the game (and
 * the season clock) on or off by accident.
 */
export async function saveLordChange(change: Pick<Partial<LordSettings>, 'forestPerDay' | 'seasonStart' | 'topics'>, classId: string): Promise<void> {
  const { enabled } = await fetchLordSettings(classId);
  await saveLordSettings({ ...change, enabled }, classId);
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

/** PostgREST's answer when the database has no function with these arguments. */
const NO_SUCH_FUNCTION = 'PGRST202';

/**
 * Dragon Maths' report for one class, with that class's own season (migration 20261028000300). Until that migration is on
 * the live database, the server has only the old whole-school report: then that one is loaded instead, with `wholeSchool`
 * set, so the page can say so.
 */
export async function fetchClassLord(classId: string): Promise<ClassLord & { wholeSchool: boolean }> {
  const { data, error } = await supabase.rpc('teacher_lord_class', { target_class: classId });
  if (error?.code === NO_SUCH_FUNCTION) {
    const old = await supabase.rpc('teacher_lord_class');
    if (old.error || !old.data) fail(old.error, 'We couldn’t load Dragon Maths for the school.');
    return { ...(old.data as ClassLord), wholeSchool: true };
  }
  if (error || !data) fail(error, 'We couldn’t load Dragon Maths for this class.');
  return { ...(data as ClassLord), wholeSchool: false };
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
