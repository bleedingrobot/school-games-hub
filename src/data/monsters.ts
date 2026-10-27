/**
 * Maths Monsters' saving and loading.
 *
 * Every save goes into a queue kept in this browser (one per student), and the queue is sent to the
 * `monster` server function whenever it can be: at healing spots, after a Tower battle, on getting a
 * badge, every few minutes, when the student leaves, and when the game opens again. A dropped
 * Wi-Fi connection just means it goes later. Sending a save twice is safe (each carries its own id).
 *
 * Also kept on this device, until the server has it: the latest game and the battles fought since
 * the last save (the "tail"), so closing the tab loses nothing. Opening the game picks the newest of
 * the server's save and this device's: see `loadMonsters`.
 *
 * If the server turns a save down ("refused"), the queue and the tail are thrown away and this
 * device stops saving until the game is opened again; the next opening carries on from the last
 * good save (supabase/functions/monster/handler.ts says what happens to a bad save).
 */
import type { FactStats } from '../../shared/maths/leitner';
import type { TopicId } from '../../shared/maths/skillPacks';
import type { BattleReport, SaveItem } from '../../shared/monsters/save/check';
import type { SaveResponse } from '../../supabase/functions/monster/handler';
import type { TypeId } from '../../shared/monsters/types';
import { BATTLES_PER_DAY, countedOn, nzDay } from '../../shared/monsters/world/battleCap';
import type { WorldState } from '../../shared/monsters/world/types';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { readSettings } from './classSettings';
import { supabase } from '../lib/supabase';
import { forgetSettings } from './settingsMemory';
import { FriendlyError } from './profile';

export interface MonstersSettings {
  enabled: boolean;
  topics: TopicId[];
}

export const ALL_TOPICS: TopicId[] = ['place-value', 'add-sub', 'times-tables', 'division', 'fractions', 'decimals'];
export const DEFAULT_MONSTERS_SETTINGS: MonstersSettings = { enabled: false, topics: ALL_TOPICS };

/** The game, and the battles since it was last put in the queue. */
export interface Tail {
  /** The seq of the last save made on this device (or the server's version when nothing is waiting). */
  base: number;
  world: WorldState;
  battles: BattleReport[];
  /** A new game's first save says which two types it started with. */
  start?: [TypeId, TypeId];
}

export type PackFact = FactStats & { pack: TopicId };

export interface MonstersData {
  /** Where the game picks up: null for a student who has never played (and nothing on this device). */
  tail: Tail | null;
  settings: MonstersSettings;
  facts: PackFact[];
  /** The server couldn't be reached. */
  offline: boolean;
  /** Today's battle limit (battleCap.ts): battles counted today, the game's unsaved ones included, and the limit. */
  battles: { day: string; today: number; perDay: number };
}

interface ServerData {
  save: { world: WorldState; version: number } | null;
  settings: MonstersSettings;
  facts: PackFact[];
  /** Missing until the battle-limit migration is applied. */
  battles?: { today: number; perDay: number };
}

// ---------------------------------------------------------------------------
// Browser storage (each read and write can fail: private windows, blocked storage)
// ---------------------------------------------------------------------------

const queueKey = (player: string) => `sgh-monsters-queue:${player}`;
const tailKey = (player: string) => `sgh-monsters-tail:${player}`;

function read<T>(key: string): T | null {
  try {
    const text = localStorage.getItem(key);
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked (or full): it lasts until the page closes.
  }
}

/** Kept in memory as well, in case storage is blocked. */
const memoryQueues = new Map<string, SaveItem[]>();
const memoryTails = new Map<string, Tail | null>();
/** Devices that have been told "refused": they stop saving until the game is opened again. */
const refusedPlayers = new Set<string>();

export const queuedSaves = (player: string): SaveItem[] => memoryQueues.get(player) ?? read<SaveItem[]>(queueKey(player)) ?? [];

function setQueue(player: string, items: SaveItem[]) {
  memoryQueues.set(player, items);
  write(queueKey(player), items.length ? items : null);
}

export const readTail = (player: string): Tail | null => (memoryTails.has(player) ? memoryTails.get(player)! : read<Tail>(tailKey(player)));

export function writeTail(player: string, tail: Tail | null) {
  memoryTails.set(player, tail);
  write(tailKey(player), tail);
}

/** The longest the queue may grow (a save every few minutes: a whole day offline fits). */
const MAX_QUEUE = 120;

export function enqueueSave(player: string, item: SaveItem) {
  if (refusedPlayers.has(player)) return;
  setQueue(player, [...queuedSaves(player), item].slice(-MAX_QUEUE));
}

