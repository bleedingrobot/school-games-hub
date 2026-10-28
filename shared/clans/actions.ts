/**
 * The server side of Clan Quest, as plain functions: an action comes in (what the child pressed), the saved clan
 * goes in, and either a new clan and a result come out, or a kind refusal. The server function `clans` is only
 * the plumbing around `applyAction`; the rules are the same `shared/clans` code the screens use, so a changed
 * browser cannot make the server do anything the rules refuse.
 *
 * Maths never blocks: the shop, Church and Training Hall take the true price whatever the child answered, so
 * those actions carry no answers. A quest puzzle changes the prize, so the quest action carries the answer and
 * the server rebuilds the puzzle from the clan's seed, the day, the quest and the choice to mark it.
 *
 * A mine fight is three kinds of request. `fightStart`: the server takes one off today's fights, picks the monsters from
 * the clan's seed and the fight number, and keeps the fight open. `fightRound`: the browser plays each round itself, and
 * sends what it did (the orders and the Battle Cry answer); the server replays the whole fight from its seed with
 * `replayFight`, marks the answer by rebuilding the question, keeps the round, and when the fight is over pays out
 * (gold, followers, experience, knocked-out members) in the same save that closes the fight, so it can only pay once.
 * While a fight is open nothing else about the clan can change (that is what keeps the replay honest), and the night's
 * rest waits until the fight is over. A ladder fight (the browser asks for one with `ladder: true`) also keeps the questions the
 * server made from the child's maths focus, and `cryCheck` marks each Battle Cry answer as it is given (battleCry.ts).
 * "My Village" gives every clan its own buildings (`upgrade`, paid from the purse) and raids on classmates (which also change the raided clan,
 * saved in the same transaction). A save from before My Village is converted by `upgradeSave` when it loads.
 */
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalSettings } from '../maths/practical';
import { makeRunQuestions, markQuestion, sameAnswer, seededRandom, type MathsContext, type PublicQuestion } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import { factKey, replayFight, type CryAnswer, type CryMark, type RecordedRound } from './battleCry';
import { CONFIG } from './config';
import { dayReset } from './character';
import { clanFromChoices, type Draft } from './create';
import { empireNewDay, empireOf, needsUpgrade, PUSHES, syncVillage, TAKES, upgrade, upgradeSave, type BattleResult, type Push, type Take } from './empire';
import { bossAt, newFight, type Order } from './fight';
import { ITEMS } from './gamedata';
import { isLook, setLook, type Look } from './looks';
import { earnedOrNone, type Earned } from './rewards';
import { buyItem, buyTroopMix, examineItemFor, fightSeed, payFight, raidSeed, sendArmyTo, trainMember, TRAIN_KEYS, wakeEveryone, wakeOne, type FightSummary, type TrainKey } from './play';
import { buildPuzzle, finishQuest, puzzleFor, todaysQuest, type QuestPrize } from './quests';
import { TROOP_KINDS, VILLAGE_BUILDINGS, type Clan, type Empire, type Troops, type Village, type VillageBuilding } from './types';
import { raidClassmateNz, raidTargetList, type RaidTarget, type Sketch, type TargetEntry } from './village';


/**
 * A mine fight that has been started and not finished. The monsters and the dice come from `seed`; the rounds are what the
 * browser has played so far, so the fight can be rebuilt (by a refresh, or another Chromebook) exactly where it was.
 * The clan's members cannot change while it is open, so they are not copied here.
 */
export interface OpenFight<Q = Question> {
  depth: number;
  boss: boolean;
  seed: number;
  /** The clan's fight number this was (1 for the first fight ever). */
  no: number;
  /** The maths settings the fight's Battle Cry questions were made with, kept so a teacher's change cannot alter an open fight. */
  settings: PracticalSettings;
  rounds: RecordedRound[];
  /**
   * A ladder fight's Battle Cry questions, one a round, made by the server from the child's maths when the fight began.
   * The server keeps the whole questions; the browser is only given what to show (`publicQuestion`). Missing: an old-style fight.
   */
  questions?: Q[];
  /** A ladder fight's marks, by round (index 0 is round 1): set by `cryCheck`, so each question is answered once. */
  marks?: (CryMark | null)[];
}

/** The fight in progress as the browser is given it: a ladder fight's questions without their answers. */
export type ShownFight = OpenFight<PublicQuestion>;

