/**
 * Dragon Maths, the server's side of the game (docs/LORD-PLAN.md, stage L.4).
 *
 * THE SERVER IS THE BOSS. The browser used to roll the dice, pick the monster, decide what a right answer
 * was worth and keep the hero. Now none of that is trusted: `runLord` runs one request against the saved
 * hero using the same rule book as the screens (`engine.ts`, `maths.ts`). The `lord` server function and
 * the browser-only trial (preview/lord) both call it, so they cannot disagree about the rules.
 *
 * How a request goes:
 *  1. The game switch, and the season: nothing runs at midnight. The first request of a new New Zealand day
 *     gives the day's turns and full health back (`rollDay`); the first request of a new season starts the hero
 *     again (once any fight in progress is finished).
 *  2. Every change names the hero's version it was made from and carries its own id. An old version, or an id
 *     already used, is refused cleanly and the browser is handed the current state to carry on from.
 *  3. A half-finished fight stays on the server (its start, its seed). While one is open nothing else changes
 *     the hero, so reloading or opening the game on another Chromebook offers the same fight again.
 *  4. A finished fight arrives as the actions the pupil played. The server replays them from the saved start
 *     (`replayFight`) and only then pays gold and experience. A fight can be finished once.
 *  5. A maths answer arrives as a proof (pack, key, numbers, answer). The server rebuilds the question and
 *     marks it itself (`markProof`); one it cannot prove counts as wrong.
 *  6. One atomic save (`Services.commit`): the hero, the fight and a note of what happened, or nothing.
 */
import type { FactAnswer } from '../maths/leitner';
import { CLASSES, FOREST_FIGHTS_PER_DAY, MAX_LEVEL, SEASON_DAYS, WEAPONS, ARMOURS, baseStats, expNeeded, masterFor } from './data';
import { computerHeroes } from './computer';
import { EVENT_BY_ID } from './events';
import {
  applyEvent, applyForestResult, applyMasterResult, arenaExp, buyGear, canChallengeMaster, canFaceDragon, deposit, dragonBreather, duelistOf,
  FOREST_PILE_UP_DAYS, finishDragon, forestTrip, heal, loseToDragon, makeRandom, newHero, nzDate, playDuel, replayFight, rollDay, seasonOf, startDragonStage,
  startFight, startMasterFight, useForestTurn, withdraw, type Duelist,
} from './engine';
import {
  NUMBER_GUESS_TRIES, addMasterTrialBonus, dragonStageOptions, interestFor, numberGuessPrize, offersSizeItUp, priceDiscount, riddleGold,
  sizeItUpBonus, type MomentId, type Result,
} from './maths';
import { arenaWonLine, dailyNews, dragonWonLine, flattenedLine, masterWonLine, type NewsLine } from './news';
import { markProof, type Proof } from './proof';
import type { FightAction, FightState, Hero, HeroClass, SkillId } from './types';

// ---------- What the server remembers ----------

/** A database answer. 'refused': the database said no. 'too-many' (the daily limit) and 'busy' (couldn't reach it). */
export type Outcome<T> = { ok: true; value: T } | { ok: false; why: 'too-many' | 'refused' | 'busy' };

/** What a pupil has done over all their seasons (the achievements read this; a new season or a new run never clears it). */
export interface Stats {
  forestWins: number;
  masterWins: number;
  arenaWins: number;
  /** Maths questions answered right, anywhere in the game. */
  riddles: number;
  dragons: number;
  bestLevel: number;
}

export const newStats = (): Stats => ({ forestWins: 0, masterWins: 0, arenaWins: 0, riddles: 0, dragons: 0, bestLevel: 1 });

/** The things that belong to a hero but not to the engine's `Hero`. */
export interface Extra {
  /** The day the riddle / the interest question was last answered. */
  riddleDay: string;
  interestDay: string;
  /** Today's number guess: the secret never leaves the server. */
  guess: { day: string; secret: number; tries: { n: number; hint: 'low' | 'high' | 'win' }[]; done: boolean } | null;
  /** An event the forest handed out and the pupil has not dealt with yet. */
  pendingEvent: string | null;
  /** A dragon run in progress: the next stage and the hero's HP going into it. */
  dragon: { next: 1 | 2 | 3; hp: number } | null;
  /** The last day a dragon run began (one try a day). */
  dragonDay: string;
  /** True after a new season starts, until the hero does something: the class can be changed. */
  classOpen: boolean;
  stats: Stats;
}

export const newExtra = (stats: Stats = newStats()): Extra => ({
  riddleDay: '', interestDay: '', guess: null, pendingEvent: null, dragon: null, dragonDay: '', classOpen: false, stats,
});

/** An `extra` as saved, filled in where an older save had no such part. */
export const readExtra = (saved: Partial<Extra> | null | undefined): Extra => ({ ...newExtra(), ...saved, stats: { ...newStats(), ...saved?.stats } });

export interface FightInfo {
  /** The New Zealand day it was handed out. */
  day: string;
  /** Does this fight offer "size it up"? (A pure function of the seed.) */
  sizeUp: boolean;
  stage?: 1 | 2 | 3;
  /** A master's trial: how the three questions went. */
  trial?: Result[];
}

/** A fight handed out and not yet finished. `start` is the fight before any action, so it can always be replayed. */
export interface OpenFight {
  id: string;
  kind: 'forest' | 'master' | 'dragon';
  seed: number;
  start: FightState;
  info: FightInfo;
}

export interface LordRow {
  hero: Hero;
  version: number;
  season: number;
  extra: Extra;
}

export interface Settings {
  enabled: boolean;
  forestPerDay: number;
  /** The first day of season 1 (YYYY-MM-DD). Null: the season starts today. */
  seasonStart: string | null;
}

export interface Commit {
  /** The version the server read: 0 for a hero that has no row yet. */
  expect: number;
  hero: Hero;
  season: number;
  extra: Extra;
  /** A fight handed out by this request. */
  openFight: OpenFight | null;
  /** A fight this request finishes (or abandons, with the test tools). */
  closeFight: { id: string; status: 'finished' | 'abandoned'; actions: FightAction[]; result: object } | null;
  /** The audit note, whose id makes a repeated request count once. */
  event: { requestId: string; action: string; summary: object };
  /** Lines for the Daily News about what this request did. */
  news: NewsLine[];
  /** What this request earned toward points: the database turns it into points inside the daily cap. */
  score: { forest: number; master: number; dragon: number } | null;
  /** The dragon was beaten this season: the Hall of Heroes keeps it. */
  hall: { season: number } | null;
  /** A fight that began and ended in this one request (the arena). */
  doneFight: DoneFight | null;
}

