/**
 * The Archery Challenge server function (docs/ARCHERY-PLAN.md, section 7). The server owns the coins and the gear:
 *
 *   load          the pupil's Armory (coins, gear, shields, bows, spent, best scores) and coin-earning rounds left today;
 *   round-start   a speed round: makes the round's questions from the pupil's maths focus, keeps them where pupils can't
 *                 read them, and sends the first one with its time limit;
 *   round-answer  marks one answer (once), checks the timer twice, adds coins, records the answer for the maths records,
 *                 and sends the next question;
 *   buy / sell    one Armory purchase or sale (a request sent twice counts once);
 *   fight-start   takes the packed quiver out of the pupil's gear and hands out the fight's seed;
 *   fight-finish  replays the whole fight (checking every bot shot is the bot's own), gives back what wasn't used, keeps
 *                 a best score and gives points. With `left: true` it's a fight given up part-way (no points).
 *   duel-challenge, duel-answer, duel-pack, shot, times-up, leave
 *                 fights against classmates, one shot at a time, each played by the server's engine (duels.ts).
 *
 * Nothing that counts comes from the browser: prices are the shop's, coins come only from answers marked here, and a
 * fight's result comes from replaying it here. Everything is refused while the teacher's switch is off.
 */
import type { FactAnswer } from '../../../shared/maths/leitner';
import { publicQuestion, seededRandom } from '../../../shared/maths/serverQuestions';
import type { Question } from '../../../shared/maths/skillPack';
import { BOT_LEVELS, botSetup, type BotLevel } from '../../../shared/archery/bot';
import { judgeBotFight, readShots } from '../../../shared/archery/judge';
import { FIGHT_POINTS, ROUND_POINTS, WIN_POINTS } from '../../../shared/archery/points';
import {
  CARRY_MOST, LEVEL_SPEND, readPack, sellPrice, shopItem, shopItems, unused, type Armory, type ShopProblem,
} from '../../../shared/archery/shop';
import {
  COINS_PER_RIGHT, EARNING_ROUNDS_PER_DAY, POINT_AT, inTime, limitMs, makeRoundQuestions, markQuestion, recordedMs, sameAnswer,
  type MathsContext,
} from '../../../shared/archery/speed';
import { WORLD_IDS, type ItemId, type PlayerSetup, type WorldId } from '../../../shared/archery/types';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';
import { DUEL_ACTIONS, handleDuel, type DuelAction, type DuelServices } from './duels';

/** 'refused' (the database said no) and 'busy' (couldn't reach it). */
export type Outcome<T> = { ok: true; value: T } | { ok: false; why: 'refused' | 'busy' };

/** A pupil's Armory as the database gives it back. */
export interface ArmoryState extends Armory {
  best: Partial<Record<WorldId, number>>;
}

export interface StoredRound {
  questions: Question[];
  /** When each question was sent (ms since 1970). */
  served: Record<string, number>;
  answered: Record<string, { value: number | null; right: boolean; coins: number }>;
  earns: boolean;
}

export interface StoredFight {
  seed: number;
  world: WorldId;
  opponent: BotLevel;
  pack: PlayerSetup;
  status: 'playing' | 'done' | 'left' | 'abandoned';
}

export interface Services extends DuelServices {
  userIdFor(token: string): Promise<string | null>;
  /** Is the game on for this pupil's class (null if the settings can't be read)? */
  enabled(player: string): Promise<boolean | null>;
  mathsContext(player: string): Promise<MathsContext | null>;
  /** The Armory, made the first time, with coin-earning rounds played in the last day. */
  state(player: string): Promise<Outcome<ArmoryState & { roundsToday: number }>>;
  shop(player: string, request: string, action: 'buy' | 'sell', kind: string, item: string, price: number, qty: number, needSpent: number, carry: number): Promise<Outcome<{ result: 'ok' | ShopProblem; state: ArmoryState }>>;
  roundStart(player: string, seed: string, questions: Question[], earns: boolean, servedMs: number): Promise<boolean>;
  roundLoad(player: string, seed: string): Promise<StoredRound | null | 'busy'>;
  roundAnswer(player: string, seed: string, slot: number, value: number | null, right: boolean, coins: number, nextMs: number | null): Promise<{ claimed: boolean; coins?: number } | 'busy'>;
  fightStart(player: string, request: string, seed: number, world: WorldId, opponent: BotLevel, pack: PlayerSetup): Promise<Outcome<{ result: 'ok' | 'gear'; fight?: number; state: ArmoryState }>>;
  fightLoad(player: string, fight: number): Promise<StoredFight | null | 'busy'>;
  fightEnd(player: string, fight: number, status: 'done' | 'left', back: Partial<Record<ItemId, number>>, score: number, won: boolean): Promise<Outcome<{ result: 'ok' | 'duplicate'; best: boolean; state: ArmoryState }>>;
  /** Adds answers to the pupil's maths records (sent twice, counted once). A failure is only logged. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Gives hub points (once per `once`). A failure is only logged. */
  awardPoints(player: string, points: number, once: string): Promise<void>;
  now(): number;
  randomHex(bytes: number): string;
}