/** Everything the server keeps about one clan, besides the clan itself. */
export interface ServerState {
  clan: Clan;
  /** The clan's seed, made by the server. Every puzzle and raid comes from it. */
  seed: number;
  /** The clan's day number: 1 on the first day, counting New Zealand days. */
  day: number;
  /** The New Zealand day number (days since 1970) of the clan's first day. */
  createdNzDay: number;
  fightsLeft: number;
  fightNo: number;
  raidNo: number;
  /** Items a member has looked at closely, as "member|item". */
  examined: string[];
  /** The mine fight in progress, if any. */
  fight?: OpenFight | null;
}

/** What changes from request to request, passed in so tests can fix it. */
export interface Context {
  /** The clan's seed if it has none yet (from `clan_seeds`). */
  seed: number;
  /** New Zealand day number of the request. */
  today: number;
  /** The teacher's maths settings (the Teacher page comes in stage C.6; until then, the defaults). */
  settings?: PracticalSettings;
  /** The child's maths records, class settings and focus, loaded only to start a ladder fight. */
  maths?: MathsContext | null;
  /** Mine fights a day (the teacher's setting). The default is `CONFIG.fightsPerDay`. */
  fightsPerDay?: number;
  /**
   * The levels of the class (group) village this clan belonged to, for converting an old save the first time it loads.
   * Without it the clan's own `village` is used. Ignored once the save is converted.
   */
  groupVillage?: Village | null;
  /** This clan's hidden public id (never the account id), used to tell clans apart in raids. */
  self?: string;
  /** The teacher's switch for raids on classmates. Off unless it is given. */
  raidsOn?: boolean;
  /** The teacher's switch for made-up hero names. Off unless it is given: names come from the list. */
  typedNames?: boolean;
  /** The other clans in the class, for the list of who can be raided. */
  mates?: Sketch[];
  /** The clan a raid on a classmate is aimed at, loaded by the server (null if it is not in this class). */
  target?: RaidTarget | null;
}

export type Action =
  | { type: 'load' }
  | { type: 'create'; name: string; drafts: Draft[] }
  | { type: 'buy'; member: number; item: string }
  | { type: 'examine'; member: number; item: string }
  | { type: 'train'; member: number; key: TrainKey; count: number }
  | { type: 'wake'; member: number }
  | { type: 'look'; member: number; look: Look }
  | { type: 'wakeAll' }
  /** Take a building up one level, paid from the purse (2 a day). */
  | { type: 'upgrade'; building: VillageBuilding }
  | { type: 'buyTroops'; mix: Troops }
  /** A battle plan is just the push: 3 rounds and 10% loot are fixed. */
  | { type: 'raid'; kingdom: string; push: Push }
  | { type: 'war'; kingdom: string; push: Push }
  | { type: 'quest'; choice: number; answer: number | null }
  /** `ladder`: this browser can show ladder questions (an older one that is still open does not say so, and gets an old-style fight). */
  | { type: 'fightStart'; depth: number; boss: boolean; ladder?: boolean }
  /** A ladder fight's Battle Cry answer for the round about to be played, marked by the server. `ms`: how long it took. */
  | { type: 'cryCheck'; round: number; answer: number; ms: number }
  | { type: 'fightRound'; round: number; orders: (Order | undefined)[]; cry: CryAnswer | null }
  | { type: 'raidTargets' }
  | { type: 'raidClass'; target: string; take: Take; push: Push };

export type ActionType = Action['type'];

export type Result =
  | { type: Exclude<ActionType, 'upgrade' | 'raid' | 'war' | 'quest' | 'fightStart' | 'cryCheck' | 'fightRound' | 'raidTargets' | 'raidClass'> }
  | { type: 'upgrade'; building: VillageBuilding; level: number }
  | { type: 'raid' | 'war'; friendly: boolean; result: BattleResult; gold: number; earned?: Earned }
  | { type: 'quest'; questId: number; text: string; right: boolean | null; prize: QuestPrize }
  /** `resumed`: a fight was already open, so this is it again and no fight was used. */
  | { type: 'fightStart'; resumed: boolean }
  /** `answer`: the right answer, to show when it was wrong. `given`: the answer that was marked (the first one sent for this question). */
  | { type: 'cryCheck'; round: number; correct: boolean; answer: number; given: number }
  /** `summary` is there when the round ended the fight and it has been paid. */
  | { type: 'fightRound'; round: number; over: boolean; summary: FightSummary | null; earned?: Earned }
  | { type: 'raidTargets'; targets: TargetEntry[] }
  | { type: 'raidClass'; take: Take; result: BattleResult; gold: number; destroyed: VillageBuilding[]; earned?: Earned };

