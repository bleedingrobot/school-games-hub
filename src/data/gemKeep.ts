/**
 * Gem Keep's saving and loading.
 *
 * Everything to save goes into a queue kept in this browser (one per student), and the queue
 * is sent to the gem-keep server function whenever it can be: after each level, after a
 * Level Key, when the student leaves, and when Gem Keep opens again. A dropped Wi-Fi
 * connection just means it goes later. Sending an item twice is safe (see shared/gem-keep/save.ts).
 *
 * A copy of the student's progress, fact records and the teacher's settings is kept here too,
 * so Gem Keep still opens with everything in place when the server can't be reached.
 */
import type { SaveItem, SaveResponse } from '../../shared/gem-keep/save';
import type { FactStats } from '../../shared/maths/leitner';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import type { CampaignProgress } from '../games/gem-keep/progress';
import { DEFAULT_SETTINGS, type GemKeepSettings } from '../games/gem-keep/settings';
import { FriendlyError } from './profile';

export interface GemKeepData {
  progress: CampaignProgress;
  facts: FactStats[];
  settings: GemKeepSettings;
  /** The class trial's progress on this device may still be brought in. */
  canImport: boolean;
}

interface ServerData {
  progress: { levelId: string; stars: number; keyPassed: boolean }[];
  facts: FactStats[];
  settings: Omit<GemKeepSettings, 'missingFactor'> & { missingFactor: boolean | null };
  canImport: boolean;
}

// ---------------------------------------------------------------------------
// Browser storage (each read and write can fail: private windows, blocked storage)
// ---------------------------------------------------------------------------

const queueKey = (player: string) => `sgh-gem-keep-queue:${player}`;
const copyKey = (player: string) => `sgh-gem-keep-copy:${player}`;
/** Where the class trial kept progress (16–17 Oct 2026), for every student on the device. */
export const TRIAL_KEY = 'sgh-gem-keep-progress';

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
    // Storage blocked: the queue lasts until the page closes.
  }
}

/** Kept in memory as well, in case storage is blocked. */
const memoryQueues = new Map<string, SaveItem[]>();

export function queuedItems(player: string): SaveItem[] {
  return memoryQueues.get(player) ?? read<SaveItem[]>(queueKey(player)) ?? [];
}

function setQueue(player: string, items: SaveItem[]) {
  memoryQueues.set(player, items);
  write(queueKey(player), items.length ? items : null);
}

/** The longest the queue may grow. */
const MAX_QUEUE = 200;

export function enqueue(player: string, item: SaveItem) {
  let items = queuedItems(player);
  if (item.type === 'facts') items = items.filter((i) => i.type !== 'facts');
  setQueue(player, [...items, item].slice(-MAX_QUEUE));
}

/** The trial's progress on this device, if there's any to bring in. */
export function trialProgress(): CampaignProgress | null {
  const saved = read<CampaignProgress>(TRIAL_KEY);
  return saved && typeof saved === 'object' && Object.keys(saved).length > 0 ? saved : null;
}

export function saveCopy(player: string, data: GemKeepData) {
  write(copyKey(player), data);
}

// ---------------------------------------------------------------------------
// The server
// ---------------------------------------------------------------------------

/** Items per request: the server's MAX_ITEMS (not imported, so the levels stay out of this file's chunk). */
const MAX_ITEMS = 40;

/** One send at a time, so two saves can't race each other. */
let chain: Promise<unknown> = Promise.resolve();

/**
 * Sends the queue. Items the server has dealt with leave it; the rest wait for next time.
 * Never throws: says whether everything got through.
 */
export function flushQueue(player: string, keepalive = false): Promise<boolean> {
  const next = chain.then(() => sendQueue(player, keepalive));
  chain = next.catch(() => false);
  return next;
}

async function sendQueue(player: string, keepalive: boolean): Promise<boolean> {
  const items = queuedItems(player);
  if (items.length === 0) return true;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return false;
    const batch = items.slice(0, MAX_ITEMS);
    const response = await fetch(`${SUPABASE_URL}/functions/v1/gem-keep`, {
      method: 'POST',
      keepalive,
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: batch }),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as SaveResponse;
    const handled = Math.max(0, Math.min(batch.length, body.handled ?? 0));
    // Take out what was dealt with. Anything added (or replaced) while sending stays.
    const gone = new Set(batch.slice(0, handled).map((i) => JSON.stringify(i)));
    const left = queuedItems(player).filter((i) => !gone.has(JSON.stringify(i)));
    setQueue(player, left);
    return left.length === 0;
  } catch {
    // Offline: it goes next time.
    return false;
  }
}

