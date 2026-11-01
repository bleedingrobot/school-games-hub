/**
 * What the `isles` server function does with a request from a signed-in pupil (docs/ISLES-PLAN.md, section 8). The
 * function (supabase/functions/isles/handler.ts) checks the sign-in and the rate first; the preview's trial backend
 * (stage S.3) calls this with services that keep everything in the browser, so both run exactly the same rules.
 *
 *   load        the island (made on first play, or after a New Season), rolled to today; this turn's question
 *               (without its answer); any Sky Race still open;
 *   answer      marks this turn's question against the stored one, once, and records it for the maths records;
 *   turn        checks the turn's choices and plays the turn with the island's own random numbers and the fair wind
 *               the server marked, keeps it (a turn is played once), and makes the next turn's question;
 *   raceStart   a Sky Race against the Gull Riders (the season's first is the starter race), with three questions;
 *   raceAnswer  marks one race question, once;
 *   raceFinish  works the race out from its seed, the two boats and the answers marked right, and gives the prize;
 *   guideDone   the guided first go is finished (or skipped);
 *   keeper      the pupil's Sky Keeper portrait (an id from KEEPERS only), kept through New Season.
 *
 * Nothing that counts comes from the browser: the questions and answers are the server's, the random numbers come from
 * the island's seed (and each race's), and the browser never sees a seed. Races against classmates, friendship ropes,
 * the class market's moving prices and the news board are stage S.4.
 */
import type { FactAnswer } from '../maths/leitner';
import { makeRunQuestions, markQuestion, publicQuestion, sameAnswer, seededRandom, type MathsContext, type PublicQuestion } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import { GRAND_ISLE, KEEPERS, MARKET_PRICE, PLOT_KINDS, RACE_QUESTIONS, UPGRADES } from './config';
import { newDay, newIsland, playTurn, spotCount, type Action, type Island, type Problem } from './engine';
import { GULL_RIDERS, gullRiders, racerOf, raceProblem, runRace, settleRace, starterRace, type Racer, type RaceProblem, type RaceResult } from './race';

export type IslesAction = 'load' | 'answer' | 'turn' | 'raceStart' | 'raceAnswer' | 'raceFinish' | 'guideDone' | 'keeper';

/** The pupil's saved island row. `island` is null after a New Season (a new one is made on the next load). */
export interface SavedIsland {
  seed: string;
  season: number;
  /** Goes up with every save; a save made from an older version is refused. */
  version: number;
  /** The New Zealand day (nzDay) the island was last saved on. */
  day: number;
  island: Island | null;
  guideDone: boolean;
  /** The Sky Keeper portrait (an id from KEEPERS), or null until the pupil chooses one. */
  keeper: string | null;
}

/** A stored set of questions: one for a turn, three for a race. Pupils can never read these. */
export interface QuestionSet {
  /** Random, and what the browser sends back; looked up with the pupil's own id, so another pupil's is never found. */
  id: string;
  /** `turn:<island seed>:<turn>` or `race:<race id>`: one set each (the first one stored wins). */
  ref: string;
  questions: Question[];
  answered: Record<string, { value: number; right: boolean }>;
}

export interface StoredRace {
  id: number;
  seed: string;
  /** GULL_RIDERS, or a classmate's id (stage S.4). */
  opponent: string;
  starter: boolean;
  you: Racer;
  them: Racer;
  status: 'open' | 'done';
  result: RaceResult | null;
  prize: { coins: number; goods: number } | null;
}

export interface IslesSettings {
  enabled: boolean;
  races: boolean;
}