/** What else the server must do in the same save as a changed clan. Nothing in here is sent to the browser. */
export interface Effects {
  /** A raid on a classmate: the raided clan's new empire and purse (gold) and the lines to write. */
  raid?: { targetId: string; empire: Empire; gold: number; news: string; note: string };
  /** Maths answers to keep in the teacher's private records: the question's kind and year band (never the numbers), and whether it was right. */
  answers?: { key: string; correct: boolean }[];
  /** Ladder answers, for the child's own maths records (ladder place, skill map, focus results). `once` makes a resend count once. */
  ladder?: { once: string; answers: { key: string; correct: boolean; ms: number }[] };
}

export type Applied =
  | { ok: true; state: ServerState | null; result: Result; changed: boolean; effects?: Effects }
  | { ok: false; why: string; say: string };

const refuse = (why: string, say: string): Applied => ({ ok: false, why, say });
const earnedPart = (earned: Earned | undefined) => (earned ? { earned } : {});

// ---------------------------------------------------------------------------
// Reading an action from JSON
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

const parsePush = (v: unknown): Push | null => (typeof v === 'string' && PUSHES.includes(v as Push) ? (v as Push) : null);

const ORDER_ACTIONS = ['attack', 'spell', 'guard', 'run', 'skip'];

/** One member's order for a round. `undefined` for "none" (sent as null). Null if it is not an order. */
function parseOrder(v: unknown): Order | undefined | null {
  if (v === null || v === undefined) return undefined;
  if (!isObj(v) || typeof v.action !== 'string' || !ORDER_ACTIONS.includes(v.action)) return null;
  switch (v.action) {
    case 'attack': {
      const target = int(v.target, -1, 20);
      return target === null ? null : { action: 'attack', target };
    }
    case 'spell': {
      const spell = int(v.spell, 0, 500);
      const target = int(v.target, -1, 20);
      return spell === null || target === null ? null : { action: 'spell', spell, target };
    }
    default: return { action: v.action } as Order;
  }
}

function parseCry(v: unknown): CryAnswer | null | undefined {
  if (v === null || v === undefined) return null;
  if (!isObj(v) || (v.reward !== 'damage' && v.reward !== 'heal')) return undefined;
  const answer = v.answer === null || v.answer === undefined ? null : typeof v.answer === 'number' && Number.isFinite(v.answer) ? v.answer : undefined;
  return answer === undefined ? undefined : { answer, reward: v.reward };
}