/** True once the server has turned a save down this session: nothing more is saved until the game is opened again. */
export const savingStopped = (player: string) => refusedPlayers.has(player);

// ---------------------------------------------------------------------------
// The server
// ---------------------------------------------------------------------------

/** Most saves in one request: the server's MAX_ITEMS, and the body limit (64 KB) with room to spare. */
const MAX_PER_REQUEST = 12;
const MAX_BYTES = 48_000;

export type FlushResult = 'done' | 'later' | 'refused';

/** One send at a time, so two sends can't race each other. */
let chain: Promise<unknown> = Promise.resolve();

/**
 * Sends the queue. Saves the server has dealt with leave it; the rest wait for next time. Never throws:
 * 'done' (all through), 'later' (couldn't, or not all) or 'refused' (the server turned a save down).
 */
export function flushQueue(player: string, keepalive = false): Promise<FlushResult> {
  const next = chain.then(() => sendQueue(player, keepalive));
  chain = next.catch(() => 'later');
  return next;
}

async function sendQueue(player: string, keepalive: boolean): Promise<FlushResult> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    for (let sent = 0; sent < 12; sent++) {
      const items = queuedSaves(player);
      if (items.length === 0) return 'done';
      if (!token) return 'later';
      const batch: SaveItem[] = [];
      let bytes = 0;
      for (const item of items) {
        const size = JSON.stringify(item).length;
        if (batch.length > 0 && (batch.length >= MAX_PER_REQUEST || bytes + size > MAX_BYTES)) break;
        batch.push(item);
        bytes += size;
      }
      const response = await fetch(`${SUPABASE_URL}/functions/v1/monster`, {
        method: 'POST',
        keepalive: keepalive && bytes < 60_000,
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batch }),
      });
      if (!response.ok) return 'later';
      const body = (await response.json()) as SaveResponse;
      const handled = Math.max(0, Math.min(batch.length, body.handled ?? 0));
      if (body.results?.some((r) => r.type === 'refused')) {
        // This save, and everything after it, can't be kept. Start again from the last good save next time.
        refusedPlayers.add(player);
        setQueue(player, []);
        writeTail(player, null);
        return 'refused';
      }
      // Take out what was dealt with. Anything added while sending stays.
      const gone = new Set(batch.slice(0, handled).map((i) => i.saveId));
      setQueue(player, queuedSaves(player).filter((i) => !gone.has(i.saveId)));
      if (handled < batch.length) return 'later';
    }
    return queuedSaves(player).length === 0 ? 'done' : 'later';
  } catch {
    // Offline: it goes next time.
    return 'later';
  }
}

/**
 * Everything Maths Monsters needs to open. The server's save is used unless this device is ahead of it
 * (it made saves the server hasn't heard of yet, or has played since its last one), in which case this
 * device's game carries on. If another Chromebook has saved since this one did, the server's wins.
 */
export async function loadMonsters(player: string): Promise<MonstersData> {
  refusedPlayers.delete(player);
  await flushQueue(player);
  const device = readTail(player);
  try {
    const { data, error } = await supabase.rpc('my_monsters');
    if (error || !data) throw error ?? new Error('no data');
    const server = data as ServerData;
    const version = server.save?.version ?? 0;
    let tail: Tail | null;
    if (device && device.base >= version) {
      // This device is the newest (or level with the server, having played on since the last save).
      tail = device;
    } else {
      tail = server.save ? { base: version, world: server.save.world, battles: [] } : null;
      writeTail(player, tail);
      // Anything still queued came from before the server's save: it can't follow it.
      if (queuedSaves(player).length) setQueue(player, queuedSaves(player).filter((i) => i.seq > version));
    }
    const day = nzDay(Date.now());
    const today = (server.battles?.today ?? 0) + countedOn(tail?.battles ?? [], day);
    const battles = { day, today: Math.max(today, readBattleCount(player, day)), perDay: server.battles?.perDay ?? BATTLES_PER_DAY };
    return { tail, settings: server.settings, facts: server.facts, offline: false, battles };
  } catch {
    const day = nzDay(Date.now());
    const today = Math.max(countedOn(device?.battles ?? [], day), readBattleCount(player, day));
    return { tail: device, settings: DEFAULT_MONSTERS_SETTINGS, facts: [], offline: true, battles: { day, today, perDay: BATTLES_PER_DAY } };
  }
}

const battleKey = (player: string) => `sgh-monsters-battles:${player}`;

/** This device's count of today's battles (so the limit holds offline and across a reload before the save goes up). */
export function readBattleCount(player: string, day: string): number {
  try {
    const stored = JSON.parse(localStorage.getItem(battleKey(player)) ?? 'null') as { day?: string; n?: number } | null;
    return stored?.day === day && typeof stored.n === 'number' ? stored.n : 0;
  } catch {
    return 0;
  }
}