/** Requests one pupil may make a minute (a speed round is 11; a fight is 2; a busy Armory visit a dozen). */
export const MAX_REQUESTS_PER_MINUTE = 90;

/** An Armory with everything, for checking a quiver's shape. */
const EVERYTHING: Armory = {
  coins: 0, spent: 0, shields: ['wood', 'charm', 'bubble'], bows: ['long', 'recurve', 'hunter', 'golden'],
  gear: Object.fromEntries(shopItems().filter((i) => i.kind === 'gear').map((i) => [i.id, CARRY_MOST])),
};

const isRequestId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(v);
const isSeed = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9-]{10,80}$/.test(v);

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleArchery(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    const busy = (what = 'That') => reply(503, { error: `${what} couldn't be done just now. Try again in a moment.` });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const player = token ? await services.userIdFor(token) : null;
    if (!player) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(player, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    const raw = await readJsonBody(request);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return reply(400, { error: "That couldn't be read." });
    const body = raw as Record<string, unknown>;

    // The teacher's switch decides everything. If it can't be read, nothing happens. While it's off, a classmate fight
    // can still be ended fairly (duels.ts), but nothing can be played.
    const on = await services.enabled(player);
    if (on === null) return busy('The Armory');
    const duelAction = DUEL_ACTIONS.includes(body.action as DuelAction) ? (body.action as DuelAction) : null;
    if (duelAction && (on || duelAction === 'shot' || duelAction === 'times-up' || duelAction === 'leave')) {
      const r = await handleDuel(services, player, duelAction, body, on, EVERYTHING);
      return reply(r.status, r.body);
    }
    if (!on) return reply(403, { error: 'Archery Challenge is not switched on for your class.', code: 'game-off' });

    switch (body.action) {
      case 'load': {
        const s = await services.state(player);
        if (!s.ok) return busy('Your Armory');
        return reply(200, { state: withoutCount(s.value), roundsLeft: Math.max(0, EARNING_ROUNDS_PER_DAY - s.value.roundsToday) });
      }

      case 'round-start': {
        const s = await services.state(player);
        if (!s.ok) return busy('The speed round');
        const earns = s.value.roundsToday < EARNING_ROUNDS_PER_DAY;
        const context = await services.mathsContext(player);
        if (!context) return busy('The speed round');
        const seed = services.randomHex(12);
        const questions = makeRoundQuestions(context, seededRandom(seed));
        if (!questions.length) return busy('The speed round');
        const at = services.now();
        if (!(await services.roundStart(player, seed, questions, earns, at))) return busy('The speed round');
        return reply(200, {
          seed, earns, questions: questions.length, question: publicQuestion(questions[0], 0), limitMs: limitMs(0),
          roundsLeft: Math.max(0, EARNING_ROUNDS_PER_DAY - s.value.roundsToday - (earns ? 1 : 0)),
        });
      }

      case 'round-answer': {
        const { seed, slot } = body;
        const timedOut = body.timedOut === true;
        const value = body.value;
        if (!isSeed(seed) || !Number.isInteger(slot) || (slot as number) < 0 || (slot as number) > 20) return reply(400, { error: "That answer couldn't be read." });
        if (!timedOut && (typeof value !== 'number' || !Number.isFinite(value) || value < -1_000_000 || value > 1_000_000)) return reply(400, { error: "That answer couldn't be read." });
        const round = await services.roundLoad(player, seed);
        if (round === 'busy') return busy('Marking');
        const at = slot as number;
        const marked = round ? markQuestion(round.questions[at]) : null;
        if (!round || !marked || round.served[String(at)] === undefined) return reply(400, { error: "That answer couldn't be marked." });
        const sentAt = round.served[String(at)];
        const before = round.answered[String(at)];
        const nextSlot = at + 1 < round.questions.length ? at + 1 : null;
        const rightSoFar = Object.values(round.answered).filter((a) => a.right).length;
        if (before) {
          // The same answer sent again (the first reply was lost): the same reply, counted once.
          const same = timedOut ? before.value === null : before.value !== null && sameAnswer(before.value, value as number);
          if (!same) return reply(400, { error: "You've already answered that one." });
          return reply(200, answerReply(round, before.right, marked.answer, before.coins, null, nextSlot, rightSoFar, undefined));
        }
        const now = services.now();
        const ago = Math.max(0, now - sentAt);
        const claimedMs = typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : ago;
        const correct = !timedOut && sameAnswer(value as number, marked.answer);
        const coins = correct && round.earns && inTime(at, claimedMs, ago) ? COINS_PER_RIGHT : 0;
        const done = await services.roundAnswer(player, seed, at, timedOut ? null : (value as number), correct, coins, nextSlot === null ? null : now);
        if (done === 'busy') return busy('Marking');
        if (!done.claimed) return reply(400, { error: "You've already answered that one." });
        // A late answer is still right for the maths records (with its real time); a timed-out one isn't recorded.
        if (!timedOut) await safely(() => services.recordAnswers(player, `${seed}:${at}`, [{ key: marked.key, correct, ms: recordedMs(claimedMs, ago), at: now }]));
        const right = rightSoFar + (correct ? 1 : 0);
        let point = false;
        if (nextSlot === null && right >= POINT_AT) {
          point = true;
          await safely(() => services.awardPoints(player, ROUND_POINTS, `archery-round:${seed}`));
        }
        return reply(200, { ...answerReply(round, correct, marked.answer, coins, done.coins ?? null, nextSlot, right, point) });
      }

      case 'buy':
      case 'sell': {
        const item = shopItem(body.kind, body.item);
        if (!item || !isRequestId(body.request)) return reply(400, { error: "That isn't in the Armory." });
        const action = body.action;
        const price = action === 'buy' ? item.price : sellPrice(item);
        const done = await services.shop(player, body.request, action, item.kind, item.id, price, action === 'buy' ? item.qty : 1, LEVEL_SPEND[item.level - 1] ?? 0, CARRY_MOST);
        if (!done.ok) return done.why === 'refused' ? reply(400, { error: "That couldn't be done." }) : busy('The Armory');
        return reply(200, done.value);
      }

      case 'fight-start': {
        const world = body.world as WorldId;
        const opponent = body.opponent as BotLevel;
        if (!WORLD_IDS.includes(world) || !BOT_LEVELS.includes(opponent) || !isRequestId(body.request)) return reply(400, { error: "That fight couldn't be started." });
        // Only its shape is checked here: the database checks the pupil really has it all (and a request sent twice
        // gets its first reply, after the gear was already packed).
        const packed = readPack(body.pack, EVERYTHING);
        if ('problem' in packed) return reply(400, { error: "You don't have all of that in your bag.", code: 'gear' });
        const seed = parseInt(services.randomHex(4), 16) >>> 0;
        const done = await services.fightStart(player, body.request, seed, world, opponent, packed.pack);
        if (!done.ok) return done.why === 'refused' ? reply(400, { error: "That fight couldn't be started." }) : busy('The fight');
        if (done.value.result !== 'ok') return reply(400, { error: "You don't have all of that in your bag.", code: 'gear', state: done.value.state });
        // The seed the database kept (the first reply's, if this request was sent twice).
        const kept = await services.fightLoad(player, done.value.fight as number);
        if (kept === 'busy' || !kept) return busy('The fight');
        return reply(200, { fight: done.value.fight, seed: kept.seed, world: kept.world, opponent: kept.opponent, pack: kept.pack, state: done.value.state });
      }

      case 'fight-finish': {
        const id = body.fight;
        const shots = readShots(body.shots);
        const left = body.left === true;
        if (!Number.isSafeInteger(id) || (id as number) < 1 || !shots) return reply(400, { error: "That fight couldn't be read." });
        const fight = await services.fightLoad(player, id as number);
        if (fight === 'busy') return busy('Saving the fight');
        if (!fight) return reply(400, { error: "That fight couldn't be found." });
        const setup = { world: fight.world, players: [fight.pack, botSetup(fight.opponent)] as [PlayerSetup, PlayerSetup] };
        const judged = judgeBotFight(fight.seed, setup, fight.opponent, shots, !left);
        if (!judged.ok) {
          // Logs say what was wrong, never who sent it.
          console.warn(`archery: refused a fight (${judged.problem})`);
          return reply(400, { error: "That fight couldn't be saved." });
        }
        const f = judged.fight;
        const won = f.winner === 0;
        const done = await services.fightEnd(player, id as number, left ? 'left' : 'done', unused(fight.pack, f.used), f.score, won);
        if (!done.ok) return done.why === 'refused' ? reply(400, { error: "That fight couldn't be saved." }) : busy('Saving the fight');
        let points = 0;
        if (!left && done.value.result === 'ok') {
          points = won ? WIN_POINTS : FIGHT_POINTS;
          await safely(() => services.awardPoints(player, points, `archery-fight:${id}`));
        }
        return reply(200, { result: done.value.result, winner: f.winner, roundWins: f.roundWins, score: f.score, best: done.value.best, points, state: done.value.state });
      }
    }
    return reply(400, { error: "That couldn't be read." });
  };
}

/** The reply to an answer: right or not, the right answer, coins, and the next question (null at the end). */
function answerReply(round: StoredRound, correct: boolean, answer: number, coins: number, total: number | null, nextSlot: number | null, right: number, point: boolean | undefined) {
  return {
    correct, answer, coins, ...(total === null ? {} : { total }), right,
    next: nextSlot === null ? null : { question: publicQuestion(round.questions[nextSlot], nextSlot), limitMs: limitMs(nextSlot) },
    ...(point === undefined ? {} : { point }),
  };
}

function withoutCount(s: ArmoryState & { roundsToday: number }): ArmoryState {
  const { roundsToday: _skip, ...rest } = s;
  void _skip;
  return rest;
}

/** Records and points are a bonus: if they fail, the round or fight is never lost over them. */
async function safely(f: () => Promise<void>): Promise<void> {
  try {
    await f();
  } catch {
    console.error('archery: the maths records or points could not be updated');
  }
}