export interface IslesServices {
  /** The teacher's switches for the pupil's class (null if they can't be read). */
  settings(player: string): Promise<IslesSettings | null>;
  /** The pupil's maths records, the class's question settings and their focus (null if they can't be read). */
  mathsContext(player: string): Promise<MathsContext | null>;
  /**
   * The saved island (null for a new pupil), the middle island size in the pupil's class (for the small-island extra
   * chunk), the pupil's open race, and how many races they've finished this season.
   */
  load(player: string): Promise<{ saved: SavedIsland | null; classMiddle: number; openRace: StoredRace | null; racesThisSeason: number } | 'busy'>;
  /** Keeps a new island, only if the pupil has none (or New Season cleared it). False if one is already there. */
  start(player: string, seed: string, island: Island, day: number): Promise<boolean | 'busy'>;
  /** Keeps a played turn, only if the island is still at `expectedVersion` (false if not: it was already played). */
  saveTurn(player: string, expectedVersion: number, island: Island, day: number, turn: TurnRecord): Promise<boolean | 'busy'>;
  /** Keeps a question set unless one with the same ref is there already; gives back whichever is kept. */
  storeQuestions(player: string, set: Omit<QuestionSet, 'answered'>): Promise<QuestionSet | 'busy'>;
  /** The pupil's own question set, found by its id or its ref (null if there's none). */
  questions(player: string, by: { id: string } | { ref: string }): Promise<QuestionSet | null | 'busy'>;
  /** Marks a question answered, once (false if it already was, or isn't one of the set's). */
  claimAnswer(player: string, setId: string, slot: number, value: number, right: boolean): Promise<boolean | 'busy'>;
  /** Keeps a new open race. Its id, or null if the pupil already has one open. */
  raceStart(player: string, race: Omit<StoredRace, 'id' | 'status' | 'result' | 'prize'>, day: number, turn: number): Promise<number | null | 'busy'>;
  /** The pupil's own race (null if there's no such race of theirs). */
  race(player: string, id: number): Promise<StoredRace | null | 'busy'>;
  /** Finishes an open race and keeps the island after it, only if the island is still at `expectedVersion`. */
  raceFinish(player: string, id: number, expectedVersion: number, island: Island, day: number, result: RaceResult, prize: { coins: number; goods: number }): Promise<boolean | 'busy'>;
  guideDone(player: string): Promise<boolean | 'busy'>;
  /** Keeps the pupil's Sky Keeper (an id from KEEPERS). False if the pupil has no island yet. */
  keeper(player: string, keeper: string): Promise<boolean | 'busy'>;
  /** Adds answers to the pupil's maths records (sent twice, counted once, by `once`). A failure is only logged. */
  recordAnswers(player: string, once: string, answers: FactAnswer[]): Promise<void>;
  /** Gives hub points (once per `once`, which must be unique across every pupil). A failure is only logged. */
  awardPoints(player: string, points: number, once: string): Promise<void>;
  randomHex(bytes: number): string;
  random(): number;
  now(): number;
}

/** What is kept for each turn played (one row a turn: a turn sent twice is kept once). */
export interface TurnRecord {
  turn: number;
  windy: boolean;
  actions: Action[];
  report: unknown;
}

export interface IslesReply {
  status: number;
  body: Record<string, unknown>;
}

/** Points (docs/ISLES-PLAN.md, section 6.5). The hub caps points at 40 a day across every game. */
export const POINTS = { turn: 1, raceWon: 2, grandIsle: 10, lighthouseStage: 5 } as const;

/** The longest an answer is said to have taken, for the maths records. */
const MAX_ANSWER_MS = 120_000;
const MAX_ACTIONS = 40;