export interface DoneFight {
  id: string;
  kind: 'arena';
  /** Who it was against, for the record ("computer-gareth", "pupil-1a2b3c4d"). */
  monster: string;
  seed: number;
  start: object;
  info: object;
  result: object;
}

/** A classmate's hero, as the database hands it over for the arena. */
export interface ArenaCandidate {
  player: string;
  name: string;
  hero: Hero;
}

export type CommitStatus = 'saved' | 'duplicate' | 'stale' | 'open-fight' | 'no-fight';

/** Everything this needs from Supabase, passed in so the tests (and the browser trial) can stand in for it. */
export interface Services {
  /** Milliseconds since 1970. */
  now(): number;
  /** A random whole number from 0 to 2^32 - 1. */
  seed(): number;
  newId(): string;
  isTeacher(player: string): Promise<Outcome<boolean>>;
  settings(): Promise<Outcome<Settings>>;
  /** The hero and the fight in progress (null for a pupil with no hero), and whether this request id was already used. */
  load(player: string, requestId?: string): Promise<Outcome<{ row: LordRow | null; openFight: OpenFight | null; seen: boolean; dailyDone?: boolean }>>;
  commit(player: string, commit: Commit): Promise<Outcome<{ status: CommitStatus; version: number }>>;
  /** Adds answers to the student's maths records. `batchKey` makes a retry count once. */
  recordAnswers(player: string, pack: string, batchKey: string, answers: FactAnswer[]): Promise<Outcome<number>>;
  recordRefusal(player: string, reason: string, action: string): Promise<Outcome<null>>;
  /** Classmates' heroes of this season near this level, for the arena (the pupil's own hero is left out). */
  arenaCandidates(player: string, season: number, level: number): Promise<Outcome<ArenaCandidate[]>>;
  /** The day's own news lines (the village event, the computer heroes). Each line is kept once. */
  dailyNews(day: string, lines: NewsLine[]): Promise<Outcome<null>>;
}

// ---------- What goes back to the browser ----------

export interface LordState {
  /** Null for a student who has not picked a class yet. */
  hero: Hero | null;
  version: number;
  today: string;
  season: { number: number; dayOfSeason: number; daysLeft: number };
  forestPerDay: number;
  classOpen: boolean;
  openFight: { id: string; kind: OpenFight['kind']; seed: number; start: FightState; sizeUp: boolean; stage?: 1 | 2 | 3; trial?: Result[] } | null;
  pendingEvent: string | null;
  dragon: Extra['dragon'];
  /** The dragon has been faced today. */
  dragonTried: boolean;
  riddleDone: boolean;
  interestDone: boolean;
  guess: { done: boolean; tries: { n: number; hint: 'low' | 'high' | 'win' }[] } | null;
  /** Everything done over all seasons. */
  stats: Stats;
}

export type Reason =
  | 'closed' // the teacher's switch is off
  | 'not-started' // the first season has not begun
  | 'stale' // made from an old copy
  | 'duplicate' // this request id was already used
  | 'fight-open' // finish the fight in progress first
  | 'no-fight' // there is no such open fight (it was finished already)
  | 'no-hero' // pick a class first
  | 'no-turns' // no forest fights left today
  | 'rule' // the game's own rules say no; `message` says why
  | 'tampered' // the played actions did not check out
  | 'not-allowed' // test tools for a student, for example
  | 'bad-request'
  | 'busy'; // the database could not be reached

export type LordReply =
  | { ok: true; state: LordState; result: Record<string, unknown> }
  | { ok: false; reason: Reason; message?: string; state?: LordState };

// ---------- The requests ----------

export type ToolId = 'jump' | 'gold' | 'exp' | 'refill' | 'hurt' | 'best-gear' | 'new-day' | 'event' | 'abandon-fight' | 'reset';

export type LordAction =
  | { action: 'load' }
  | { action: 'rollover' }
  | { action: 'start-hero'; heroClass: HeroClass }
  | { action: 'forest' }
  | { action: 'event'; proof?: Proof | null; walkOn?: boolean }
  | { action: 'fight-finish'; fightId: string; actions: FightAction[]; sizeUp?: Proof | null }
  | { action: 'master-start'; trial: (Proof | null)[] }
  | { action: 'master-finish'; fightId: string; actions: FightAction[] }
  | { action: 'dragon-stage'; stage: 1 | 2 | 3; riddle?: Proof | null }
  | { action: 'dragon-finish'; fightId: string; actions: FightAction[] }
  | { action: 'shop-buy'; slot: 'weapon' | 'armour'; index: number; proof?: Proof | null }
  | { action: 'heal'; hp: number; proof?: Proof | null }
  | { action: 'bank'; op: 'deposit' | 'withdraw' | 'interest'; amount?: number; proof?: Proof | null }
  | { action: 'inn'; game: 'riddle'; proof?: Proof | null }
  | { action: 'inn'; game: 'guess-start' }
  | { action: 'inn'; game: 'guess'; n: number }
  | { action: 'arena' }
  | { action: 'tools'; tool: ToolId; value?: number | string };

/** What the browser sends: an action, with an id that makes a repeat count once, and the version it was made from. */
export type LordRequest = LordAction & { requestId?: string; version?: number };

export const FINISH_ACTIONS = ['fight-finish', 'master-finish', 'dragon-finish'] as const;
/** The most actions one fight may carry. */
export const MAX_FIGHT_ACTIONS = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SKILLS: SkillId[] = ['power-strike', 'zap', 'mend', 'dodge', 'pinch'];
const ACTIONS = [
  'load', 'rollover', 'start-hero', 'forest', 'event', 'fight-finish', 'master-start', 'master-finish', 'dragon-stage', 'dragon-finish',
  'shop-buy', 'heal', 'bank', 'inn', 'arena', 'tools',
];

function parseActions(raw: unknown): FightAction[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_FIGHT_ACTIONS) return null;
  const out: FightAction[] = [];
  for (const a of raw as Record<string, unknown>[]) {
    if (!a || typeof a !== 'object') return null;
    if (a.type === 'attack' || a.type === 'run') out.push({ type: a.type });
    else if (a.type === 'skill' && SKILLS.includes(a.skill as SkillId)) out.push({ type: 'skill', skill: a.skill as SkillId });
    else return null;
  }
  return out;
}

