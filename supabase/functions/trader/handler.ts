/**
 * The Star Trader server function (docs/TRADER-PLAN.md, section 10). The server keeps each pupil's game and works out
 * every move itself with the shared rules (shared/trader/server.ts); the browser only asks. Jobs:
 *
 *   load   today's game (made on first play, rolled to a new day when it is one), the school's galaxy seed, the teacher's
 *          settings, and today's maths questions (without their answers);
 *   act    a batch of moves (trades, fuel, the shipyard, the bank, a jump), checked in order, all or nothing;
 *   fight  one round of the pirate fight in progress (charging the lasers carries a maths answer);
 *   junk   steering through space junk (a maths answer);
 *   deal   a friendly trader's offer, taken or left.
 *
 * The school's shared market (stage T.4): prices are read with the school's push when a pupil lands (load and jump) and
 * fixed for the visit; a trade's push on the school's prices is saved in the same database step as the game, so it counts
 * once. The news comes back in the load and jump replies the pupil already gets, never as a request of its own.
 *
 * Every request carries the game version it was worked out from and a request id: a request sent twice counts once (the
 * first reply is sent again), and one made from an old version (another tab or device moved the game on) is refused with
 * the current game, so nothing is lost or counted twice. A refused request never uses up a question.
 */
import type { Question } from '../../../shared/maths/skillPack';
import { publicQuestion, type PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QUESTIONS_PER_DAY, makeDayQuestions, markQuestion, sameAnswer, type MathsContext } from '../../../shared/trader/questions';
import type { FactAnswer } from '../../../shared/maths/leitner';
import { makeGalaxy, type Galaxy } from '../../../shared/trader/galaxy';
import {
  applyBatch,
  applyDeal,
  applyFight,
  applyJunk,
  newGame,
  netWorthOf,
  rollDay,
  type Action,
  type Ask,
  type Game,
  type Mark,
  type Reply,
  type Settings,
} from '../../../shared/trader/server';
import type { FightAction } from '../../../shared/trader/fight';
import { newsFor, type NewsItem } from '../../../shared/trader/news';
import { EMPTY_VIEW, pushesFrom, type MarketPush, type SchoolView } from '../../../shared/trader/schoolMarket';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

/** What the teacher has set for a pupil's class. */
export interface ClassSettings extends Settings {
  enabled: boolean;
}

export interface Saved {
  game: Game;
  version: number;
  season: number;
}

export interface StoredDay {
  questions: Question[];
  answered: Record<string, { value: number; right: boolean }>;
}

export interface SaveArgs {
  expectedVersion: number;
  game: Game;
  day: number;
  netWorth: number;
  season: number;
  requestId: string;
  reply: unknown;
  claims: Record<string, { value: number; right: boolean }>;
  /** What the trades do to the school's market, applied in the same database step as the save. */
  market: MarketPush[];
}