/** Why a turn or race was refused, in words a 9-year-old reads easily. */
export const PROBLEM_TEXT: Record<Problem | RaceProblem, string> = {
  'no-turns': 'Your island is resting. See you tomorrow!',
  'not-enough-coins': "You don't have enough coins for that.",
  'not-enough-food': "You don't have that much food.",
  'not-enough-goods': "You don't have enough goods for that.",
  'not-enough-ideas': "You don't have enough ideas for that upgrade yet.",
  'no-drift': 'There is no land left in the drift today.',
  'no-such-spot': "That building spot isn't on your island.",
  'same-plot': 'That spot already has that building.',
  'nothing-to-raise': 'Build something on that spot first.',
  'top-level': 'That building is already as big as it gets.',
  'festival-done': "You've had a festival today already.",
  'already-have': 'You have that upgrade already.',
  'not-grand-yet': `The Sky Lighthouse needs a Grand Isle (${GRAND_ISLE} building spots).`,
  'lighthouse-done': 'Your Sky Lighthouse is already lit!',
  'bad-amount': "That amount doesn't work.",
  'bad-choice': "That choice couldn't be made.",
  'raced-this-turn': "You've raced this turn. Play a turn first.",
  'no-races-left': "You've raced twice today. More races tomorrow!",
  'raced-them-today': "You've raced that island today already.",
  'calm-start': 'That island is new and still having a calm start.',
  'challenged-enough': 'That island has raced enough today.',
  'own-island': "You can't race your own island.",
};

const ok = (body: Record<string, unknown>): IslesReply => ({ status: 200, body });
const no = (status: number, error: string, extra: Record<string, unknown> = {}): IslesReply => ({ status, body: { error, ...extra } });
const busy = () => no(503, "The sky post couldn't get through just now. Try again in a moment.");
const unreadable = () => no(400, "That couldn't be read.");

/** The day number the game uses: whole days since 1970 on the New Zealand calendar, so a new day starts at New Zealand midnight. */
export function nzDay(ms: number): number {
  const [y, m, d] = new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' }).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** The island's random numbers for one turn: the same island and turn always roll the same. */
export const turnRandom = (seed: string, turn: number) => seededRandom(`isles-turn:${seed}:${turn}`);
export const turnRef = (seed: string, turn: number) => `turn:${seed}:${turn}`;
export const raceRef = (race: number) => `race:${race}`;

/** The island as it is today: a new day gives fresh turns and drift (unused ones pile up a little). */
export function islandToday(saved: SavedIsland & { island: Island }, today: number, classMiddle: number): Island {
  return saved.day >= today ? saved.island : newDay(saved.island, today - saved.day, classMiddle);
}

/** A question as the browser sees it: no answer, and the set's id to send back. */
export type ShownQuestion = PublicQuestion & { set: string };

function shown(set: QuestionSet): ShownQuestion[] {
  return set.questions.map((q, slot) => ({ ...publicQuestion(q, slot), set: set.id }));
}

/** What the browser is shown of a race: no seed. */
export function publicRace(race: StoredRace, questions: QuestionSet | null) {
  return {
    id: race.id,
    opponent: race.opponent,
    starter: race.starter,
    you: race.you,
    them: race.them,
    questions: questions ? shown(questions) : [],
    answered: questions ? questions.answered : {},
    ...(race.result ? { result: race.result, prize: race.prize } : {}),
  };
}

/**
 * Untrusted choices from the browser, made safe to hand to the rules: only the fields each choice has, with the right
 * types (the rules then check the values). Null if anything isn't understood.
 */
export function parseActions(raw: unknown): Action[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_ACTIONS) return null;
  const out: Action[] = [];
  const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : null);
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const a = item as Record<string, unknown>;
    switch (a.kind) {
      case 'anchor':
      case 'festival':
      case 'lighthouse':
        out.push({ kind: a.kind });
        break;
      case 'build': {
        const spot = int(a.spot);
        if (spot === null || !PLOT_KINDS.includes(a.plot as never)) return null;
        out.push({ kind: 'build', spot, plot: a.plot as (typeof PLOT_KINDS)[number] });
        break;
      }
      case 'raise': {
        const spot = int(a.spot);
        if (spot === null) return null;
        out.push({ kind: 'raise', spot });
        break;
      }
      case 'tax':
        if (a.level !== 'low' && a.level !== 'fair' && a.level !== 'high') return null;
        out.push({ kind: 'tax', level: a.level });
        break;
      case 'workshop': {
        const boatShare = int(a.boatShare);
        if (boatShare === null) return null;
        out.push({ kind: 'workshop', boatShare });
        break;
      }
      case 'upgrade':
        if (!UPGRADES.some((u) => u.id === a.id)) return null;
        out.push({ kind: 'upgrade', id: a.id as (typeof UPGRADES)[number]['id'] });
        break;
      case 'sell':
      case 'buy': {
        const amount = int(a.amount);
        if (amount === null || (a.good !== 'food' && a.good !== 'goods')) return null;
        out.push({ kind: a.kind, good: a.good, amount });
        break;
      }
      default:
        return null;
    }
  }
  return out;
}