const isInt = (n: unknown, lo: number, hi: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;

// ---------- Working on a hero ----------

interface Work {
  hero: Hero;
  extra: Extra;
  season: number;
  open: OpenFight | null;
}

interface Done {
  hero?: Hero;
  extra?: Extra;
  /** A fight this request hands out. */
  openFight?: OpenFight;
  /** The open fight this request closes. */
  closeFight?: { status: 'finished' | 'abandoned'; actions: FightAction[]; result: object };
  summary: object;
  result: Record<string, unknown>;
  answers?: (FactAnswer & { pack: string })[];
  /** Codes for the teacher page: things that were off but not worth an error (an answer that could not be checked). */
  notes?: string[];
  news?: NewsLine[];
  /** Added to the pupil's lifetime counts (and to their points, for the three that earn them). */
  gain?: Partial<Stats>;
  hall?: boolean;
  doneFight?: DoneFight;
}

type Refuse = { refuse: Reason; message?: string; note?: string };
const rule = (message: string): Refuse => ({ refuse: 'rule', message });
const isRefuse = <T extends object>(x: T | Refuse): x is Refuse => 'refuse' in x;

interface Ctx {
  player: string;
  w: Work;
  req: Record<string, unknown>;
  today: string;
  settings: Settings;
  now: number;
  s: Services;
  rolled: boolean;
  teacher: () => Promise<boolean>;
}

/** Marks a proof and gathers what is needed to record it. A proof that cannot be checked is just wrong. */
function mark(c: Ctx, raw: unknown, moment: MomentId, only?: string) {
  if (raw === undefined || raw === null) return { result: 'wrong' as Result, skipped: true, answers: [] as (FactAnswer & { pack: string })[], notes: [] as string[] };
  const m = markProof(raw, moment, c.w.hero.level, c.now, only);
  if (!m.ok) return { result: 'wrong' as Result, skipped: false, answers: [], notes: [m.problem] };
  return { result: (m.correct ? 'right' : 'wrong') as Result, skipped: false, answers: [m.answer], notes: [] as string[] };
}

// ---------- The actions ----------

function startHero(c: Ctx, existing: boolean): Done | Refuse {
  const cls = c.req.heroClass;
  if (typeof cls !== 'string' || !(cls in CLASSES)) return { refuse: 'bad-request' };
  const { hero, extra } = c.w;
  if (existing) {
    const fresh = extra.classOpen && hero.forestWins === 0 && hero.exp === 0 && hero.weapon === 0 && hero.armour === 0;
    if (!fresh) return rule('You already have a hero.');
  }
  const next = newHero(cls as HeroClass, c.today, existing ? { dragonKills: hero.dragonKills } : undefined);
  next.forestLeft = c.settings.forestPerDay;
  return { hero: next, extra: newExtra(extra.stats), summary: { heroClass: cls }, result: {} };
}

function forest(c: Ctx): Done | Refuse {
  const { hero, extra } = c.w;
  if (extra.pendingEvent) return { summary: { kind: 'event', again: true }, result: { kind: 'event', eventId: extra.pendingEvent } };
  if (hero.forestLeft <= 0) return { refuse: 'no-turns', message: 'You have used all your forest fights today. Come back tomorrow, or visit the village.' };
  if (hero.hp <= 0) return rule('You are too hurt to go into the forest. See the healer.');
  const trip = forestTrip(hero, c.s.seed());
  if (trip.kind === 'event') {
    return { extra: { ...extra, pendingEvent: trip.event.id }, summary: { kind: 'event', id: trip.event.id }, result: { kind: 'event', eventId: trip.event.id } };
  }
  const after = useForestTurn(hero);
  const open: OpenFight = {
    id: c.s.newId(), kind: 'forest', seed: trip.seed, start: startFight(after, trip.monster, trip.seed), info: { day: c.today, sizeUp: offersSizeItUp(trip.seed) },
  };
  return { hero: after, openFight: open, summary: { kind: 'fight', monster: trip.monster.id, seed: trip.seed }, result: { kind: 'fight' } };
}

function event(c: Ctx): Done | Refuse {
  const { hero, extra } = c.w;
  const e = extra.pendingEvent ? EVENT_BY_ID[extra.pendingEvent] : undefined;
  if (!e) return rule('There is no event waiting.');
  let right = false;
  let answers: Done['answers'] = [];
  let notes: string[] = [];
  if (e.maths && !c.req.walkOn) {
    const m = mark(c, c.req.proof, 'treasure', e.maths.topic);
    right = m.result === 'right';
    answers = m.answers;
    notes = m.notes;
  }
  return {
    hero: applyEvent(hero, e, right), extra: { ...extra, pendingEvent: null }, answers, notes,
    summary: { event: e.id, right }, result: { eventId: e.id, right, walkedOn: !!c.req.walkOn },
  };
}

/** After a fight crossed midnight, today's fresh health, skills and master try win over what the old day left. */
function keepToday(next: Hero, rolled: Hero, crossed: boolean): Hero {
  return crossed ? { ...next, hp: rolled.hp, skillLeft: rolled.skillLeft, masterTried: rolled.masterTried } : next;
}

function replayOpen(c: Ctx, kind: OpenFight['kind'], bonus = 1): { open: OpenFight; fight: FightState; actions: FightAction[] } | Refuse {
  const open = c.w.open;
  if (!open || open.kind !== kind || open.id !== c.req.fightId) return { refuse: 'no-fight' };
  const actions = parseActions(c.req.actions);
  if (!actions) return { refuse: 'tampered', note: 'actions' };
  let fight: FightState;
  try {
    fight = replayFight({ ...open.start, firstHitBonus: bonus === 1 ? open.start.firstHitBonus : bonus }, actions);
  } catch {
    return { refuse: 'tampered', note: 'replay' };
  }
  if (!fight.over) return { refuse: 'tampered', note: 'unfinished' };
  return { open, fight, actions };
}

function fightFinish(c: Ctx): Done | Refuse {
  const open = c.w.open;
  let bonus = 1;
  let answers: Done['answers'] = [];
  let notes: string[] = [];
  let sizeUp: Result | null = null;
  if (open?.kind === 'forest' && open.info.sizeUp && c.req.sizeUp) {
    const m = mark(c, c.req.sizeUp, 'size-it-up');
    sizeUp = m.result;
    bonus = sizeItUpBonus(m.result);
    answers = m.answers;
    notes = m.notes;
  }
  const played = replayOpen(c, 'forest', bonus);
  if (isRefuse(played)) return played;
  const { fight, actions, open: was } = played;
  const crossed = was.info.day !== c.today;
  const hero = keepToday(applyForestResult(c.w.hero, fight), c.w.hero, crossed);
  const rewards = fight.outcome === 'won' ? { gold: fight.monster.gold + fight.goldPinched, exp: fight.monster.exp } : { gold: 0, exp: 0 };
  const won = fight.outcome === 'won';
  return {
    hero, answers, notes,
    gain: won ? { forestWins: 1 } : undefined,
    news: fight.outcome === 'lost' ? [flattenedLine(c.player, fight.monster.name)] : undefined,
    closeFight: { status: 'finished', actions, result: { outcome: fight.outcome, rounds: fight.round, ...rewards, sizeUp } },
    summary: { outcome: fight.outcome, monster: fight.monster.id, ...rewards },
    result: { outcome: fight.outcome, ...rewards, sizeUp, readyForMaster: fight.outcome === 'won' && hero.level < MAX_LEVEL && canChallengeMaster(hero).ok },
  };
}

function masterStart(c: Ctx): Done | Refuse {
  const { hero } = c.w;
  const check = canChallengeMaster(hero);
  if (!check.ok) return rule(check.reason ?? 'Not yet.');
  const proofs = Array.isArray(c.req.trial) ? (c.req.trial as unknown[]).slice(0, 3) : [];
  const trial: Result[] = [];
  const answers: NonNullable<Done['answers']> = [];
  const notes: string[] = [];
  for (let i = 0; i < 3; i++) {
    const m = mark(c, proofs[i], 'master-trial');
    trial.push(m.result);
    answers.push(...m.answers);
    notes.push(...m.notes);
  }
  const seed = c.s.seed();
  const start = startMasterFight(hero, seed);
  // The day's try is used when the fight is handed out, so closing the tab does not give it back.
  const open: OpenFight = { id: c.s.newId(), kind: 'master', seed, start, info: { day: c.today, sizeUp: false, trial } };
  return { hero: { ...hero, masterTried: true }, openFight: open, answers, notes, summary: { master: start.monster.id, trial }, result: { trial } };
}

function masterFinish(c: Ctx): Done | Refuse {
  const played = replayOpen(c, 'master');
  if (isRefuse(played)) return played;
  const { fight, actions, open } = played;
  const was = c.w.hero;
  let hero = applyMasterResult(was, fight);
  const trial = open.info.trial ?? [];
  if (fight.outcome === 'won') hero = addMasterTrialBonus(hero, trial);
  hero = keepToday(hero, was, open.info.day !== c.today);
  const won = fight.outcome === 'won';
  return {
    hero,
    gain: won ? { masterWins: 1 } : undefined,
    news: won ? [masterWonLine(c.player, masterFor(was.level)?.name ?? 'your master', hero.level)] : undefined,
    closeFight: { status: 'finished', actions, result: { outcome: fight.outcome, rounds: fight.round, level: hero.level } },
    summary: { outcome: fight.outcome, level: hero.level },
    result: { outcome: fight.outcome, level: hero.level, trial, bonusStrength: hero.strength - was.strength },
  };
}

function dragonStage(c: Ctx): Done | Refuse {
  const { hero, extra } = c.w;
  if (!canFaceDragon(hero)) return rule('You are not ready for the dragon yet.');
  const stage = c.req.stage;
  const expected = extra.dragon?.next ?? 1;
  if (!isInt(stage, 1, 3) || stage !== expected) return rule('That is not the next fight.');
  if (stage === 1 && extra.dragonDay === c.today) return rule('You have already faced the dragon today. Come back tomorrow.');
  const m = mark(c, c.req.riddle, 'dragon-trial');
  const seed = c.s.seed();
  const start = startDragonStage(hero, stage as 1 | 2 | 3, seed, { ...dragonStageOptions(m.result), heroHp: stage === 1 ? hero.hp : extra.dragon!.hp });
  const open: OpenFight = { id: c.s.newId(), kind: 'dragon', seed, start, info: { day: c.today, sizeUp: false, stage: stage as 1 | 2 | 3 } };
  return {
    extra: { ...extra, dragonDay: c.today }, openFight: open, answers: m.answers, notes: m.notes,
    summary: { stage, riddle: m.result }, result: { stage, riddle: m.result },
  };
}

function dragonFinish(c: Ctx): Done | Refuse {
  const played = replayOpen(c, 'dragon');
  if (isRefuse(played)) return played;
  const { fight, actions, open } = played;
  const stage = open.info.stage ?? 1;
  const { hero, extra } = c.w;
  const carried: Hero = { ...hero, skillLeft: fight.skillLeft };
  let next: Hero;
  let dragon: Extra['dragon'] = null;
  let finished = false;
  if (fight.outcome !== 'won') {
    next = loseToDragon(carried);
  } else if (stage < 3) {
    next = carried;
    dragon = { next: (stage + 1) as 2 | 3, hp: dragonBreather(hero, fight.heroHp) };
  } else {
    next = finishDragon(carried, c.today);
    finished = true;
  }
  return {
    hero: next, extra: { ...extra, dragon },
    gain: finished ? { dragons: 1 } : undefined,
    hall: finished,
    news: finished ? [dragonWonLine(c.player, next.dragonKills)] : undefined,
    closeFight: { status: 'finished', actions, result: { outcome: fight.outcome, rounds: fight.round, stage } },
    summary: { outcome: fight.outcome, stage, finished },
    result: { outcome: fight.outcome, stage, finished, stars: next.dragonKills, hpGoingIn: dragon?.hp ?? null },
  };
}

function shopBuy(c: Ctx): Done | Refuse {
  const { slot, index } = c.req;
  if ((slot !== 'weapon' && slot !== 'armour') || !isInt(index, 0, 99)) return { refuse: 'bad-request' };
  const full = buyGear(c.w.hero, slot, index);
  if (!full.ok) return rule(full.reason);
  const m = mark(c, c.req.proof, 'shop');
  const bought = buyGear(c.w.hero, slot, index, priceDiscount(m.result));
  if (!bought.ok) return rule(bought.reason);
  const item = (slot === 'weapon' ? WEAPONS : ARMOURS)[index];
  return {
    hero: bought.hero, answers: m.answers, notes: m.notes,
    summary: { slot, item: item.name, paid: bought.paid }, result: { item: item.name, paid: bought.paid, refund: bought.refund, saved: full.paid - bought.paid },
  };
}

function healAction(c: Ctx): Done | Refuse {
  const { hero } = c.w;
  const wanted = c.req.hp;
  if (!isInt(wanted, 1, 100_000)) return { refuse: 'bad-request' };
  const missing = hero.maxHp - hero.hp;
  if (missing <= 0) return rule('You are already in perfect health.');
  const m = mark(c, c.req.proof, 'healer');
  const discount = priceDiscount(m.result);
  const after = heal(hero, Math.min(wanted, missing), discount);
  if (after.hp === hero.hp) return rule('You cannot afford even one point of healing.');
  return {
    hero: after, answers: m.answers, notes: m.notes,
    summary: { healed: after.hp - hero.hp, paid: hero.gold - after.gold },
    result: { healed: after.hp - hero.hp, paid: hero.gold - after.gold, discount },
  };
}

function bank(c: Ctx): Done | Refuse {
  const { hero, extra } = c.w;
  const op = c.req.op;
  if (op === 'deposit' || op === 'withdraw') {
    const amount = c.req.amount;
    if (!isInt(amount, 1, 1_000_000_000)) return { refuse: 'bad-request' };
    const next = op === 'deposit' ? deposit(hero, amount) : withdraw(hero, amount);
    if (next.gold === hero.gold) return rule(op === 'deposit' ? 'You have no gold to put in the bank.' : 'You have nothing in the bank to take out.');
    return { hero: next, summary: { op, moved: Math.abs(next.gold - hero.gold) }, result: { moved: Math.abs(next.gold - hero.gold) } };
  }
  if (op !== 'interest') return { refuse: 'bad-request' };
  if (hero.level < 4) return rule('The banker only talks interest with heroes of level 4 and up.');
  if (hero.bank <= 0) return rule('Save some gold in the bank first.');
  if (extra.interestDay === c.today) return rule('You have already asked about interest today.');
  if (c.req.proof === undefined || c.req.proof === null) return rule('Answer the banker’s question to earn interest.');
  const m = mark(c, c.req.proof, 'bank');
  const extraGold = interestFor(hero.bank, m.result);
  return {
    hero: { ...hero, bank: hero.bank + extraGold }, extra: { ...extra, interestDay: c.today }, answers: m.answers, notes: m.notes,
    summary: { interest: extraGold }, result: { interest: extraGold, right: m.result === 'right' },
  };
}

function inn(c: Ctx): Done | Refuse {
  const { hero, extra } = c.w;
  const game = c.req.game;
  if (game === 'riddle') {
    if (extra.riddleDay === c.today) return rule('You have done the riddle today. Come back tomorrow!');
    if (c.req.proof === undefined || c.req.proof === null) return rule('Answer the riddle to earn gold.');
    const m = mark(c, c.req.proof, 'riddle');
    const gold = riddleGold(hero.level, m.result);
    return {
      hero: { ...hero, gold: hero.gold + gold }, extra: { ...extra, riddleDay: c.today }, answers: m.answers, notes: m.notes,
      summary: { riddle: m.result, gold }, result: { gold, right: m.result === 'right' },
    };
  }
  if (game === 'guess-start') {
    if (extra.guess?.day === c.today) return { summary: { guess: 'again' }, result: {} };
    const secret = 1 + (c.s.seed() % 100);
    return { extra: { ...extra, guess: { day: c.today, secret, tries: [], done: false } }, summary: { guess: 'start' }, result: {} };
  }
  if (game === 'guess') {
    const g = extra.guess;
    const n = c.req.n;
    if (!g || g.day !== c.today) return rule('Start the number game first.');
    if (g.done) return rule('You have played the number game today. Come back tomorrow!');
    if (!isInt(n, 1, 100)) return rule('Pick a whole number from 1 to 100.');
    const hint = n === g.secret ? 'win' : n < g.secret ? 'low' : 'high';
    const tries = [...g.tries, { n, hint } as const];
    const over = hint === 'win' || tries.length >= NUMBER_GUESS_TRIES;
    const prize = over ? numberGuessPrize(hero.level, hint === 'win') : 0;
    return {
      hero: over ? { ...hero, gold: hero.gold + prize } : undefined,
      extra: { ...extra, guess: { ...g, tries, done: over } },
      summary: { guess: n, hint, prize },
      result: { hint, tries: tries.length, over, prize, secret: over && hint !== 'win' ? g.secret : undefined },
    };
  }
  return { refuse: 'bad-request' };
}

/** A hero the pupil can meet in the arena: a classmate's saved copy, or a computer hero. */
interface Opponent {
  kind: 'pupil' | 'computer';
  id: string;
  name: string;
  duelist: Duelist;
}

const sane = (h: unknown): h is Hero => {
  const x = h as Hero | null;
  return !!x && typeof x === 'object' && Number.isInteger(x.level) && x.level >= 1 && x.level <= MAX_LEVEL
    && Number.isInteger(x.weapon) && x.weapon >= 0 && x.weapon < WEAPONS.length
    && Number.isInteger(x.armour) && x.armour >= 0 && x.armour < ARMOURS.length
    && Number.isFinite(x.strength) && Number.isFinite(x.defence) && Number.isFinite(x.maxHp) && x.maxHp > 0
    && typeof x.heroClass === 'string' && x.heroClass in CLASSES;
};

/** Three fights a day against a saved copy of a classmate's hero or a computer hero, near your level. Played by the server. */
async function arena(c: Ctx): Promise<Done | Refuse> {
  const { hero } = c.w;
  if (hero.arenaLeft <= 0) return { refuse: 'no-turns', message: 'You have used your arena fights today. Come back tomorrow!' };
  const season = seasonFor(c.settings, c.today);
  const classmates = await c.s.arenaCandidates(c.player, season.number, hero.level);
  const pool: Opponent[] = [];
  if (classmates.ok) {
    for (const k of classmates.value) {
      if (k && typeof k.player === 'string' && k.player !== c.player && typeof k.name === 'string' && sane(k.hero)) {
        pool.push({ kind: 'pupil', id: k.player, name: k.name, duelist: duelistOf(k.hero, k.name) });
      }
    }
  }
  for (const k of computerHeroes(season.number, season.dayOfSeason)) pool.push({ kind: 'computer', id: k.id, name: k.name, duelist: k.duelist });
  // Near your level: within one, or else the three closest.
  const gap = (o: Opponent) => Math.abs(o.duelist.level - hero.level);
  const near = pool.filter((o) => gap(o) <= 1);
  const choices = near.length > 0 ? near : [...pool].sort((x, y) => gap(x) - gap(y)).slice(0, 3);
  const seed = c.s.seed();
  const rand = makeRandom(seed ^ 0xa5a5a5a5);
  const opponent = choices[Math.min(choices.length - 1, Math.floor(rand() * choices.length))];
  const you = duelistOf(hero, 'You');
  const duel = playDuel(you, opponent.duelist, seed);
  const won = duel.winner === 'a';
  const exp = won ? arenaExp(hero.level) : 0;
  const after: Hero = { ...hero, arenaLeft: hero.arenaLeft - 1, exp: hero.exp + exp, arenaWins: hero.arenaWins + (won ? 1 : 0) };
  const slug = opponent.kind === 'computer' ? `computer-${opponent.id}` : `pupil-${opponent.id.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`;
  const result = { outcome: won ? 'won' : 'lost', rounds: duel.rounds, hpYou: duel.hpA, hpThem: duel.hpB, exp, log: duel.log };
  return {
    hero: after,
    gain: won ? { arenaWins: 1 } : undefined,
    news: won ? [arenaWonLine(c.player, opponent.kind === 'computer' ? opponent.name : null)] : undefined,
    doneFight: {
      id: c.s.newId(), kind: 'arena', monster: slug, seed, start: { a: you, b: opponent.duelist },
      info: { day: c.today, opponent: { kind: opponent.kind, name: opponent.name, level: opponent.duelist.level } }, result,
    },
    summary: { arena: won ? 'won' : 'lost', against: slug, rounds: duel.rounds, exp },
    result: {
      ...result,
      you: { name: you.name, heroClass: you.heroClass, level: you.level, maxHp: you.maxHp },
      opponent: { name: opponent.name, heroClass: opponent.duelist.heroClass, level: opponent.duelist.level, maxHp: opponent.duelist.maxHp, computer: opponent.kind === 'computer' },
    },
  };
}

/** Test tools: for teachers only. The browser trial (preview/lord) is its own teacher. */
async function tools(c: Ctx): Promise<Done | Refuse> {
  if (!(await c.teacher())) return { refuse: 'not-allowed', note: 'tools' };
  const { hero, extra, open } = c.w;
  const tool = c.req.tool as ToolId;
  const value = c.req.value;
  if (tool === 'abandon-fight') {
    if (!open) return rule('There is no fight to give up.');
    return { closeFight: { status: 'abandoned', actions: [], result: {} }, summary: { tool }, result: {} };
  }
  if (open) return { refuse: 'fight-open' };
  switch (tool) {
    case 'jump': {
      const to = typeof value === 'number' ? Math.max(1, Math.min(MAX_LEVEL, Math.round(value))) : 1;
      const base = baseStats(to);
      const gear = Math.min(WEAPONS.length - 1, to - 1);
      return {
        hero: { ...hero, level: to, ...base, hp: base.maxHp, weapon: gear, armour: gear, exp: to < MAX_LEVEL ? expNeeded(to) : expNeeded(MAX_LEVEL - 1), forestLeft: Math.max(hero.forestLeft, 10), skillLeft: 3, masterTried: false },
        extra: { ...extra, dragon: null, dragonDay: '' }, summary: { tool, to }, result: {},
      };
    }
    case 'gold': return { hero: { ...hero, gold: hero.gold + 1000 }, summary: { tool }, result: {} };
    case 'exp': return { hero: { ...hero, exp: hero.exp + 500 }, summary: { tool }, result: {} };
    case 'refill': return { hero: { ...hero, forestLeft: c.settings.forestPerDay, skillLeft: 3, masterTried: false }, extra: { ...extra, dragonDay: '' }, summary: { tool }, result: {} };
    case 'hurt': return { hero: { ...hero, hp: Math.max(1, Math.floor(hero.maxHp / 5)) }, summary: { tool }, result: {} };
    case 'best-gear': return { hero: { ...hero, weapon: WEAPONS.length - 1, armour: ARMOURS.length - 1 }, summary: { tool }, result: {} };
    case 'new-day': return { hero: { ...hero, day: '2000-01-01' }, extra: { ...extra, riddleDay: '', interestDay: '', guess: null, dragonDay: '' }, summary: { tool }, result: {} };
    case 'event': {
      if (typeof value !== 'string' || !EVENT_BY_ID[value]) return { refuse: 'bad-request' };
      return { extra: { ...extra, pendingEvent: value }, summary: { tool, event: value }, result: {} };
    }
    case 'reset': return { hero: newHero(hero.heroClass, c.today), extra: { ...newExtra(extra.stats), classOpen: true }, summary: { tool }, result: {} };
    default: return { refuse: 'bad-request' };
  }
}

// ---------- Running a request ----------

export const viewOf = (w: Pick<Work, 'hero' | 'extra' | 'open'> | null, version: number, today: string, season: ReturnType<typeof seasonOf>, settings: Settings): LordState => ({
  hero: w?.hero ?? null,
  version,
  today,
  season: { number: season.number, dayOfSeason: season.dayOfSeason, daysLeft: season.daysLeft },
  forestPerDay: settings.forestPerDay,
  classOpen: w?.extra.classOpen ?? false,
  openFight: w?.open ? { id: w.open.id, kind: w.open.kind, seed: w.open.seed, start: w.open.start, sizeUp: w.open.info.sizeUp, stage: w.open.info.stage, trial: w.open.info.trial } : null,
  pendingEvent: w?.extra.pendingEvent ?? null,
  dragon: w?.extra.dragon ?? null,
  dragonTried: w?.extra.dragonDay === today,
  riddleDone: w?.extra.riddleDay === today,
  interestDone: w?.extra.interestDay === today,
  guess: w?.extra.guess?.day === today ? { done: w.extra.guess.done, tries: w.extra.guess.tries } : null,
  stats: w?.extra.stats ?? newStats(),
});

export const DEFAULT_SETTINGS: Settings = { enabled: false, forestPerDay: FOREST_FIGHTS_PER_DAY, seasonStart: null };

/** The season a day falls in. With no start date set, the first season starts today. */
export function seasonFor(settings: Settings, today: string) {
  return settings.seasonStart ? seasonOf(settings.seasonStart, today) : { number: 1, dayOfSeason: 1, daysLeft: SEASON_DAYS - 1, started: true };
}

export interface RunResult {
  /** The HTTP status: 200 for anything the game dealt with, 503 when the database could not be reached. */
  status: 200 | 503;
  body: LordReply | { error: string };
}

const dayCount = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);