export interface Services {
  userIdFor(token: string): Promise<string | null>;
  now(): number;
  randomHex(bytes: number): string;
  random(): number;
  /** The teacher's switches for the pupil's class (null if they can't be read). */
  settings(player: string): Promise<ClassSettings | null>;
  /** The school's galaxy seed and season (null if it can't be read). */
  schoolSeed(player: string): Promise<{ seed: string; season: number } | null>;
  /** The saved game: null for a new pupil, 'busy' if it can't be read. */
  loadGame(player: string): Promise<Saved | null | 'busy'>;
  /** The reply to a request already handled, if any. */
  request(player: string, requestId: string): Promise<unknown | null | 'busy'>;
  /** A day's question list: null if there is none, 'busy' if it can't be read. */
  loadDay(player: string, day: number): Promise<StoredDay | null | 'busy'>;
  storeDay(player: string, day: number, questions: Question[]): Promise<boolean>;
  mathsContext(player: string): Promise<MathsContext | null>;
  /** The school's market today (pushes and recent news rows). Null if it can't be read: prices are then normal. */
  market(player: string, day: number): Promise<SchoolView | null>;
  /** Saves; gives the new version, null if the saved game has moved on, 'busy' if the database could not be reached. */
  save(player: string, args: SaveArgs): Promise<number | null | 'busy'>;
  /** Adds answers to the pupil's maths records (counted once by `once`). The game goes on if this fails. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
}

export const MAX_REQUESTS_PER_MINUTE = 90;
const MAX_ACTIONS = 40;

/** The day number the game uses: whole days since 1970 on the New Zealand calendar, so a new day starts at New Zealand midnight. */
export function nzDay(ms: number): number {
  const [y, m, d] = new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' }).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

const galaxies = new Map<string, Galaxy>();
const galaxyFor = (seed: string): Galaxy => {
  let g = galaxies.get(seed);
  if (!g) {
    if (galaxies.size > 20) galaxies.clear();
    g = makeGalaxy(seed);
    galaxies.set(seed, g);
  }
  return g;
};

const REQUEST_ID = /^[A-Za-z0-9_-]{8,80}$/;

function parseAsk(raw: unknown): Ask | undefined | 'bad' {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object') return 'bad';
  const a = raw as Record<string, unknown>;
  if (!Number.isInteger(a.slot) || (a.slot as number) < 0 || (a.slot as number) > 200) return 'bad';
  if (typeof a.value !== 'number' || !Number.isFinite(a.value)) return 'bad';
  return { slot: a.slot as number, value: a.value, ms: typeof a.ms === 'number' && Number.isFinite(a.ms) ? a.ms : 120_000 };
}

/** Untrusted moves from the browser, made safe to hand to the rules (null if anything is not understood). */
export function parseActions(raw: unknown): Action[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_ACTIONS) return null;
  const out: Action[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const a = item as Record<string, unknown>;
    switch (a.type) {
      case 'trade': {
        const ask = parseAsk(a.ask);
        if (ask === 'bad' || !Array.isArray(a.plan)) return null;
        out.push({ type: 'trade', plan: a.plan as number[], ...(ask ? { ask } : {}) });
        break;
      }
      case 'refuel':
        out.push({ type: 'refuel', units: a.units as number });
        break;
      case 'repair':
        out.push({ type: 'repair', points: a.points as number });
        break;
      case 'buyShip':
        out.push({ type: 'buyShip', ship: a.ship as number });
        break;
      case 'buyWeapon':
        out.push({ type: 'buyWeapon', index: a.index as number });
        break;
      case 'buyShield':
        out.push({ type: 'buyShield', index: a.index as number });
        break;
      case 'buyPod':
        out.push({ type: 'buyPod' });
        break;
      case 'borrow':
        out.push({ type: 'borrow', amount: a.amount as number });
        break;
      case 'repay':
        out.push({ type: 'repay', amount: a.amount as number });
        break;
      case 'moon':
        out.push({ type: 'moon' });
        break;
      case 'jump':
        out.push({ type: 'jump', dest: a.dest as number });
        break;
      default:
        return null;
    }
  }
  return out;
}

export function makeHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handleTrader(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const player = token ? await services.userIdFor(token) : null;
    if (!player) return reply(401, { error: 'Please sign in again.' });
    if (!limiter.allow(player, MAX_REQUESTS_PER_MINUTE)) return reply(429, { error: 'Slow down a little!' });

    const body = (await readJsonBody(request)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return reply(400, { error: "That couldn't be read." });
    const today = nzDay(services.now());

    const settings = await services.settings(player);
    if (!settings) return reply(503, { error: "We couldn't load Star Trader just now." });
    if (!settings.enabled) return reply(403, { error: 'Star Trader is not switched on for your class yet.', off: true });
    const school = await services.schoolSeed(player);
    if (!school) return reply(503, { error: "We couldn't load Star Trader just now." });
    const galaxy = galaxyFor(school.seed);
    const classSettings: Settings = { jumpsPerDay: settings.jumpsPerDay, loans: settings.loans, maths: settings.maths };
    /** The school's market today. If it can't be read, prices are normal and there is no news (the game goes on). */
    const readMarket = async (): Promise<SchoolView> => (await services.market(player, today)) ?? EMPTY_VIEW;
    const news = (view: SchoolView): NewsItem[] => newsFor(galaxy, today, view);

    /** Today's question list, made on first use. Null when maths is off or can't be made. */
    const dayQuestions = async (): Promise<StoredDay | null | 'busy'> => {
      if (!settings.maths) return null;
      let stored = await services.loadDay(player, today);
      if (stored === 'busy') return 'busy';
      if (!stored) {
        const context = await services.mathsContext(player);
        const list = context ? makeDayQuestions(context, QUESTIONS_PER_DAY, () => services.random()) : [];
        if (!list.length || !(await services.storeDay(player, today, list))) return null;
        stored = await services.loadDay(player, today);
        if (stored === 'busy') return 'busy';
      }
      return stored;
    };

    if (body.action === 'load') {
      const view = await readMarket();
      const pushes = pushesFrom(view);
      for (let attempt = 0; attempt < 2; attempt++) {
        const saved = await services.loadGame(player);
        if (saved === 'busy') return reply(503, { error: "We couldn't load your game just now." });
        let game = saved?.game ?? newGame(galaxy, today, classSettings, pushes);
        const rolled = rollDay(galaxy, game, today, classSettings, pushes);
        let version = saved?.version ?? 0;
        if (!saved || rolled !== game) {
          game = rolled;
          const newVersion = await services.save(player, {
            expectedVersion: version,
            game,
            day: today,
            netWorth: netWorthOf(galaxy, game),
            season: school.season,
            requestId: `load-${services.randomHex(8)}`,
            reply: { loaded: true },
            claims: {},
            market: [],
          });
          if (newVersion === 'busy') return reply(503, { error: "We couldn't load your game just now." });
          if (newVersion === null) continue;
          version = newVersion;
        }
        const day = await dayQuestions();
        if (day === 'busy') return reply(503, { error: "We couldn't load your game just now." });
        const questions: PublicQuestion[] = day ? day.questions.map((q, slot) => publicQuestion(q, slot)) : [];
        return reply(200, {
          galaxySeed: school.seed,
          season: school.season,
          game,
          version,
          day: today,
          questions,
          settings: { jumpsPerDay: settings.jumpsPerDay, loans: settings.loans, maths: settings.maths },
          news: news(view),
        });
      }
      return reply(409, { error: 'Your game changed on another screen. Please try again.' });
    }

    const requestId = body.requestId;
    if (typeof requestId !== 'string' || !REQUEST_ID.test(requestId) || !Number.isInteger(body.version)) {
      return reply(400, { error: "That couldn't be read." });
    }
    const wanted = body.action;
    if (wanted !== 'act' && wanted !== 'fight' && wanted !== 'junk' && wanted !== 'deal') return reply(400, { error: "That couldn't be read." });

    // A request sent twice is answered with the first reply.
    const already = await services.request(player, requestId);
    if (already === 'busy') return reply(503, { error: "We couldn't check that just now." });
    if (already) return reply(200, already as object);

    const saved = await services.loadGame(player);
    if (saved === 'busy') return reply(503, { error: "We couldn't load your game just now." });
    if (!saved) return reply(409, { error: 'Open the game first.', stale: true });
    if (saved.version !== body.version || saved.game.t.day !== today) {
      return reply(409, { error: 'Your game has moved on. Reloading it.', stale: true, version: saved.version });
    }

    // Marking: answers are checked against today's list. Nothing is kept until the whole request works (the save keeps them).
    const day = await dayQuestions();
    if (day === 'busy') return reply(503, { error: "We couldn't check your answer just now." });
    const claims: Record<string, { value: number; right: boolean }> = {};
    const marked: { key: string; right: boolean; ms: number; slot: number }[] = [];
    const mark: Mark = (slot, value) => {
      const q = day?.questions[slot];
      const m = markQuestion(q);
      if (!day || !q || !m || day.answered[String(slot)] || claims[String(slot)]) return null;
      const right = sameAnswer(value, m.answer);
      claims[String(slot)] = { value, right };
      marked.push({ key: m.key, right, ms: 0, slot });
      return { right, answer: m.answer };
    };

    let result: Reply;
    let landed: SchoolView | null = null;
    if (wanted === 'act') {
      const actions = parseActions(body.actions);
      if (!actions) return reply(400, { error: "That couldn't be read." });
      // Only a jump needs the school's prices (for the planet it lands on).
      if (actions.some((a) => a.type === 'jump')) landed = await readMarket();
      result = applyBatch(galaxy, school.seed, saved.game, actions, classSettings, mark, landed ? pushesFrom(landed) : undefined);
    } else if (wanted === 'fight') {
      const ask = parseAsk(body.ask);
      if (ask === 'bad') return reply(400, { error: "That couldn't be read." });
      result = applyFight(saved.game, body.move as FightAction, ask, classSettings, mark);
    } else if (wanted === 'junk') {
      const ask = parseAsk(body.ask);
      if (ask === 'bad') return reply(400, { error: "That couldn't be read." });
      result = applyJunk(saved.game, ask, classSettings, mark);
    } else {
      result = applyDeal(saved.game, body.take === true);
    }
    if (!result.ok) return reply(400, { error: result.reason, game: saved.game, version: saved.version });

    // The browser may say how long an answer took; it is only used for the quick-answer record, capped, and never trusted for anything else.
    for (const a of result.answers) {
      const m = marked.find((x) => x.slot === a.slot);
      if (m) m.ms = a.ms;
    }
    // A save always makes the next version, so the reply kept for a repeated request already has the right one.
    const { ok: _ok, pushes: market = [], ...outcome } = result;
    void _ok;
    const finalReply = { ...outcome, version: saved.version + 1, ...(landed ? { news: news(landed) } : {}) };
    const newVersion = await services.save(player, {
      expectedVersion: saved.version,
      game: result.game,
      day: today,
      netWorth: netWorthOf(galaxy, result.game),
      season: saved.season,
      requestId,
      reply: finalReply,
      claims,
      market,
    });
    if (newVersion === 'busy') return reply(503, { error: "We couldn't save that just now." });
    if (newVersion === null) return reply(409, { error: 'Your game has moved on. Reloading it.', stale: true });
    if (marked.length) await safeRecord(services, player, `${today}`, marked);
    return reply(200, { ...finalReply, version: newVersion });
  };
}

/** The maths records are a bonus: if they can't be updated the game goes on. */
async function safeRecord(services: Services, player: string, once: string, marked: { key: string; right: boolean; ms: number; slot: number }[]): Promise<void> {
  try {
    for (const m of marked) {
      await services.recordAnswers(player, `${once}:${m.slot}`, [{ key: m.key, correct: m.right, ms: Math.min(m.ms, 120_000), at: services.now() }]);
    }
  } catch {
    console.error('trader: the maths records could not be updated');
  }
}

