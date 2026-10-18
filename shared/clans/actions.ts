/**
 * The server side of Clan Quest, as plain functions: an action comes in (what the child pressed), the saved clan
 * goes in, and either a new clan and a result come out, or a kind refusal. The server function `clans` is only
 * the plumbing around `applyAction`; the rules are the same `shared/clans` code the screens use, so a changed
 * browser cannot make the server do anything the rules refuse.
 *
 * Maths never blocks: the shop, Church and Training Hall take the true price whatever the child answered, so
 * those actions carry no answers. A quest puzzle changes the prize, so the quest action carries the answer and
 * the server rebuilds the puzzle from the clan's seed, the day, the quest and the choice to mark it.
 * Fights, the midnight job and raids on classmates are not here yet (part B and stage C.6).
 */
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalSettings } from '../maths/practical';
import { CONFIG } from './config';
import { dayReset } from './character';
import { clanFromChoices, type Draft } from './create';
import { build, claimLand, deposit, developPlot, empireNewDay, empireOf, PUSHES, setDraft, withdraw, type BattlePlan, type BattleResult, type Push } from './empire';
import { ITEMS } from './gamedata';
import { buyItem, buyTroopMix, draftFollowers, examineItemFor, raidSeed, sendArmyTo, trainMember, TRAIN_KEYS, wakeEveryone, wakeOne, type TrainKey } from './play';
import { buildPuzzle, finishQuest, puzzleFor, todaysQuest, type QuestPrize } from './quests';
import { BUILDING_KINDS, TROOP_KINDS, type BuildingKind, type Clan, type Troops } from './types';


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
}

/** What changes from request to request, passed in so tests can fix it. */
export interface Context {
  /** The clan's seed if it has none yet (from `clan_seeds`). */
  seed: number;
  /** New Zealand day number of the request. */
  today: number;
  /** The teacher's maths settings (the Teacher page comes in stage C.6; until then, the defaults). */
  settings?: PracticalSettings;
}

export type Action =
  | { type: 'load' }
  | { type: 'create'; name: string; drafts: Draft[] }
  | { type: 'buy'; member: number; item: string }
  | { type: 'examine'; member: number; item: string }
  | { type: 'train'; member: number; key: TrainKey; count: number }
  | { type: 'wake'; member: number }
  | { type: 'wakeAll' }
  | { type: 'deposit'; gold: number }
  | { type: 'withdraw'; gold: number }
  | { type: 'develop'; width: number; length: number }
  | { type: 'claim' }
  | { type: 'build'; plot: number; kind: BuildingKind }
  | { type: 'buyTroops'; mix: Troops }
  | { type: 'setDraft'; percent: number }
  | { type: 'draft' }
  | { type: 'raid'; kingdom: string; plan: BattlePlan }
  | { type: 'war'; kingdom: string; plan: BattlePlan }
  | { type: 'quest'; choice: number; answer: number | null };

export type ActionType = Action['type'];

export type Result =
  | { type: Exclude<ActionType, 'draft' | 'raid' | 'war' | 'quest'> }
  | { type: 'draft'; wanted: number; joined: number; followers: number }
  | { type: 'raid' | 'war'; friendly: boolean; result: BattleResult; gold: number }
  | { type: 'quest'; questId: number; text: string; right: boolean | null; prize: QuestPrize };

export type Applied =
  | { ok: true; state: ServerState | null; result: Result; changed: boolean }
  | { ok: false; why: string; say: string };

const refuse = (why: string, say: string): Applied => ({ ok: false, why, say });

// ---------------------------------------------------------------------------
// Reading an action from JSON
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

function parsePlan(v: unknown): BattlePlan | null {
  if (!isObj(v)) return null;
  const rounds = int(v.rounds, 1, CONFIG.empire.battle.maxRounds);
  const loot = int(v.loot, 0, 100);
  if (rounds === null || loot === null || typeof v.push !== 'string' || !PUSHES.includes(v.push as Push)) return null;
  return { rounds, push: v.push as Push, loot };
}

