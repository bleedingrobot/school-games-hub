/**
 * Star Trader's talking to the server (docs/TRADER-PLAN.md, section 10).
 *
 * The `trader` server function keeps each pupil's game and works out every move itself; the browser asks and shows what
 * comes back. Every request carries the game version it was made from and a request id: one sent twice counts once (so a
 * flaky connection can safely try again), and one made from an old version (another tab or device moved the game on) is
 * refused with a hint to reload. The same requests work with the browser-only trial server for the preview.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';
import type { PublicQuestion } from '../../shared/maths/serverQuestions';
import type { Encounter } from '../../shared/trader/encounter';
import type { NewsItem } from '../../shared/trader/news';
import type { Fight, FightAction } from '../../shared/trader/fight';
import type { Action, Ask, Game, Marked } from '../../shared/trader/server';
import type { GalleryEntry, StickerId } from '../../shared/trader/gallery';
import type { SystemDesign } from '../../shared/trader/system';

/** Sends one request: the reply's status and body, or null if the server couldn't be reached. */
export type Transport = (body: Record<string, unknown>, options?: { keepalive?: boolean }) => Promise<{ status: number; body: Record<string, unknown> } | null>;

/** The real school server. */
export const serverTransport: Transport = async (body, options) => {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const response = await fetch(`${SUPABASE_URL}/functions/v1/trader`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      keepalive: options?.keepalive === true,
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let parsed: Record<string, unknown> = {};
    try {
      parsed = (await response.json()) as Record<string, unknown>;
    } catch {
      // An empty or broken reply: the status still says what happened.
    }
    return { status: response.status, body: parsed };
  } catch {
    return null;
  }
};

export interface Loaded {
  galaxySeed: string;
  season: number;
  game: Game;
  version: number;
  day: number;
  /**
   * Set instead of the game when the pupil built a system last season and has not chosen yet: `game`, `version` and
   * `questions` are then missing. Show the choice, then call `chooseSeason` (nothing else works until they do).
   */
  seasonChoice?: SeasonChoice;
  /** Today's questions, in the order they are used, without their answers. */
  questions: PublicQuestion[];
  settings: { jumpsPerDay: number; loans: boolean; maths: boolean; /** The Star Forge is open for this class. */ forge?: boolean; /** Pupils may type names in the Forge (missing: yes). */ forgeTyping?: boolean };
  /** The school news today (biggest first). */
  news?: NewsItem[];
  /** The school's pushes on prices right now: [planet, good, push]. */
  prices?: [number, number, number][];
}

/** The New Season choice (docs/TRADER-SYSTEM-PLAN.md, 1.2): last season's system, and what starting fresh would keep (credits already capped). */
export interface SeasonChoice {
  name: string;
  worth: number;
  carry: { ship: number; credits: number };
}

/** What a move came to. */
export interface MoveReply {
  game: Game;
  version: number;
  answers: Marked[];
  /** After a Star Forge change: what it cost (positive: paid) and what the system is worth now. */
  forge?: { total: number; worth: number };
  trade?: { spent: number; earned: number; sharp: boolean };
  encounter?: Encounter;
  customs?: { taken: number; fine: number };
  fight?: { fight: Fight; tier: number; over: boolean };
  junk?: { steeredWell: boolean };
  deal?: { took: boolean };
  /** After a jump: the school news and pushes, read as the ship landed. */
  news?: NewsItem[];
  prices?: [number, number, number][];
}

export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; kind: 'offline' | 'off' | 'stale' | 'refused' | 'busy' | 'signin'; message: string; game?: Game; version?: number };

export interface TraderApi {
  load(): Promise<ApiResult<Loaded>>;
  act(version: number, actions: Action[], options?: { keepalive?: boolean }): Promise<ApiResult<MoveReply>>;
  fight(version: number, move: FightAction, ask?: Ask): Promise<ApiResult<MoveReply>>;
  junk(version: number, ask?: Ask): Promise<ApiResult<MoveReply>>;
  deal(version: number, take: boolean): Promise<ApiResult<MoveReply>>;
  /**
   * New Season: keep last season's system (and start the ship again) or start fresh (keeping the ship and capped
   * credits). `picture` (fresh only) is the path of the saved picture, which must start with the pupil's own id and a slash.
   */
  chooseSeason(choice: 'keep' | 'fresh', picture?: string): Promise<ApiResult<Loaded>>;
  /** The class gallery: classmates' built systems, own first (docs/TRADER-SYSTEM-PLAN.md, section 7). */
  gallery(): Promise<ApiResult<{ systems: GalleryEntry[] }>>;
  /** Leave, change or (null) take back a sticker on a classmate's system. */
  sticker(owner: string, sticker: StickerId | null): Promise<ApiResult<{ sticker: StickerId | null }>>;
  /** Save the gallery picture (a base64 .webp). `saved` is false if the last one was too recent. */
  savePicture(webp: string): Promise<ApiResult<{ saved: boolean }>>;
}