function readAnswer(body: Record<string, unknown>): { slot: number; value: number; ms: number } | null {
  const { slot, value } = body;
  if (!Number.isInteger(slot) || (slot as number) < 0 || (slot as number) > 20) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000_000) return null;
  const ms = typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? Math.min(body.ms, MAX_ANSWER_MS) : MAX_ANSWER_MS;
  return { slot: slot as number, value, ms: Math.round(ms) };
}

export async function handleIsles(services: IslesServices, player: string, body: Record<string, unknown>): Promise<IslesReply> {
  const settings = await services.settings(player);
  if (!settings) return busy();
  if (!settings.enabled) return no(403, 'Sky Isles is not switched on for your class.', { code: 'game-off' });
  const today = nzDay(services.now());
  // The class market's prices are the normal ones until stage S.4 moves them.
  const prices = { ...MARKET_PRICE };

  const action = body.action;
  if (!['load', 'answer', 'turn', 'raceStart', 'raceAnswer', 'raceFinish', 'guideDone', 'keeper'].includes(action as string)) return unreadable();
  if (action === 'guideDone') {
    const done = await services.guideDone(player);
    return done === 'busy' ? busy() : ok({ guideDone: true });
  }
  if (action === 'keeper') {
    if (typeof body.keeper !== 'string' || !KEEPERS.includes(body.keeper)) return no(400, "That Sky Keeper isn't one of the portraits.");
    const kept = await services.keeper(player, body.keeper);
    if (kept === 'busy') return busy();
    return kept ? ok({ keeper: body.keeper }) : no(409, 'Open Sky Isles first.', { code: 'stale' });
  }
  if ((action === 'raceStart' || action === 'raceAnswer' || action === 'raceFinish') && !settings.races) {
    return no(403, 'Sky Races are switched off for your class.', { code: 'races-off' });
  }

  // Every other action starts from the saved island, made first if there isn't one.
  let state = await services.load(player);
  if (state === 'busy') return busy();
  if (!state.saved?.island) {
    if (action !== 'load') return no(409, 'Open Sky Isles first.', { code: 'stale' });
    const made = await services.start(player, services.randomHex(16), newIsland(), today);
    if (made === 'busy') return busy();
    state = await services.load(player);
    if (state === 'busy') return busy();
    if (!state.saved?.island) return busy();
  }
  const saved = state.saved as SavedIsland & { island: Island };
  const island = islandToday(saved, today, state.classMiddle);

  /** This turn's question set, made the first time it's needed (none if the maths can't be read). */
  const turnQuestions = async (turn: number): Promise<QuestionSet | null | 'busy'> => {
    const found = await services.questions(player, { ref: turnRef(saved.seed, turn) });
    if (found) return found;
    const context = await services.mathsContext(player);
    const questions = context ? makeRunQuestions(context, 1, () => services.random()) : [];
    if (!questions.length) return null;
    return services.storeQuestions(player, { id: services.randomHex(12), ref: turnRef(saved.seed, turn), questions });
  };
  /** What the browser needs to show the island now: never the seed, and only the question's answer once it's marked. */
  const view = async (now: Island, extra: Record<string, unknown> = {}) => {
    const set = await turnQuestions(now.turn);
    if (set === 'busy') return busy();
    return ok({
      island: now,
      day: today,
      season: saved.season,
      question: set ? { ...shown(set)[0], answered: set.answered['0'] ?? null } : null,
      guide: { done: saved.guideDone, show: !saved.guideDone && now.turn === 0 },
      keeper: saved.keeper ?? null,
      races: settings.races,
      prices,
      ...extra,
    });
  };

  if (action === 'load') {
    let openRace = null;
    if (state.openRace) {
      const set = await services.questions(player, { ref: raceRef(state.openRace.id) });
      if (set === 'busy') return busy();
      openRace = publicRace(state.openRace, set);
    }
    return view(island, { openRace });
  }

  if (action === 'answer') {
    const a = readAnswer(body);
    if (!a || typeof body.set !== 'string') return no(400, "That answer couldn't be read.");
    const set = await services.questions(player, { id: body.set });
    if (set === 'busy') return busy();
    // Only the pupil's own question for the turn they're on can be answered (another pupil's set is never found).
    if (!set || set.ref !== turnRef(saved.seed, island.turn)) return no(409, "That question has gone. Here's your island as it is now.", { code: 'stale' });
    return mark(services, player, set, a, `isles:${saved.seed}:t${island.turn}:${a.slot}`);
  }

  if (action === 'turn') {
    const turn = body.turn;
    if (!Number.isInteger(turn)) return unreadable();
    // Sent twice: the turn was played once, so send the island as it is now.
    if ((turn as number) < island.turn) return view(island, { already: true });
    if (turn !== island.turn) return no(409, "Your island has moved on. Here's how it is now.", { code: 'stale' });
    const actions = parseActions(body.actions);
    if (!actions) return no(400, "Those choices couldn't be read.");
    const set = await services.questions(player, { ref: turnRef(saved.seed, island.turn) });
    if (set === 'busy') return busy();
    const windy = set?.answered['0']?.right === true;
    const result = playTurn(island, windy, actions, prices, turnRandom(saved.seed, island.turn));
    if (!result.ok) return no(400, PROBLEM_TEXT[result.problem], { code: result.problem, at: result.at });
    const kept = await services.saveTurn(player, saved.version, result.island, today, { turn: island.turn, windy, actions, report: result.report });
    if (kept === 'busy') return busy();
    if (!kept) return again(services, player, today, view, saved, island.turn);
    await givePoints(services, player, saved.seed, island, result.island);
    return view(result.island, { report: result.report });
  }

  // Sky Races (against the Gull Riders in this stage).
  if (action === 'raceStart') {
    if (body.opponent !== GULL_RIDERS) return no(400, 'Races against classmates are coming soon. Race the Gull Riders!', { code: 'not-yet' });
    if (state.openRace) {
      // One race at a time: an open race is carried on (the same questions), so a bad start can't be thrown away.
      const set = await services.questions(player, { ref: raceRef(state.openRace.id) });
      if (set === 'busy') return busy();
      return ok({ race: publicRace(state.openRace, set) });
    }
    const problem = raceProblem(island, GULL_RIDERS, player);
    if (problem) return no(400, PROBLEM_TEXT[problem], { code: problem });
    const you = racerOf(island);
    const race = { seed: services.randomHex(16), opponent: GULL_RIDERS, starter: state.racesThisSeason === 0, you, them: gullRiders(you) };
    const id = await services.raceStart(player, race, today, island.turn);
    if (id === 'busy') return busy();
    if (id === null) return no(409, 'You have a race going already.', { code: 'stale' });
    const context = await services.mathsContext(player);
    const questions = context ? makeRunQuestions(context, RACE_QUESTIONS, () => services.random()) : [];
    const set = questions.length ? await services.storeQuestions(player, { id: services.randomHex(12), ref: raceRef(id), questions }) : null;
    if (set === 'busy') return busy();
    return ok({ race: publicRace({ ...race, id, status: 'open', result: null, prize: null }, set) });
  }

  const raceId = body.race;
  if (!Number.isInteger(raceId)) return unreadable();
  const race = await services.race(player, raceId as number);
  if (race === 'busy') return busy();
  // Another pupil's race is never found.
  if (!race) return no(409, "That race couldn't be found.", { code: 'stale' });
  const set = await services.questions(player, { ref: raceRef(race.id) });
  if (set === 'busy') return busy();

  if (action === 'raceAnswer') {
    if (race.status !== 'open') return no(409, 'That race is over.', { code: 'stale' });
    const a = readAnswer(body);
    if (!a) return no(400, "That answer couldn't be read.");
    if (!set) return no(400, "That answer couldn't be marked.");
    return mark(services, player, set, a, `isles:race:${race.id}:${a.slot}`);
  }

  // raceFinish. Sent twice: the first result.
  if (race.status === 'done') return ok({ race: publicRace(race, set), island, already: true });
  const problem = raceProblem(island, GULL_RIDERS, player);
  if (problem) return no(400, PROBLEM_TEXT[problem], { code: problem });
  const right = set ? Object.values(set.answered).filter((m) => m.right).length : 0;
  const result = race.starter ? starterRace(race.seed, race.you, right) : runRace(race.seed, race.you, race.them, right);
  const settled = settleRace(island, null, result);
  const kept = await services.raceFinish(player, race.id, saved.version, settled.challenger, today, result, settled.prize);
  if (kept === 'busy') return busy();
  if (!kept) {
    const now = await services.race(player, race.id);
    if (now === 'busy') return busy();
    if (now?.status === 'done') return ok({ race: publicRace(now, set), already: true });
    return no(409, "Your island has moved on. Here's how it is now.", { code: 'stale' });
  }
  if (result.won) await services.awardPoints(player, POINTS.raceWon, `isles:race:${race.id}`);
  return ok({ race: publicRace({ ...race, status: 'done', result, prize: settled.prize }, set), island: settled.challenger });
}