function fromServer(raw: ServerData): GemKeepData {
  const progress: CampaignProgress = {};
  for (const p of raw.progress) progress[p.levelId] = { stars: p.stars, keyPassed: p.keyPassed };
  const { missingFactor, ...rest } = raw.settings;
  return {
    progress,
    facts: raw.facts,
    settings: { ...DEFAULT_SETTINGS, ...rest, missingFactor: missingFactor ?? undefined },
    canImport: raw.canImport,
  };
}

/**
 * Everything Gem Keep needs to open, from the server if it can be reached (after sending
 * anything still queued), else the copy kept in this browser, else a fresh start.
 * `offline` says the server couldn't be reached.
 */
export async function loadGemKeep(player: string): Promise<GemKeepData & { offline: boolean }> {
  await flushQueue(player);
  try {
    const { data, error } = await supabase.rpc('my_gem_keep');
    if (error || !data) throw error ?? new Error('no data');
    let loaded = fromServer(data as ServerData);
    const trial = loaded.canImport ? trialProgress() : null;
    if (trial) {
      enqueue(player, {
        type: 'import',
        levels: Object.entries(trial).map(([levelId, p]) => ({ levelId, stars: p.stars, keyPassed: p.keyPassed })),
      });
      if (await flushQueue(player)) {
        // Brought in (or not needed): it can't be brought in again, even by someone else on this device.
        write(TRIAL_KEY, null);
        const again = await supabase.rpc('my_gem_keep');
        if (!again.error && again.data) loaded = fromServer(again.data as ServerData);
      }
    }
    saveCopy(player, loaded);
    return { ...loaded, offline: false };
  } catch {
    const copy = read<GemKeepData>(copyKey(player));
    return { ...(copy ?? { progress: {}, facts: [], settings: DEFAULT_SETTINGS, canImport: false }), offline: true };
  }
}

// ---------------------------------------------------------------------------
// Leaderboard and teachers
// ---------------------------------------------------------------------------

export interface StarsRow {
  place: number;
  display_name: string;
  avatar: unknown;
  stars: number;
  level_keys: number;
  is_me: boolean;
}

export async function fetchStarsBoard(): Promise<StarsRow[]> {
  const { data, error } = await supabase.rpc('gem_keep_leaderboard');
  if (error || !data) throw new FriendlyError('We couldn’t load the leaderboard.');
  return data as StarsRow[];
}

export interface StudentGemKeep {
  levels: { levelId: string; stars: number; keyPassed: boolean; plays: number; wins: number }[];
  facts: FactStats[];
  lastPlayed: string | null;
}

export interface ClassGemKeep {
  players: number;
  levels: { levelId: string; won: number; keys: number }[];
  hardest: { key: string; students: number; attempts: number; correct: number }[];
}

/** Messages we wrote in the database are safe to show; anything else gets the fallback. */
function fail(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code === '22023' && error.message) throw new FriendlyError(error.message);
  throw new FriendlyError(fallback);
}

export async function fetchStudentGemKeep(student: string): Promise<StudentGemKeep> {
  const { data, error } = await supabase.rpc('teacher_gem_keep_student', { student });
  if (error || !data) fail(error, 'We couldn’t load their Gem Keep.');
  return data as StudentGemKeep;
}

export async function fetchClassGemKeep(): Promise<ClassGemKeep> {
  const { data, error } = await supabase.rpc('teacher_gem_keep_class');
  if (error || !data) fail(error, 'We couldn’t load Gem Keep for the class.');
  return data as ClassGemKeep;
}

export async function fetchGemKeepSettings(): Promise<GemKeepSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('gem_keep_mode, gem_keep_tables, gem_keep_division, gem_keep_missing_factor, gem_keep_multiple_choice, gem_keep_key_pass')
    .maybeSingle();
  if (error || !data) throw new FriendlyError('We couldn’t load the Gem Keep settings.');
  return {
    mode: data.gem_keep_mode,
    enabledTables: data.gem_keep_tables,
    division: data.gem_keep_division,
    missingFactor: data.gem_keep_missing_factor ?? undefined,
    multipleChoice: data.gem_keep_multiple_choice,
    keyPassMark: data.gem_keep_key_pass,
  };
}

export async function saveGemKeepSettings(settings: GemKeepSettings): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_gem_keep', {
    settings: { ...settings, missingFactor: settings.missingFactor ?? null },
  });
  if (error) fail(error, 'We couldn’t save the Gem Keep settings.');
}
