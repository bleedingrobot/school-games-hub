/**
 * Archery Challenge's talking to the server (docs/ARCHERY-PLAN.md, section 7).
 *
 * The `archery` server function owns the coins and the gear: every speed-round answer, purchase and fight goes
 * through it, and it hands back the pupil's Armory as it now is. The fight itself is played in the browser from the
 * seed the server gave; when it ends, every shot is sent as a "finish" and the server replays it. A finish that can't
 * be sent (flaky Wi-Fi) waits in a small queue on this device and is sent later, so a won fight is never lost; sending
 * one twice is safe (a fight ends once on the server).
 *
 * The same requests work with the browser-only trial server (src/games/archery/trialBackend.ts) for the preview.
 *
 * Classmate fights (Stage 6) go through the same function one turn at a time. Around them, a `DuelLink` says "I'm here"
 * now and then (and hears who else is, and any challenges), reads a fight, and listens for its changes through Realtime.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { readSettings } from './classSettings';
import { fetchClockOffset, type LiveStatus } from './multiplayer';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';
import type { PublicQuestion } from '../../shared/maths/serverQuestions';
import type { BotLevel } from '../../shared/archery/bot';
import type { ShopKind, ShopProblem } from '../../shared/archery/shop';
import type { SetKind } from '../../shared/archery/speed';
import { parseDuel, parseHere, type DuelRow, type HereReply } from '../../shared/archery/duel';
import type { PlayerSetup, Shot, WorldId } from '../../shared/archery/types';
import type { ArmoryState } from '../../supabase/functions/archery/handler';

export type { ArmoryState };
export type { LiveStatus };

/** Sends one request: the reply's status and body, or null if the server couldn't be reached. */
export type Transport = (body: Record<string, unknown>) => Promise<{ status: number; body: Record<string, unknown> } | null>;