/** Marks one answer against the stored question, once, and records it for the maths records. */
async function mark(services: IslesServices, player: string, set: QuestionSet, a: { slot: number; value: number; ms: number }, once: string): Promise<IslesReply> {
  const marked = markQuestion(set.questions[a.slot]);
  if (!marked) return no(400, "That answer couldn't be marked.");
  const right = sameAnswer(a.value, marked.answer);
  const claimed = await services.claimAnswer(player, set.id, a.slot, a.value, right);
  if (claimed === 'busy') return busy();
  if (!claimed) return no(400, "You've already answered that one.", { code: 'answered' });
  try {
    await services.recordAnswers(player, once, [{ key: marked.key, correct: right, ms: a.ms, at: services.now() }]);
  } catch {
    // The maths records are a bonus: the game goes on without them.
  }
  return ok({ right, answer: marked.answer });
}

/**
 * A turn save that didn't take. If the turn was played meanwhile (sent twice, or from another tab), show the island as
 * it is now; if something else moved the island on first (a race finishing), the turn wasn't played: try again.
 */
async function again(services: IslesServices, player: string, today: number, view: (i: Island, extra?: Record<string, unknown>) => Promise<IslesReply>, before: SavedIsland, turn: number) {
  const now = await services.load(player);
  if (now === 'busy') return busy();
  if (!now.saved?.island || now.saved.seed !== before.seed) return no(409, 'Open Sky Isles again.', { code: 'stale' });
  const island = islandToday(now.saved as SavedIsland & { island: Island }, today, now.classMiddle);
  if (island.turn > turn) return view(island, { already: true });
  return no(409, "Your island has moved on. Here's how it is now.", { code: 'stale' });
}

/** A point for the turn, and more for reaching Grand Isle and for each Lighthouse stage (each once, by the island's seed). */
async function givePoints(services: IslesServices, player: string, seed: string, before: Island, after: Island) {
  await services.awardPoints(player, POINTS.turn, `isles:${seed}:t${before.turn}`);
  if (spotCount(before) < GRAND_ISLE && spotCount(after) >= GRAND_ISLE) await services.awardPoints(player, POINTS.grandIsle, `isles:${seed}:grand`);
  for (let stage = before.lighthouse + 1; stage <= after.lighthouse; stage++) {
    await services.awardPoints(player, POINTS.lighthouseStage, `isles:${seed}:light${stage}`);
  }
}
