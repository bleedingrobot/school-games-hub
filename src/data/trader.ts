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
  /** Today's questions, in the order they are used, without their answers. */
  questions: PublicQuestion[];
  settings: { jumpsPerDay: number; loans: boolean; maths: boolean };
  /** The school news today (biggest first). */
  news?: NewsItem[];
}

/** What a move came to. */
export interface MoveReply {
  game: Game;
  version: number;
  answers: Marked[];
  trade?: { spent: number; earned: number; sharp: boolean };
  encounter?: Encounter;
  customs?: { taken: number; fine: number };
  fight?: { fight: Fight; tier: number; over: boolean };
  junk?: { steeredWell: boolean };
  deal?: { took: boolean };
  /** After a jump: the school news, read as the ship landed. */
  news?: NewsItem[];
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