/** The real school server. */
export const serverTransport: Transport = async (body) => {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const response = await fetch(`${SUPABASE_URL}/functions/v1/archery`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
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

/** What a request came to: the reply, or why not (with words to show). */
export type Result<T> = { ok: true; value: T } | { ok: false; why: 'offline' | 'game-off' | 'refused' | 'gear'; message: string };

export interface RoundQuestion {
  question: PublicQuestion;
  limitMs: number;
}

/** Which question set to start: a speed round, the loot chest after a fight, or a restock between rounds. */
export type SetRequest =
  | { kind: 'speed' }
  | { kind: 'chest'; fight: number }
  | { kind: 'chest'; duel: number }
  | { kind: 'restock'; fight: number; step: number };

export interface RoundStart extends RoundQuestion {
  seed: string;
  kind: SetKind;
  /** Does this set earn coins (today's maths coins aren't used up) or is it practice? */
  earns: boolean;
  /** Coins for each right answer in time, before any streak bonus. */
  perRight: number;
  questions: number;
  /** Coins maths can still earn today. */
  coinsLeft: number;
}

export interface RoundAnswer {
  correct: boolean;
  answer: number;
  coins: number;
  /** The pupil's coins now (left out when an answer was sent twice). */
  total?: number;
  right: number;
  next: RoundQuestion | null;
  point?: boolean;
}

export interface FightStart {
  fight: number;
  seed: number;
  world: WorldId;
  opponent: BotLevel;
  pack: PlayerSetup;
  state: ArmoryState;
}

export interface FightEnd {
  result: 'ok' | 'duplicate';
  winner: 0 | 1 | 'draw' | null;
  roundWins: [number, number];
  score: number;
  best: boolean;
  points: number;
  state: ArmoryState;
}

const OFFLINE = 'The school server could not be reached. Check the Wi-Fi and try again.';

/** A random id for a request, so one sent twice counts once. */
export function requestId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const queueKey = (player: string) => `sgh-archery-finish:${player}`;
/** The most finishes waiting to be sent. */
const MAX_QUEUE = 6;

interface QueuedFinish {
  fight: number;
  shots: Shot[];
  left: boolean;
}

function readQueue(player: string): QueuedFinish[] {
  try {
    const raw = JSON.parse(localStorage.getItem(queueKey(player)) ?? '[]') as unknown;
    return Array.isArray(raw) ? (raw as QueuedFinish[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(player: string, items: QueuedFinish[]) {
  try {
    if (items.length) localStorage.setItem(queueKey(player), JSON.stringify(items.slice(-MAX_QUEUE)));
    else localStorage.removeItem(queueKey(player));
  } catch {
    // Storage blocked: a finish that can't be sent is lost (its arrows come back after two hours).
  }
}

/** The calls the game makes, on a transport (the real server, or the preview's trial one). */
export function archeryApi(send: Transport, player = 'me') {
  async function ask<T>(body: Record<string, unknown>): Promise<Result<T>> {
    const r = await send(body);
    if (!r) return { ok: false, why: 'offline', message: OFFLINE };
    const message = typeof r.body.error === 'string' ? r.body.error : '';
    if (r.status === 200) return { ok: true, value: r.body as T };
    if (r.body.code === 'game-off') return { ok: false, why: 'game-off', message };
    if (r.body.code === 'gear') return { ok: false, why: 'gear', message };
    if (r.status >= 500 || r.status === 429) return { ok: false, why: 'offline', message: message || OFFLINE };
    return { ok: false, why: 'refused', message: message || "That couldn't be done." };
  }

  const api = {
    load: () => ask<{ state: ArmoryState; coinsLeft: number }>({ action: 'load' }),
    roundStart: (set: SetRequest = { kind: 'speed' }) => ask<RoundStart>({ action: 'round-start', ...set }),
    /** `value` null means the timer ran out. */
    roundAnswer: (seed: string, slot: number, value: number | null, ms: number) =>
      ask<RoundAnswer>(value === null ? { action: 'round-answer', seed, slot, timedOut: true } : { action: 'round-answer', seed, slot, value, ms: Math.round(ms) }),
    shop: (action: 'buy' | 'sell', kind: ShopKind, item: string, request = requestId()) =>
      ask<{ result: 'ok' | ShopProblem; state: ArmoryState }>({ action, request, kind, item }),
    fightStart: (world: WorldId, opponent: BotLevel, pack: PlayerSetup, request = requestId()) =>
      ask<FightStart>({ action: 'fight-start', request, world, opponent, pack }),
    /** Ends a fight. If the server can't be reached, it's queued on this device and sent later (`queued: true`). */
    async fightFinish(fight: number, shots: Shot[], left = false): Promise<Result<FightEnd> | { ok: false; why: 'queued'; message: string }> {
      const r = await ask<FightEnd>({ action: 'fight-finish', fight, shots, left });
      if (!r.ok && r.why === 'offline') {
        writeQueue(player, [...readQueue(player).filter((q) => q.fight !== fight), { fight, shots, left }]);
        return { ok: false, why: 'queued', message: 'Your fight will be saved when the Wi-Fi is back.' };
      }
      return r;
    },
    /** Sends any queued finishes. 'later' if some still couldn't be sent. */
    async flush(): Promise<'done' | 'later'> {
      const waiting = readQueue(player);
      const left: QueuedFinish[] = [];
      for (const q of waiting) {
        const r = await ask<FightEnd>({ action: 'fight-finish', fight: q.fight, shots: q.shots, left: q.left });
        // Sent, or refused for good (a refusal won't change if sent again): either way it leaves the queue.
        if (!r.ok && r.why === 'offline') left.push(q);
      }
      writeQueue(player, left);
      return left.length ? 'later' : 'done';
    },
    queued: () => readQueue(player).length,

    // ---- Classmate fights: every reply has the fight as it now is (also when it was refused, if there is one) ----
    duelChallenge: (other: string, world: WorldId, request = requestId()) => duel({ action: 'duel-challenge', request, other, world }),
    duelAnswer: (id: number, accept: boolean) => duel({ action: 'duel-answer', duel: id, accept }),
    duelPack: (id: number, pack: PlayerSetup) => duel({ action: 'duel-pack', duel: id, pack }),
    /** `version` is the fight the screen is looking at, so a shot sent twice is played once. */
    duelShot: (id: number, version: number, shot: Shot) => duel({ action: 'shot', duel: id, version, shot }),
    duelTimesUp: (id: number) => duel({ action: 'times-up', duel: id }),
    duelLeave: (id: number) => duel({ action: 'leave', duel: id }),
  };

  async function duel(body: Record<string, unknown>): Promise<DuelResult> {
    const r = await send(body);
    if (!r) return { ok: false, why: 'offline', message: OFFLINE, duel: null };
    const found = parseDuel(r.body.duel);
    const state = r.body.state && typeof r.body.state === 'object' ? (r.body.state as ArmoryState) : undefined;
    if (r.status === 200 && found) {
      const points = Array.isArray(r.body.points) ? (r.body.points as [number, number]) : undefined;
      return { ok: true, duel: found, state, points };
    }
    const message = typeof r.body.error === 'string' ? r.body.error : "That couldn't be done.";
    const code = typeof r.body.code === 'string' ? r.body.code : '';
    const why = r.status >= 500 || r.status === 429 ? 'offline' : code === 'game-off' ? 'game-off' : 'refused';
    return { ok: false, why, message, code, duel: found, state, secondsLeft: typeof r.body.secondsLeft === 'number' ? r.body.secondsLeft : undefined };
  }
  return api;
}

/** What a classmate-fight request came to. A refusal still carries the fight if the server sent it, to show it as it is. */
export type DuelResult =
  | { ok: true; duel: DuelRow; state?: ArmoryState; points?: [number, number] }
  | { ok: false; why: 'offline' | 'game-off' | 'refused'; message: string; code?: string; duel: DuelRow | null; state?: ArmoryState; secondsLeft?: number };

/**
 * Everything around a classmate fight that isn't a move: "I'm here" (and who else is, and any challenges), reading one
 * fight, and hearing its changes as they happen. The real one is `serverDuelLink`; the preview has a stand-in.
 */
export interface DuelLink {
  /** Says "I'm here". Null if the server couldn't be reached. */
  here(): Promise<HereReply | null>;
  /** One of my fights, or null if there's no such fight of mine; 'offline' if it couldn't be read. */
  read(id: number): Promise<DuelRow | null | 'offline'>;
  /** Hears every change to my fights (and new challenges to me). `onDuel` gets null for a change too big to send: read it again. */
  watch(me: string, onDuel: (duel: DuelRow | null, id: number) => void, onLive: (status: LiveStatus) => void): () => void;
  /** How far the server's clock is ahead of this device's (ms), for the turn timer. */
  clockOffset(): Promise<number>;
}

/** The real school server: archery_here(), the archery_duels table (pupils read only their own) and Realtime on it. */
export const serverDuelLink: DuelLink = {
  async here() {
    const { data, error } = await supabase.rpc('archery_here');
    if (error) return null;
    return parseHere(data);
  },
  async read(id) {
    const { data, error } = await supabase.from('archery_duels').select('*').eq('id', id).maybeSingle();
    if (error) return 'offline';
    return data ? parseDuel(data) : null;
  },
  watch(me, onDuel, onLive) {
    // One channel, two filters: fights I started and fights (and challenges) sent to me. Realtime checks the table's
    // rule for every change, so only the two players hear it.
    const heard = (payload: { new?: unknown }) => {
      const raw = payload.new as { id?: unknown } | undefined;
      const id = Number(raw?.id);
      if (!Number.isSafeInteger(id)) return;
      onDuel(parseDuel(raw), id);
    };
    const channel: RealtimeChannel = supabase
      .channel(`archery-duels:${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'archery_duels', filter: `seat_a=eq.${me}` }, heard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'archery_duels', filter: `seat_b=eq.${me}` }, heard)
      .subscribe((status) => onLive(status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' ? 'connecting' : 'down'));
    return () => void supabase.removeChannel(channel);
  },
  clockOffset: () => fetchClockOffset(),
};

export type ArcheryApi = ReturnType<typeof archeryApi>;

/** Is Archery Challenge switched on for this pupil's class (or, for a teacher, the class picked)? */
export async function fetchArcheryEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['archery_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Archery Challenge setting.');
  return row.archery_enabled === true;
}

export async function saveArcheryEnabled(enabled: boolean, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_archery', { enabled, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** Are classmate fights switched on for this class (Stage 7)? On unless a teacher switched them off. */
export async function fetchArcheryDuels(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['archery_duels'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Archery Challenge setting.');
  return row.archery_duels !== false;
}

export async function saveArcheryDuels(enabled: boolean, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_archery_duels', { enabled, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** A few counts for the teacher's panel (never names, coins or maths results). */
export interface ArcherySummary {
  pupils: number;
  /** Pupils who played in the last 7 days. */
  played: number;
  /** Bot fights and classmate fights finished in the last 7 days. */
  botFights: number;
  duels: number;
  /** Speed rounds in the last day. */
  rounds: number;
}

export async function fetchArcherySummary(classId?: string | null): Promise<ArcherySummary> {
  const { data, error } = await supabase.rpc('teacher_archery_summary', { target_class: classId ?? null });
  if (error || !data || typeof data !== 'object') throw new FriendlyError('We couldn’t load the Archery Challenge summary.');
  const r = data as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return { pupils: n(r.pupils), played: n(r.played), botFights: n(r.botFights), duels: n(r.duels), rounds: n(r.rounds) };
}