/** Reads an action sent by a browser. Null if it is not one the server knows, however it is changed. */
export function parseAction(raw: unknown): Action | null {
  if (!isObj(raw) || typeof raw.type !== 'string') return null;
  const member = int(raw.member, 0, CONFIG.maxMembers - 1);
  switch (raw.type) {
    case 'load': return { type: 'load' };
    case 'wakeAll': return { type: 'wakeAll' };
    case 'create': {
      if (typeof raw.name !== 'string' || !Array.isArray(raw.drafts) || raw.drafts.length > CONFIG.maxMembers) return null;
      return { type: 'create', name: raw.name, drafts: raw.drafts as Draft[] };
    }
    case 'buy':
    case 'examine':
      return member !== null && typeof raw.item === 'string' ? { type: raw.type, member, item: raw.item } : null;
    case 'train': {
      const count = int(raw.count, 1, 500);
      return member !== null && count !== null && typeof raw.key === 'string' && TRAIN_KEYS.includes(raw.key as TrainKey) ? { type: 'train', member, key: raw.key as TrainKey, count } : null;
    }
    case 'wake': return member !== null ? { type: 'wake', member } : null;
    case 'look': return member !== null && isLook(raw.look) ? { type: 'look', member, look: raw.look } : null;
    case 'upgrade': return typeof raw.building === 'string' && VILLAGE_BUILDINGS.includes(raw.building as VillageBuilding) ? { type: 'upgrade', building: raw.building as VillageBuilding } : null;
    case 'buyTroops': {
      if (!isObj(raw.mix)) return null;
      const mix = {} as Troops;
      for (const k of TROOP_KINDS) {
        const n = int(raw.mix[k], 0, 100_000);
        if (n === null) return null;
        mix[k] = n;
      }
      return { type: 'buyTroops', mix };
    }
    case 'raid':
    case 'war': {
      const push = parsePush(raw.push);
      return push && typeof raw.kingdom === 'string' && raw.kingdom.length <= 40 ? { type: raw.type, kingdom: raw.kingdom, push } : null;
    }
    case 'quest': {
      const choice = int(raw.choice, 0, 5);
      const answer = raw.answer === null || raw.answer === undefined ? null : typeof raw.answer === 'number' && Number.isFinite(raw.answer) ? raw.answer : undefined;
      return choice !== null && answer !== undefined ? { type: 'quest', choice, answer } : null;
    }
    case 'fightStart': {
      const depth = int(raw.depth, 0, CONFIG.maxLevel);
      if (depth === null || typeof raw.boss !== 'boolean') return null;
      return raw.ladder === true ? { type: 'fightStart', depth, boss: raw.boss, ladder: true } : { type: 'fightStart', depth, boss: raw.boss };
    }
    case 'cryCheck': {
      const round = int(raw.round, 1, CONFIG.maxRounds);
      const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
      if (round === null || !ok(raw.answer) || Math.abs(raw.answer) > 1_000_000_000 || !ok(raw.ms) || raw.ms < 0) return null;
      return { type: 'cryCheck', round, answer: raw.answer, ms: Math.min(Math.round(raw.ms), 3_600_000) };
    }
    case 'fightRound': {
      const round = int(raw.round, 1, CONFIG.maxRounds);
      if (round === null || !Array.isArray(raw.orders) || raw.orders.length > CONFIG.maxMembers) return null;
      const orders: (Order | undefined)[] = [];
      for (const o of raw.orders) {
        const order = parseOrder(o);
        if (order === null) return null;
        orders.push(order);
      }
      const cry = parseCry(raw.cry);
      return cry === undefined ? null : { type: 'fightRound', round, orders, cry };
    }
    case 'raidTargets': return { type: 'raidTargets' };
    case 'raidClass': {
      const push = parsePush(raw.push);
      const take = TAKES.includes(raw.take as Take) ? (raw.take as Take) : null;
      return push && take && typeof raw.target === 'string' && raw.target.length >= 1 && raw.target.length <= 40 ? { type: 'raidClass', target: raw.target, take, push } : null;
    }
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

/** The clan's day number for this New Zealand day. */
export const clanDay = (createdNzDay: number, today: number) => Math.max(1, today - createdNzDay + 1);

/**
 * If a new day has started since the clan was last saved, give it the night's rest: everyone heals, the Church's
 * free wake-up comes back, the day's builds and raids reset and the fights come back. A clan that was away for
 * a week gets one night's rest and moves to today's number. Returns true if anything changed.
 */
export function catchUp(state: ServerState, today: number, fightsPerDay: number = CONFIG.fightsPerDay): boolean {
  const day = clanDay(state.createdNzDay, today);
  if (day <= state.day) return false;
  dayReset(state.clan);
  empireNewDay(state.clan);
  empireOf(state.clan).day = day;
  state.fightsLeft = fightsPerDay;
  state.day = day;
  return true;
}

// ---------------------------------------------------------------------------
// Doing an action
// ---------------------------------------------------------------------------

const done = (state: ServerState, result: Result, changed = true, effects?: Effects): Applied => ({ ok: true, state, result, changed, ...(effects ? { effects } : {}) });

/**
 * Apply one action to the saved clan (null if the student has none yet). Works on a copy: the state that
 * comes in is never changed, so a refusal leaves everything as it was.
 */
export function applyAction(saved: ServerState | null, action: Action, ctx: Context): Applied {
  const settings = ctx.settings ?? DEFAULT_PRACTICAL_SETTINGS;

  if (action.type === 'create') {
    if (saved) return refuse('exists', 'You already have a clan.');
    const made = clanFromChoices(ctx.seed, action.name, action.drafts, ctx.typedNames === true);
    if (!made.ok) return refuse('create', made.say);
    const state: ServerState = { clan: made.clan, seed: ctx.seed, day: 1, createdNzDay: ctx.today, fightsLeft: ctx.fightsPerDay ?? CONFIG.fightsPerDay, fightNo: 0, raidNo: 0, examined: [] };
    return done(state, { type: 'create' });
  }
  if (!saved) {
    return action.type === 'load' ? { ok: true, state: null, result: { type: 'load' }, changed: false } : refuse('no-clan', 'Make a clan first.');
  }

  const state = structuredClone(saved);
  // A save from before My Village is converted once, here (the class village's levels come from the server).
  const upgraded = needsUpgrade(state.clan);
  if (upgraded) state.clan = upgradeSave(state.clan, ctx.groupVillage ?? null);
  // The night's rest waits until a fight in progress is over: it would heal the members the fight is being replayed with.
  const rested = state.fight ? false : catchUp(state, ctx.today, ctx.fightsPerDay);
  if (state.fight && action.type !== 'load' && action.type !== 'fightStart' && action.type !== 'cryCheck' && action.type !== 'fightRound' && action.type !== 'raidTargets') {
    return refuse('fight-open', 'You are in the middle of a fight. Finish it first!');
  }
  const { clan } = state;
  syncVillage(clan);
  const settle = (r: { ok: boolean } & Partial<{ why: string; say: string }>, result: Result): Applied =>
    r.ok ? done(state, result) : refuse(r.why ?? 'no', r.say ?? 'That cannot be done right now.');

  switch (action.type) {
    case 'load':
      return done(state, { type: 'load' }, rested || upgraded);
    case 'buy': {
      const item = ITEMS.find((i) => i.name === action.item);
      return item ? settle(buyItem(clan, action.member, item), { type: 'buy' }) : refuse('item', 'The shop does not have that.');
    }
    case 'examine': {
      const item = ITEMS.find((i) => i.name === action.item);
      return item ? settle(examineItemFor(clan, state.examined, action.member, item), { type: 'examine' }) : refuse('item', 'The shop does not have that.');
    }
    case 'train': return settle(trainMember(clan, action.member, action.key, action.count), { type: 'train' });
    case 'wake': return settle(wakeOne(clan, action.member), { type: 'wake' });
    case 'look': return settle(setLook(clan, action.member, action.look), { type: 'look' });
    case 'wakeAll': return settle(wakeEveryone(clan), { type: 'wakeAll' });
    case 'upgrade': {
      const out = upgrade(clan, action.building);
      return out.ok ? done(state, { type: 'upgrade', building: action.building, level: empireOf(clan).levels[action.building] }) : refuse(out.why, out.say);
    }
    case 'buyTroops': return settle(buyTroopMix(clan, action.mix), { type: 'buyTroops' });
    case 'raid':
    case 'war': {
      const friendly = action.type === 'war';
      const out = sendArmyTo(clan, action.kingdom, action.push, friendly, raidSeed(state.seed, state.raidNo));
      if (!out.ok) return refuse(out.why, out.say);
      state.raidNo++;
      const won = out.result.outcome === 'won';
      const earned = earnedOrNone({ wars: friendly && won ? 1 : 0, kingdomRaids: !friendly && won ? 1 : 0 });
      return done(state, { type: action.type, friendly, result: out.result, gold: out.gold, ...(earned ? { earned } : {}) });
    }
    case 'quest': {
      const q = todaysQuest(state.seed, state.day, settings);
      if (!q) return refuse('quest', 'There is no quest for you today.');
      if (action.choice >= q.choices.length) return refuse('choice', 'That choice is not in this story.');
      const spec = puzzleFor(q, action.choice, state.seed, state.day, settings);
      const right = spec ? action.answer !== null && buildPuzzle(spec).answer === action.answer : null;
      const finished = finishQuest(clan, state.day, q, action.choice, right);
      // A puzzle that was tried (even wrongly, even given up on) goes in the teacher's private records.
      const answers = spec && finished.ok ? [{ key: factKey(settings.yearBand, buildPuzzle(spec).kind), correct: right === true }] : undefined;
      return finished.ok ? done(state, { type: 'quest', questId: q.id, text: finished.text, right: finished.right, prize: finished.prize }, true, answers ? { answers } : undefined) : refuse('quest', finished.say);
    }
    case 'raidTargets': {
      const targets = raidTargetList(state, ctx.today, ctx.self ?? '', ctx.raidsOn ?? false, ctx.mates ?? []);
      return done(state, { type: 'raidTargets', targets }, rested || upgraded);
    }
    case 'raidClass': {
      if (!ctx.target || !ctx.self) return refuse('target', 'That clan is not in your class.');
      const out = raidClassmateNz(state, ctx.self, ctx.target, action.take, action.push, raidSeed(state.seed, state.raidNo), ctx.today, ctx.raidsOn ?? false);
      if (!out.ok) return refuse(out.why, out.say);
      state.raidNo++;
      const { gold, destroyed } = out.raid;
      return {
        ok: true, state, changed: true,
        result: { type: 'raidClass', take: action.take, result: out.raid.result, gold, destroyed, ...earnedPart(earnedOrNone({ classRaids: out.raid.result.outcome === 'won' ? 1 : 0 })) },
        effects: { raid: { targetId: ctx.target.id, empire: out.defenderEmpire, gold: out.defenderGold, news: out.news, note: out.note } },
      };
    }
    case 'fightStart': {
      // A fight is already open (a refresh, or another Chromebook): this is that fight again, and nothing more is used.
      if (state.fight) return done(state, { type: 'fightStart', resumed: true }, false);
      if (state.fightsLeft <= 0) return refuse('fights', "That's all the fights for today. Come back tomorrow!");
      if (!clan.members.some((m) => !m.knockedOut)) return refuse('resting', 'Everyone is resting. They wake up tomorrow.');
      if (action.boss && !bossAt(action.depth)) return refuse('boss', 'There is no boss at that depth.');
      const seed = fightSeed(state.seed, state.fightNo);
      if (newFight(clan.members, action.depth, seed, action.boss).result) return refuse('resting', 'Everyone is resting. They wake up tomorrow.');
      state.fight = { depth: action.depth, boss: action.boss, seed, no: state.fightNo + 1, settings, rounds: [] };
      // A ladder fight: the questions come from the child's own maths, made now from the fight's seed and kept with it.
      // Without the child's maths (it couldn't be loaded) the fight is an old-style one, so the fight still goes ahead.
      if (action.ladder && ctx.maths) {
        state.fight.questions = makeRunQuestions(ctx.maths, CONFIG.maxRounds, seededRandom(`clans:${seed}:${state.fightNo + 1}`));
        state.fight.marks = [];
      }
      state.fightsLeft--;
      state.fightNo++;
      return done(state, { type: 'fightStart', resumed: false });
    }
    case 'cryCheck': {
      const open = state.fight;
      if (!open) return refuse('no-fight', 'That fight is already over.');
      if (!open.questions || !open.marks) return refuse('no-question', 'There is no question to answer.');
      if (action.round !== open.rounds.length + 1) return refuse('stale-round', 'That round was already played.');
      // Each question is answered once: asking again gives the first mark back, and nothing changes.
      const marked = markQuestion(open.questions[action.round - 1]);
      if (!marked) return refuse('no-question', 'There is no question to answer.');
      const before = open.marks[action.round - 1];
      if (before) return done(state, { type: 'cryCheck', round: action.round, correct: before.correct, answer: marked.answer, given: before.answer }, false);
      const correct = sameAnswer(action.answer, marked.answer);
      while (open.marks.length < action.round - 1) open.marks.push(null);
      open.marks[action.round - 1] = { answer: action.answer, correct };
      return done(state, { type: 'cryCheck', round: action.round, correct, answer: marked.answer, given: action.answer }, true, {
        ladder: { once: `clans:${open.seed}:${open.no}:${action.round}`, answers: [{ key: marked.key, correct, ms: action.ms }] },
      });
    }
    case 'fightRound': {
      const open = state.fight;
      if (!open) return refuse('no-fight', 'That fight is already over.');
      if (action.round !== open.rounds.length + 1) return refuse('stale-round', 'That round was already played.');
      const played: RecordedRound = { orders: action.orders, cry: action.cry };
      const { state: replayed, cries } = replayFight(clan.members, open.depth, open.seed, open.boss, [...open.rounds, played], open);
      // The replay stops once the fight is over, so a round that was sent after the end has no result.
      if (cries.length !== open.rounds.length + 1) return refuse('no-fight', 'That fight is already over.');
      // The question was marked by the server's own replay. A question that was taken goes in the teacher's private records.
      const cry = cries[cries.length - 1];
      const answers = cry.answered && cry.question ? [{ key: factKey(open.settings.yearBand, cry.question.kind), correct: cry.correct }] : undefined;
      const effects: Effects | undefined = answers ? { answers } : undefined;
      const rightCry = cry.answered && cry.correct ? 1 : 0;
      if (!replayed.result) {
        open.rounds.push(played);
        return done(state, { type: 'fightRound', round: action.round, over: false, summary: null, ...earnedPart(earnedOrNone({ cries: rightCry })) }, true, effects);
      }
      const boss = open.boss;
      const summary = payFight(clan, replayed);
      state.fight = null;
      const won = summary.result === 'won';
      const earned = earnedOrNone({ wins: won && !boss ? 1 : 0, bosses: won && boss ? 1 : 0, cries: rightCry });
      return done(state, { type: 'fightRound', round: action.round, over: true, summary, ...earnedPart(earned) }, true, effects);
    }
  }
}
