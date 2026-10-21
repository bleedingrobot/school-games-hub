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
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import type { PublicQuestion } from '../../shared/maths/serverQuestions';
import type { BotLevel } from '../../shared/archery/bot';
import type { ShopKind, ShopProblem } from '../../shared/archery/shop';
import type { PlayerSetup, Shot, WorldId } from '../../shared/archery/types';
import type { ArmoryState } from '../../supabase/functions/archery/handler';

export type { ArmoryState };

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

export interface RoundStart extends RoundQuestion {
  seed: string;
  /** Does this round earn coins (one of the day's first rounds) or is it practice? */
  earns: boolean;
  questions: number;
  roundsLeft: number;
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
    load: () => ask<{ state: ArmoryState; roundsLeft: number }>({ action: 'load' }),
    roundStart: () => ask<RoundStart>({ action: 'round-start' }),
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
  };
  return api;
}

export type ArcheryApi = ReturnType<typeof archeryApi>;