export function writeBattleCount(player: string, day: string, n: number) {
  try {
    localStorage.setItem(battleKey(player), JSON.stringify({ day, n }));
  } catch {
    // Storage blocked: the server's count still holds the limit next time.
  }
}

// ---------------------------------------------------------------------------
// The game switch, leaderboard and teachers
// ---------------------------------------------------------------------------

/** Is the game switched on? (The dashboard hides it when it isn't.) For the pupil's class, or a teacher's class when given. */
export async function fetchMonstersEnabled(classId?: string | null): Promise<boolean> {
  const data = await readSettings(['monsters_enabled'], classId);
  if (!data) throw new FriendlyError('We couldn’t load this setting.');
  return data.monsters_enabled === true;
}

export interface MonstersRow {
  place: number;
  display_name: string;
  avatar: unknown;
  monsters: number;
  badges: number;
  is_me: boolean;
}

export async function fetchMonstersBoard(): Promise<MonstersRow[]> {
  const { data, error } = await supabase.rpc('monsters_leaderboard');
  if (error || !data) throw new FriendlyError('We couldn’t load the leaderboard.');
  return data as MonstersRow[];
}

export interface TopicLine {
  pack: TopicId;
  students: number;
  attempts: number;
  correct: number;
}

export interface ClassMonsters {
  players: number;
  /** How many students hold at least 1, 2, ... 6 badges. */
  badges: number[];
  topics: TopicLine[];
  hardest: { pack: TopicId; key: string; students: number; attempts: number; correct: number }[];
  refusals: { name: string; realName: string; reason: string; at: string }[];
}

export interface StudentMonsters {
  save: {
    owned: number;
    seen: number;
    badges: number;
    catches: number;
    savedAt: string;
    map: string;
    team: { species: string; level: number }[];
    badgeList: string[];
  } | null;
  topics: { pack: TopicId; facts: number; attempts: number; correct: number; fluent: number }[];
  refused: number;
}

/** Messages we wrote in the database are safe to show; anything else gets the fallback. */
function fail(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code === '22023' && error.message) throw new FriendlyError(error.message);
  throw new FriendlyError(fallback);
}

export async function fetchMonstersSettings(classId?: string | null): Promise<MonstersSettings> {
  const data = await readSettings(['monsters_enabled', 'monsters_topics'], classId);
  if (!data) throw new FriendlyError('We couldn’t load the Maths Monsters settings.');
  return { enabled: data.monsters_enabled === true, topics: data.monsters_topics as TopicId[] };
}

export async function saveMonstersSettings(settings: MonstersSettings, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_monsters', { settings, target_class: classId ?? null });
  forgetSettings();
  if (error) fail(error, 'We couldn’t save the Maths Monsters settings.');
}

/**
 * The server saves the switch and the topics together, so each of these reads the class's current settings and saves them
 * with the one change. (The Games table's switch and the topics in its Settings are never on screen to change at once.)
 */
export async function saveMonstersEnabled(enabled: boolean, classId: string): Promise<void> {
  const current = await fetchMonstersSettings(classId);
  await saveMonstersSettings({ ...current, enabled }, classId);
}

export async function saveMonstersTopics(topics: TopicId[], classId: string): Promise<void> {
  const current = await fetchMonstersSettings(classId);
  await saveMonstersSettings({ ...current, topics }, classId);
}

/** PostgREST's answer when the database has no function with these arguments. */
const NO_SUCH_FUNCTION = 'PGRST202';

/**
 * Maths Monsters' report for one class (migration 20261028000200). Until that migration is on the live database, the server
 * has only the old whole-school report: then that one is loaded instead, with `wholeSchool` set, so the page can say so.
 */
export async function fetchClassMonsters(classId: string): Promise<ClassMonsters & { wholeSchool: boolean }> {
  const { data, error } = await supabase.rpc('teacher_monster_class', { target_class: classId });
  if (error?.code === NO_SUCH_FUNCTION) {
    const old = await supabase.rpc('teacher_monster_class');
    if (old.error || !old.data) fail(old.error, 'We couldn’t load Maths Monsters for the school.');
    return { ...(old.data as ClassMonsters), wholeSchool: true };
  }
  if (error || !data) fail(error, 'We couldn’t load Maths Monsters for this class.');
  return { ...(data as ClassMonsters), wholeSchool: false };
}

export async function fetchStudentMonsters(student: string): Promise<StudentMonsters> {
  const { data, error } = await supabase.rpc('teacher_monster_student', { student });
  if (error || !data) fail(error, 'We couldn’t load their Maths Monsters.');
  return data as StudentMonsters;
}