/** Reads an action sent by a browser. Null if it is not one the server knows, however it is changed. */
export function parseAction(raw: unknown): Action | null {
  if (!isObj(raw) || typeof raw.type !== 'string') return null;
  const member = int(raw.member, 0, CONFIG.maxMembers - 1);
  switch (raw.type) {
    case 'load': return { type: 'load' };
    case 'claim': return { type: 'claim' };
    case 'wakeAll': return { type: 'wakeAll' };
    case 'draft': return { type: 'draft' };
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
    case 'deposit':
    case 'withdraw': {
      const gold = int(raw.gold, 1, 1_000_000);
      return gold !== null ? { type: raw.type, gold } : null;
    }
    case 'develop': {
      const width = int(raw.width, 0, 100);
      const length = int(raw.length, 0, 100);
      return width !== null && length !== null ? { type: 'develop', width, length } : null;
    }
    case 'build': {
      const plot = int(raw.plot, 0, 1000);
      return plot !== null && typeof raw.kind === 'string' && BUILDING_KINDS.includes(raw.kind as BuildingKind) ? { type: 'build', plot, kind: raw.kind as BuildingKind } : null;
    }
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
    case 'setDraft': {
      const percent = int(raw.percent, 0, 100);
      return percent !== null ? { type: 'setDraft', percent } : null;
    }
    case 'raid':
    case 'war': {
      const plan = parsePlan(raw.plan);
      return plan && typeof raw.kingdom === 'string' && raw.kingdom.length <= 40 ? { type: raw.type, kingdom: raw.kingdom, plan } : null;
    }
    case 'quest': {
      const choice = int(raw.choice, 0, 5);
      const answer = raw.answer === null || raw.answer === undefined ? null : typeof raw.answer === 'number' && Number.isFinite(raw.answer) ? raw.answer : undefined;
      return choice !== null && answer !== undefined ? { type: 'quest', choice, answer } : null;
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
 * free wake-up comes back, the empire's energy and raids reset and the fights come back. A clan that was away for
 * a week gets one night's rest and moves to today's number. Returns true if anything changed.
 */
export function catchUp(state: ServerState, today: number): boolean {
  const day = clanDay(state.createdNzDay, today);
  if (day <= state.day) return false;
  dayReset(state.clan);
  empireNewDay(state.clan);
  empireOf(state.clan).day = day;
  state.fightsLeft = CONFIG.fightsPerDay;
  state.day = day;
  return true;
}

// ---------------------------------------------------------------------------
// Doing an action
// ---------------------------------------------------------------------------

const done = (state: ServerState, result: Result, changed = true): Applied => ({ ok: true, state, result, changed });

/**
 * Apply one action to the saved clan (null if the student has none yet). Works on a copy: the state that
 * comes in is never changed, so a refusal leaves everything as it was.
 */
export function applyAction(saved: ServerState | null, action: Action, ctx: Context): Applied {
  const settings = ctx.settings ?? DEFAULT_PRACTICAL_SETTINGS;

  if (action.type === 'create') {
    if (saved) return refuse('exists', 'You already have a clan.');
    const made = clanFromChoices(ctx.seed, action.name, action.drafts);
    if (!made.ok) return refuse('create', made.say);
    const state: ServerState = { clan: made.clan, seed: ctx.seed, day: 1, createdNzDay: ctx.today, fightsLeft: CONFIG.fightsPerDay, fightNo: 0, raidNo: 0, examined: [] };
    return done(state, { type: 'create' });
  }
  if (!saved) {
    return action.type === 'load' ? { ok: true, state: null, result: { type: 'load' }, changed: false } : refuse('no-clan', 'Make a clan first.');
  }

  const state = structuredClone(saved);
  const rested = catchUp(state, ctx.today);
  const { clan } = state;
  const settle = (r: { ok: boolean } & Partial<{ why: string; say: string }>, result: Result): Applied =>
    r.ok ? done(state, result) : refuse(r.why ?? 'no', r.say ?? 'That cannot be done right now.');

  switch (action.type) {
    case 'load':
      return done(state, { type: 'load' }, rested);
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
    case 'wakeAll': return settle(wakeEveryone(clan), { type: 'wakeAll' });
    case 'deposit': return settle(deposit(clan, action.gold), { type: 'deposit' });
    case 'withdraw': return settle(withdraw(clan, action.gold), { type: 'withdraw' });
    case 'develop': return settle(developPlot(empireOf(clan), action.width, action.length), { type: 'develop' });
    case 'claim': return settle(claimLand(empireOf(clan)), { type: 'claim' });
    case 'build': return settle(build(empireOf(clan), action.plot, action.kind), { type: 'build' });
    case 'buyTroops': return settle(buyTroopMix(clan, action.mix), { type: 'buyTroops' });
    case 'setDraft': return settle(setDraft(empireOf(clan), action.percent), { type: 'setDraft' });
    case 'draft': {
      const out = draftFollowers(clan);
      return done(state, { type: 'draft', ...out });
    }
    case 'raid':
    case 'war': {
      const friendly = action.type === 'war';
      const out = sendArmyTo(clan, action.kingdom, action.plan, friendly, raidSeed(state.seed, state.raidNo));
      if (!out.ok) return refuse(out.why, out.say);
      state.raidNo++;
      return done(state, { type: action.type, friendly, result: out.result, gold: out.gold });
    }
    case 'quest': {
      const q = todaysQuest(state.seed, state.day, settings);
      if (!q) return refuse('quest', 'There is no quest for you today.');
      if (action.choice >= q.choices.length) return refuse('choice', 'That choice is not in this story.');
      const spec = puzzleFor(q, action.choice, state.seed, state.day, settings);
      const right = spec ? action.answer !== null && buildPuzzle(spec).answer === action.answer : null;
      const finished = finishQuest(clan, state.day, q, action.choice, right);
      return finished.ok ? done(state, { type: 'quest', questId: q.id, text: finished.text, right: finished.right, prize: finished.prize }) : refuse('quest', finished.say);
    }
  }
}