const newRequestId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function traderApi(send: Transport): TraderApi {
  async function call<T>(body: Record<string, unknown>, options?: { keepalive?: boolean }): Promise<ApiResult<T>> {
    // One more try on a dropped connection: the same request id means the server counts it once.
    const res = (await send(body, options)) ?? (await send(body, options));
    if (!res) return { ok: false, kind: 'offline', message: "We couldn't reach the school server. Check your Wi-Fi and try again." };
    const message = typeof res.body.error === 'string' ? res.body.error : 'Something went wrong. Please try again.';
    if (res.status === 200) return { ok: true, value: res.body as unknown as T };
    if (res.status === 401) return { ok: false, kind: 'signin', message };
    if (res.status === 403) return { ok: false, kind: 'off', message };
    if (res.status === 409) return { ok: false, kind: 'stale', message };
    if (res.status === 400) return { ok: false, kind: 'refused', message, game: res.body.game as Game | undefined, version: res.body.version as number | undefined };
    return { ok: false, kind: 'busy', message };
  }
  return {
    load: () => call<Loaded>({ action: 'load' }),
    act: (version, actions, options) => call<MoveReply>({ action: 'act', requestId: newRequestId(), version, actions }, options),
    fight: (version, move, ask) => call<MoveReply>({ action: 'fight', requestId: newRequestId(), version, move, ...(ask ? { ask } : {}) }),
    junk: (version, ask) => call<MoveReply>({ action: 'junk', requestId: newRequestId(), version, ...(ask ? { ask } : {}) }),
    deal: (version, take) => call<MoveReply>({ action: 'deal', requestId: newRequestId(), version, take }),
    chooseSeason: (choice, picture) => call<Loaded>({ action: 'load', seasonChoice: choice, ...(picture ? { picture } : {}) }),
    gallery: () => call({ action: 'gallery' }),
    sticker: (owner, sticker) => call({ action: 'sticker', owner, sticker }),
    savePicture: (webp) => call({ action: 'picture', picture: webp }),
  };
}

/** Is Star Trader switched on for this class? (Teachers use this, and the dashboard card.) */
export async function fetchTraderEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['trader_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Star Trader setting.');
  return row.trader_enabled === true;
}

export interface TraderSettings {
  enabled: boolean;
  jumps: number;
  loans: boolean;
  maths: 'off' | 'choose' | 'on';
}

export async function fetchTraderSettings(classId?: string | null): Promise<TraderSettings> {
  const row = await readSettings(['trader_enabled', 'trader_jumps', 'trader_loans', 'trader_maths'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Star Trader settings.');
  return {
    enabled: row.trader_enabled === true,
    jumps: typeof row.trader_jumps === 'number' ? row.trader_jumps : 10,
    loans: row.trader_loans !== false,
    maths: row.trader_maths === 'off' || row.trader_maths === 'on' ? row.trader_maths : 'choose',
  };
}

export async function saveTraderSettings(s: TraderSettings, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_trader', { enabled: s.enabled, jumps: s.jumps, loans: s.loans, maths: s.maths, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** Teacher: put one pupil's ship back at the start. */
export async function resetTraderShip(student: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_reset_trader', { student });
  if (error) throw new FriendlyError('We couldn’t reset that ship.');
}

/** Teacher: is the Star Forge open for this class? */
export async function fetchTraderForge(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['trader_forge'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Star Forge setting.');
  return row.trader_forge === true;
}

/** Teacher: open or close the Star Forge for a class (or the whole school's default). */
export async function saveTraderForge(enabled: boolean, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_trader_forge', { enabled, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** Teacher: can pupils type their own names in the Star Forge? (On unless switched off.) */
export async function fetchTraderForgeTyping(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['trader_forge_typing'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Forge names setting.');
  return row.trader_forge_typing !== false;
}

/** Teacher: let pupils type Forge names, or use only the word lists, for a class (or the whole school's default). */
export async function saveTraderForgeTyping(enabled: boolean, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_trader_forge_typing', { enabled, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** Teacher: take away every name one pupil typed in the Star Forge (the word-list names stay). */
export async function clearTraderForgeNames(student: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_clear_trader_names', { target: student });
  if (error) throw new FriendlyError('We couldn’t clear those names.');
}

/** Teacher: the built systems of one class's pupils, for the projector tour (system names only, never pupils'). */
export async function fetchClassSystems(classId: string): Promise<SystemDesign[]> {
  const { data, error } = await supabase.rpc('teacher_trader_class_systems', { target_class: classId });
  if (error) throw new FriendlyError('We couldn’t load the class’s systems.');
  return Array.isArray(data) ? (data as SystemDesign[]) : [];
}