/**
 * A fight handed out and left alone for a whole day (it was handed out two or more New Zealand days ago) counts as a
 * loss, the soft way: a forest fight drops the gold carried and wakes you at the healer, a master just heals you (the
 * day's try stays used) and a dragon fight sends you home. Nothing else is lost, and the turn was already spent.
 */
export const ABANDONED_AFTER_DAYS = 2;

function abandonedHero(open: OpenFight, hero: Hero, extra: Extra): { hero: Hero; extra: Extra } {
  if (open.kind === 'forest') {
    return { hero: applyForestResult(hero, { ...open.start, over: true, outcome: 'lost', skillLeft: hero.skillLeft }), extra };
  }
  if (open.kind === 'master') return { hero: { ...hero, hp: hero.maxHp }, extra };
  return { hero: loseToDragon(hero), extra: { ...extra, dragon: null } };
}

const busy = (): RunResult => ({ status: 503, body: { error: "We couldn't reach your hero just now." } });

/** Runs one request for one signed-in student. Never throws. */
export async function runLord(s: Services, player: string, raw: unknown): Promise<RunResult> {
  const req = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  const action = req?.action;
  if (!req || typeof action !== 'string' || !ACTIONS.includes(action)) return { status: 200, body: { ok: false, reason: 'bad-request' } };

  const settingsOut = await s.settings();
  if (!settingsOut.ok) return busy();
  const settings = settingsOut.value;
  let teacherKnown: boolean | undefined;
  const teacher = async () => {
    if (teacherKnown === undefined) {
      const t = await s.isTeacher(player);
      teacherKnown = t.ok && t.value;
    }
    return teacherKnown;
  };
  // Teachers can still try the game while it is off, so it can be looked at before pupils see it.
  if (!settings.enabled && !(await teacher())) return { status: 200, body: { ok: false, reason: 'closed' } };

  const now = s.now();
  const today = nzDate(new Date(now));
  const season = seasonFor(settings, today);
  if (!season.started) {
    return { status: 200, body: { ok: false, reason: 'not-started', message: `The season starts in ${season.daysLeft} days.` } };
  }

  const requestId = req.requestId;
  const validId = typeof requestId === 'string' && UUID.test(requestId);
  const loaded = await s.load(player, validId ? requestId : undefined);
  if (!loaded.ok) return busy();
  let row = loaded.value.row;
  let stored = loaded.value.openFight;
  let abandoned: OpenFight['kind'] | null = null;

  // A fight left unfinished for a whole day counts as a loss, so it can't hang around for ever.
  if (row && stored && dayCount(today) - dayCount(stored.info.day) >= ABANDONED_AFTER_DAYS) {
    const lost = abandonedHero(stored, row.hero, readExtra(row.extra));
    const out = await s.commit(player, {
      expect: row.version, hero: lost.hero, season: row.season, extra: lost.extra, openFight: null,
      closeFight: { id: stored.id, status: 'abandoned', actions: [], result: { outcome: 'lost', abandoned: true } },
      event: { requestId: s.newId(), action: 'abandon', summary: { fight: stored.kind } },
      news: [], score: null, hall: null, doneFight: null,
    });
    if (!out.ok) return busy();
    if (out.value.status === 'saved') {
      abandoned = stored.kind;
      row = { ...row, hero: lost.hero, extra: lost.extra, version: out.value.version };
      stored = null;
    } else {
      // Another Chromebook got there first: carry on from what is saved.
      const again = await s.load(player, validId ? requestId : undefined);
      if (!again.ok) return busy();
      row = again.value.row;
      stored = again.value.openFight;
    }
  }

  // The day's own news (the village event, the computer heroes) is written by whoever opens the game first.
  if (action === 'load' && !loaded.value.dailyDone) await s.dailyNews(today, dailyNews(today, season));

  // 1. Nothing runs at midnight: the first request of a new day (or season) does it.
  let w: Work | null = null;
  let rolled = false;
  if (row) {
    let hero = row.hero;
    let extra = readExtra(row.extra);
    let rowSeason = row.season;
    // A new season starts the hero again, once any fight in progress is finished.
    if (rowSeason < season.number && !stored) {
      hero = newHero(hero.heroClass, today, { dragonKills: hero.dragonKills });
      extra = { ...newExtra(extra.stats), classOpen: true };
      rowSeason = season.number;
      rolled = true;
    }
    const newDay = hero.day !== today;
    if (newDay) {
      hero = rollDay(hero, today, settings.forestPerDay);
      extra = { ...extra, dragon: null };
      rolled = true;
    }
    // The teacher may lower the day's fights (a pile-up never goes past two days' worth).
    if (hero.forestLeft > settings.forestPerDay * FOREST_PILE_UP_DAYS) hero = { ...hero, forestLeft: settings.forestPerDay * FOREST_PILE_UP_DAYS };
    w = { hero, extra, season: rowSeason, open: stored };
  }

  const finishNow = (state: Work | null, version: number): LordState => viewOf(state, version, today, season, settings);

  // 2. Looking and rolling over.
  if (action === 'load' || action === 'rollover') {
    const note = abandoned ? { abandoned } : {};
    if (!row || !w) return { status: 200, body: { ok: true, state: finishNow(null, 0), result: {} } };
    if (!rolled) return { status: 200, body: { ok: true, state: finishNow(w, row.version), result: note } };
    const out = await s.commit(player, {
      expect: row.version, hero: w.hero, season: w.season, extra: w.extra, openFight: null, closeFight: null,
      event: { requestId: s.newId(), action: 'rollover', summary: { day: today, season: w.season } },
      news: [], score: null, hall: null, doneFight: null,
    });
    if (!out.ok) return out.why === 'busy' ? busy() : { status: 200, body: { ok: true, state: finishNow(w, row.version), result: {} } };
    // Someone else got there first (another Chromebook): carry on from what is saved.
    if (out.value.status !== 'saved') {
      const again = await s.load(player);
      if (again.ok && again.value.row) {
        const fresh: Work = { hero: again.value.row.hero, extra: again.value.row.extra, season: again.value.row.season, open: again.value.openFight };
        return { status: 200, body: { ok: true, state: finishNow(fresh, again.value.row.version), result: {} } };
      }
      return busy();
    }
    return { status: 200, body: { ok: true, state: finishNow(w, out.value.version), result: note } };
  }

  const refuse = (reason: Reason, message?: string): RunResult => ({
    status: 200, body: { ok: false, reason, message, ...(w ? { state: finishNow(w, row?.version ?? 0) } : {}) },
  });
  const note = async (reason: string) => {
    await s.recordRefusal(player, reason, action);
  };

  // 3. Every change has an id and says which version of the hero it was made from.
  if (!validId) {
    await note('bad-request');
    return refuse('bad-request');
  }
  // A request id that was used before: it already happened. Nothing is done twice.
  if (loaded.value.seen) return refuse('duplicate');
  const isFinish = (FINISH_ACTIONS as readonly string[]).includes(action);
  if (action === 'start-hero' && !row) {
    // A brand new hero starts from version 0.
  } else if (!row || !w) {
    return refuse('no-hero');
  } else {
    // A finish is tied to its fight (the fight is the lock); everything else must be made from the current version.
    if (!isFinish && req.version !== row.version) return refuse('stale');
    if (w.open && !isFinish && action !== 'tools') return refuse('fight-open', 'Finish your fight first.');
    if (isFinish && !w.open) return refuse('no-fight');
  }

  const base: Work = w ?? { hero: newHero('knight', today), extra: newExtra(), season: season.number, open: null };
  const ctx: Ctx = { player, w: base, req, today, settings, now, s, rolled, teacher };
  let done: Done | Refuse;
  switch (action) {
    case 'start-hero': done = startHero(ctx, !!row); break;
    case 'forest': done = forest(ctx); break;
    case 'event': done = event(ctx); break;
    case 'fight-finish': done = fightFinish(ctx); break;
    case 'master-start': done = masterStart(ctx); break;
    case 'master-finish': done = masterFinish(ctx); break;
    case 'dragon-stage': done = dragonStage(ctx); break;
    case 'dragon-finish': done = dragonFinish(ctx); break;
    case 'shop-buy': done = shopBuy(ctx); break;
    case 'heal': done = healAction(ctx); break;
    case 'bank': done = bank(ctx); break;
    case 'inn': done = inn(ctx); break;
    case 'arena': done = await arena(ctx); break;
    case 'tools': done = await tools(ctx); break;
    default: done = { refuse: 'bad-request' };
  }
  if (isRefuse(done)) {
    if (done.refuse === 'tampered' || done.refuse === 'not-allowed' || done.refuse === 'bad-request') await note(done.note ?? done.refuse);
    return refuse(done.refuse, done.message);
  }
  for (const code of done.notes ?? []) await note(code);

  // 4. One atomic save: the hero, the fight and a note of what happened.
  const nextHero = done.hero ?? base.hero;
  // What the pupil has done over all seasons: the achievements read this, and the points come from the first three.
  const gain = done.gain ?? {};
  const rightAnswers = (done.answers ?? []).filter((a) => a.correct).length;
  const before = (done.extra ?? base.extra).stats;
  const stats: Stats = {
    forestWins: before.forestWins + (gain.forestWins ?? 0), masterWins: before.masterWins + (gain.masterWins ?? 0),
    arenaWins: before.arenaWins + (gain.arenaWins ?? 0), riddles: before.riddles + rightAnswers,
    dragons: before.dragons + (gain.dragons ?? 0), bestLevel: Math.max(before.bestLevel, nextHero.level),
  };
  const nextExtra: Extra = { ...(done.extra ?? base.extra), stats };
  const nextOpen = done.openFight ?? (done.closeFight ? null : base.open);
  const changed = !!(done.hero || done.extra || done.openFight || done.closeFight || done.doneFight);
  const earned = { forest: gain.forestWins ?? 0, master: gain.masterWins ?? 0, dragon: gain.dragons ?? 0 };
  const reply = (state: Work, version: number): RunResult => ({ status: 200, body: { ok: true, state: finishNow(state, version), result: done.result } });
  const after: Work = { hero: nextHero, extra: nextExtra, season: base.season, open: nextOpen };
  if (!changed && !rolled) return reply(after, row?.version ?? 0);

  const out = await s.commit(player, {
    expect: row?.version ?? 0, hero: nextHero, season: base.season, extra: nextExtra,
    openFight: done.openFight ?? null,
    closeFight: done.closeFight && base.open ? { id: base.open.id, ...done.closeFight } : null,
    event: { requestId: requestId as string, action, summary: done.summary },
    news: done.news ?? [],
    score: earned.forest + earned.master + earned.dragon > 0 ? earned : null,
    hall: done.hall ? { season: base.season } : null,
    doneFight: done.doneFight ?? null,
  });
  if (!out.ok) return out.why === 'busy' || out.why === 'too-many' ? busy() : refuse('bad-request');
  if (out.value.status !== 'saved') {
    // Carry on from what is really saved.
    const again = await s.load(player);
    const reason: Reason = out.value.status === 'duplicate' ? 'duplicate' : out.value.status === 'open-fight' ? 'fight-open' : out.value.status === 'no-fight' ? 'no-fight' : 'stale';
    if (again.ok && again.value.row) {
      const fresh: Work = { hero: again.value.row.hero, extra: again.value.row.extra, season: again.value.row.season, open: again.value.openFight };
      return { status: 200, body: { ok: false, reason, state: finishNow(fresh, again.value.row.version) } };
    }
    return busy();
  }

  // Answers go in the maths records once the save is kept (a retry reuses the same batch keys, so it counts once).
  const byPack = new Map<string, FactAnswer[]>();
  for (const { pack, ...a } of done.answers ?? []) byPack.set(pack, [...(byPack.get(pack) ?? []), a]);
  for (const [pack, list] of byPack) await s.recordAnswers(player, pack, `${requestId as string}:${pack}`, list);
  return reply(after, out.value.version);
}
