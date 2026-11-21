/**
 * The server side of Clan Quest, as plain functions: an action comes in (what the child pressed), the saved clan
 * goes in, and either a new clan and a result come out, or a kind refusal. The server function `clans` is only
 * the plumbing around `applyAction`; the rules are the same `shared/clans` code the screens use, so a changed
 * browser cannot make the server do anything the rules refuse.
 *
 * All the maths is ladder maths, made from the child's own maths by the server. Outside fights, `ask` makes the
 * question(s) for the shop's 10% discount, the quest (two) or the monster siege and keeps them with the clan; `buy`,
 * `quest` and `monsterStart` then send the answers and the server marks them once. Maths never blocks: a wrong
 * answer only means no discount, the smaller quest prize or less help from the siege.
 *
 * A mine fight is three kinds of request. `fightStart`: the server takes one off today's fights, picks the monsters from
 * the clan's seed and the fight number, and keeps the fight open. `fightRound`: the browser plays each round itself, and
 * sends what it did (the orders and the Battle Cry answer); the server replays the whole fight from its seed with
 * `replayFight`, marks the answer by rebuilding the question, keeps the round, and when the fight is over pays out
 * (gold, followers, experience, knocked-out members) in the same save that closes the fight, so it can only pay once.
 * While a fight is open nothing else about the clan can change (that is what keeps the replay honest), and the night's
 * rest waits until the fight is over. Every new fight is a ladder fight (when the child's maths can be read): it keeps the questions the
 * server made from the child's maths focus, and `cryCheck` marks each Battle Cry answer as it is given (battleCry.ts).
 * "My Village" gives every clan its own buildings (`upgrade`, paid from the purse). A save from before My Village is converted by
 * `upgradeSave` when it loads. A Village Raid on a classmate (raids.ts) is `raidStart` (the siege) and then an open fight played
 * with `cryCheck` and `fightRound` like a mine fight; when it ends, the raided clan's reward (if it held) is saved in the same
 * transaction. Raids never take anything from anyone.
 */
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalSettings } from '../maths/practical';
import { makeRunQuestions, markQuestion, publicQuestion, sameAnswer, seededRandom, type MathsContext, type PublicQuestion } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import { cryAsked, factKey, replayFight, type CryAnswer, type CryMark, type RecordedRound } from './battleCry';
import { CONFIG } from './config';
import { dayReset } from './character';
import { clanFromChoices, type Draft } from './create';
import { empireNewDay, empireOf, needsUpgrade, PUSHES, syncVillage, upgrade, upgradeSave, type BattleResult, type Push } from './empire';
import { bossAt, newFight, type FightState, type Order } from './fight';
import { buySupply, monsterOf, monsterSave, newMonsterFight, playSiege, SUPPLY_KINDS, type MonsterSetup, type Siege, type SupplyKind } from './monster';
import { classByName, raceByName, refreshGear, rollMember } from './character';
import { renameCheck, slotSeed } from './create';
import { ITEMS } from './gamedata';
import { isLook, setLook, type Look } from './looks';
import { earnedOrNone, recordBossWin, type Earned } from './rewards';
import { buyItem, buyTroopMix, fightSeed, payFight, raidSeed, sendArmyTo, trainMember, TRAIN_KEYS, wakeEveryone, wakeOne, type FightSummary, type TrainKey } from './play';
import { newSeasonSave, type SeasonClock } from './season';
import { finishQuest, todaysQuest, type QuestPrize } from './quests';
import { TROOP_KINDS, VILLAGE_BUILDINGS, type Banners, type Clan, type Held, type MonsterKind, type Troops, type Village, type VillageBuilding } from './types';
import { addBanners, bannerBoard, clanPower, defenderCopy, heldReward, lightOf, newRaidFight, raidNews, raidNote, raidReward, raidSiege, raidsLeft, rivalList, sketchPower, targetEmpire, type BoardRow, type Light, type RaidSetup, type RaidTarget, type Rival, type RivalSketch } from './raids';
import { weekOf } from './village';


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
  /** Started past the normal fights of an unlimited day: it earns no wins, so no hub points (fame and achievement counts too). */
  extra?: true;
  /**
   * A ladder fight's Battle Cry questions, one a round, made by the server from the child's maths when the fight began.
   * The server keeps the whole questions; the browser is only given what to show (`publicQuestion`). Missing: an old-style fight.
   */
  questions?: Q[];
  /** A ladder fight's marks, by round (index 0 is round 1): set by `cryCheck`, so each question is answered once. */
  marks?: (CryMark | null)[];
  /** A monster try (not a mine fight): how it was set up and how the siege went. `depth` and `boss` are then unused. */
  monster?: { setup: MonsterSetup; siege: Siege };
  /** A Village Raid on a classmate (not a mine fight): the defenders and how the siege went. `depth` and `boss` are then unused. */
  raid?: RaidSetup;
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
  /** The mine fight in progress, if any. */
  fight?: OpenFight | null;
  /**
   * Ladder questions asked for the shop discount, the quest or the siege (`ask`), kept until they are answered.
   * The browser is only given what to show. Missing or null: none waiting.
   */
  ask?: Asked | null;
  /** How many `ask`s the clan has had, so each one's questions (and their records) are different. */
  askNo?: number;
}

/** What ladder questions can be asked for, outside fights. */
export const ASK_FOR = ['shop', 'quest', 'siege', 'raid', 'duel'] as const;
export type AskFor = (typeof ASK_FOR)[number];
/** How many questions each one asks: the quest asks two (both right wins the big prize). */
export const ASK_COUNT: Record<AskFor, number> = { shop: 1, quest: 2, siege: 1, raid: 1, duel: 1 };

/** Questions waiting for an answer. `no` makes the answers' record id (`clans:ask:<seed>:<no>`). */
export interface Asked<Q = Question> {
  for: AskFor;
  no: number;
  questions: Q[];
  /** Marks so far, by slot (set by `askCheck`, so each question is answered once). */
  marks?: (CryMark | null)[];
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
  /** The teacher's "Unlimited turns today" switch: mine fights past the daily limit are allowed (but earn no hub points). */
  unlimitedToday?: boolean;
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
  /** The other clans in the class, for the list of who can be raided and the Banners board. */
  mates?: RivalSketch[];
  /** The clan a Village Raid is aimed at, loaded by the server (null if it is not in this class). */
  target?: RaidTarget | null;
  /** The season clock from the database. Missing or null: no season rules (stamping, resets and resting raids all wait for it). */
  clock?: SeasonClock | null;
}

export type Action =
  | { type: 'load' }
  | { type: 'create'; name: string; drafts: Draft[] }
  /** `answer` is the answer to the 10% discount question (null or missing: not asked, or "No thanks"). The server marks it. */
  | { type: 'buy'; member: number; item: string; answer?: number | null; ms?: number }
  /** Ladder questions for the shop discount, the quest or the siege, made and kept by the server (asking again gives the same ones). */
  | { type: 'ask'; for: AskFor }
  /** Mark one waiting `ask` question now (so the question box can say right or wrong). `ms`: how long it took. */
  | { type: 'askCheck'; slot: number; answer: number; ms: number }
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
  /** `answers`: the quest's two ladder questions, in order (null: not answered). */
  | { type: 'quest'; choice: number; answers: (number | null)[]; ms?: number }
  /** `ladder`: this browser can show ladder questions (an older one that is still open does not say so, and gets an old-style fight). */
  | { type: 'fightStart'; depth: number; boss: boolean; ladder?: boolean }
  /** A ladder fight's Battle Cry answer for the round about to be played, marked by the server. `ms`: how long it took. */
  | { type: 'cryCheck'; round: number; answer: number; ms: number }
  | { type: 'fightRound'; round: number; orders: (Order | undefined)[]; cry: CryAnswer | null }
  | { type: 'raidTargets' }
  /** A Village Raid: the siege (with the answer to the `ask` for 'raid' question, kept by the server), then the fight opens. */
  | { type: 'raidStart'; target: string }
  /** Monster week: today's try. `siege` is the answer to the siege's question (null: "No thanks"). Then rounds go through `fightRound`. */
  | { type: 'monsterStart'; siege: number | null; ladder?: boolean; ms?: number }
  /** Monster supplies, from day `warnFrom` of the season. */
  | { type: 'buySupply'; kind: SupplyKind; count: number }
  /** A new season: pick a member's race and class again (only before the clan has played the season), or keep them all. */
  | { type: 'repick'; member: number; race: string; cls: string }
  | { type: 'repickDone' }
  | { type: 'rename'; member: number; name: string };

export type ActionType = Action['type'];

export type Result =
  | { type: Exclude<ActionType, 'ask' | 'askCheck' | 'buy' | 'upgrade' | 'raid' | 'war' | 'quest' | 'fightStart' | 'cryCheck' | 'fightRound' | 'raidTargets' | 'raidStart' | 'monsterStart'> }
  /** The questions to show (never their answers). */
  | { type: 'ask'; for: AskFor; questions: PublicQuestion[] }
  /** `answer`: the right answer, to show when it was wrong. `given`: the answer that was marked (the first one sent). */
  | { type: 'askCheck'; slot: number; correct: boolean; answer: number; given: number }
  /** `discount`: the 10% question was answered right. `answer`: the right answer, to show when it was wrong. */
  | { type: 'buy'; discount: boolean; answer?: number }
  | { type: 'upgrade'; building: VillageBuilding; level: number }
  | { type: 'raid' | 'war'; friendly: boolean; result: BattleResult; gold: number; earned?: Earned }
  /** `right`: both questions right (null: the choice had none). `marks`: each question's mark and right answer. */
  | { type: 'quest'; questId: number; text: string; right: boolean | null; prize: QuestPrize; marks?: { correct: boolean; answer: number }[] }
  /** `resumed`: a fight was already open, so this is it again and no fight was used. */
  | { type: 'fightStart'; resumed: boolean }
  /** `answer`: the right answer, to show when it was wrong. `given`: the answer that was marked (the first one sent for this question). */
  | { type: 'cryCheck'; round: number; correct: boolean; answer: number; given: number }
  /** `summary` is there when the round ended the fight and it has been paid. `monster`: a finished monster try (`first`: this season's first win). */
  | { type: 'fightRound'; round: number; over: boolean; summary: FightSummary | null; earned?: Earned; monster?: MonsterOutcome; raid?: RaidOutcome }
  /** `right`: the siege question's mark (null if there was none or it was skipped); `answer`: the right answer, to show. */
  | { type: 'monsterStart'; resumed: boolean; right: boolean | null; answer: number | null }
  /** Who can be raided (closest first), this week's Banners board and the raids left today. */
  | { type: 'raidTargets'; targets: Rival[]; board: BoardRow[]; left: number }
  /** `breach`/`tower`: how the siege went. `right`: the siege question's mark (null: none or skipped). */
  | { type: 'raidStart'; resumed: boolean; right: boolean | null; breach: number; tower: number };

/** How a Village Raid ended: what the raiders got (the raided village's reward is not shown to them). */
export interface RaidOutcome {
  name: string;
  light: Light;
  won: boolean;
  gold: number;
  banners: number;
}

/** How a monster try ended, kept in the saved result: the database gives the rewards for a first win (once a season) and counts tries. */
export interface MonsterOutcome {
  kind: MonsterKind;
  season: number;
  won: boolean;
  first: boolean;
  tries: number;
  /** The share of the monster's strength (HP) left at the end, 0 to 1 (0 when it was beaten). Missing on older saves. */
  left?: number;
}

/** The most rounds any fight can have (a monster fight is longer than a mine fight). */
const MOST_ROUNDS = Math.max(CONFIG.maxRounds, CONFIG.monster.rounds);

/** Is it monster week (the clock is on, the season is set and it is day `monsterFrom` or later)? */
export const monsterWeek = (clock: SeasonClock | null | undefined): clock is SeasonClock =>
  !!clock && clock.clockOn && clock.number > 0 && clock.day >= CONFIG.season.monsterFrom;

/** Are monster supplies on sale (the clock is on and it is day `warnFrom` or later)? */
export const suppliesOnSale = (clock: SeasonClock | null | undefined): clock is SeasonClock =>
  !!clock && clock.clockOn && clock.number > 0 && clock.day >= CONFIG.season.warnFrom;

/** The fight an open fight starts from: a mine fight, a monster try's clan fight, or a Village Raid's hero fight. */
export function fightOf(members: Clan['members'], open: Pick<OpenFight<unknown>, 'depth' | 'seed' | 'boss' | 'monster' | 'raid'>): FightState {
  if (open.raid) return newRaidFight(members, open.raid, open.seed);
  return open.monster ? newMonsterFight(members, open.monster.setup, open.seed) : newFight(members, open.depth, open.seed, open.boss);
}

/** The seed for a monster try: from the clan's seed, the season and the try number. */
export const monsterSeed = (baseSeed: number, season: number, tryNo: number) => Math.imul(baseSeed | 0, 0x3c6ef372) ^ Math.imul(season * 64 + tryNo + 1, 0x1b873593);

/** What else the server must do in the same save as a changed clan. Nothing in here is sent to the browser. */
export interface Effects {
  /** A finished Village Raid: what the raided clan gets (gold if it held, its Banners and held count) and the lines to write. */
  villageRaid?: { targetId: string; gold: number; banners: Banners; held: Held; news: string; note: string };
  /** Maths answers to keep in the teacher's private records: the question's kind and year band (never the numbers), and whether it was right. */
  answers?: { key: string; correct: boolean }[];
  /** Ladder answers, for the child's own maths records (ladder place, skill map, focus results). `once` makes a resend count once. */
  ladder?: { once: string; answers: { key: string; correct: boolean; ms: number; given?: number }[] };
}

export type Applied =
  /** `newSeason`: this request began a new season (the save was reset first), so the browser can say so. */
  | { ok: true; state: ServerState | null; result: Result; changed: boolean; effects?: Effects; newSeason?: true }
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

const ORDER_ACTIONS = ['attack', 'spell', 'guard', 'run', 'skip', 'potion'];

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
    case 'potion': {
      const target = int(v.target, 0, CONFIG.maxMembers - 1);
      return target === null ? null : { action: 'potion', target };
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

/** An answer: a number, null (not answered), or undefined if it is not one. */
const parseAnswer = (v: unknown): number | null | undefined =>
  v === null || v === undefined ? null : typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1_000_000_000 ? v : undefined;
/** How long an answer took, in ms (0 if it was not sent). */
const parseMs = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), 3_600_000) : 0);

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
    case 'buy': {
      const answer = parseAnswer(raw.answer);
      return member !== null && typeof raw.item === 'string' && answer !== undefined ? { type: 'buy', member, item: raw.item, answer, ms: parseMs(raw.ms) } : null;
    }
    case 'askCheck': {
      const slot = int(raw.slot, 0, 5);
      const answer = parseAnswer(raw.answer);
      return slot === null || answer === null || answer === undefined ? null : { type: 'askCheck', slot, answer, ms: parseMs(raw.ms) };
    }
    case 'ask': return typeof raw.for === 'string' && ASK_FOR.includes(raw.for as AskFor) ? { type: 'ask', for: raw.for as AskFor } : null;
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
      if (choice === null) return null;
      // An older page sends one `answer`; it is read as the first of the two.
      const list: unknown[] = Array.isArray(raw.answers) ? raw.answers.slice(0, ASK_COUNT.quest) : raw.answer === undefined ? [] : [raw.answer];
      const answers = list.map(parseAnswer);
      return answers.every((a) => a !== undefined) ? { type: 'quest', choice, answers: answers as (number | null)[], ms: parseMs(raw.ms) } : null;
    }
    case 'fightStart': {
      const depth = int(raw.depth, 0, CONFIG.maxLevel);
      if (depth === null || typeof raw.boss !== 'boolean') return null;
      return raw.ladder === true ? { type: 'fightStart', depth, boss: raw.boss, ladder: true } : { type: 'fightStart', depth, boss: raw.boss };
    }
    case 'cryCheck': {
      const round = int(raw.round, 1, MOST_ROUNDS);
      const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
      if (round === null || !ok(raw.answer) || Math.abs(raw.answer) > 1_000_000_000 || !ok(raw.ms) || raw.ms < 0) return null;
      return { type: 'cryCheck', round, answer: raw.answer, ms: Math.min(Math.round(raw.ms), 3_600_000) };
    }
    case 'fightRound': {
      const round = int(raw.round, 1, MOST_ROUNDS);
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
    case 'monsterStart': {
      const siege = raw.siege === null || raw.siege === undefined ? null : typeof raw.siege === 'number' && Number.isFinite(raw.siege) && Math.abs(raw.siege) <= 1_000_000_000 ? raw.siege : undefined;
      if (siege === undefined) return null;
      return { type: 'monsterStart', siege, ms: parseMs(raw.ms), ...(raw.ladder === true ? { ladder: true } : {}) };
    }
    case 'buySupply': {
      const count = int(raw.count, 1, 10);
      return count !== null && typeof raw.kind === 'string' && SUPPLY_KINDS.includes(raw.kind as SupplyKind) ? { type: 'buySupply', kind: raw.kind as SupplyKind, count } : null;
    }
    case 'repick':
      return member !== null && typeof raw.race === 'string' && raw.race.length <= 40 && typeof raw.cls === 'string' && raw.cls.length <= 40 ? { type: 'repick', member, race: raw.race, cls: raw.cls } : null;
    case 'repickDone': return { type: 'repickDone' };
    case 'rename': return member !== null && typeof raw.name === 'string' && raw.name.length <= 40 ? { type: 'rename', member, name: raw.name } : null;
    case 'raidStart': return typeof raw.target === 'string' && raw.target.length >= 1 && raw.target.length <= 40 ? { type: 'raidStart', target: raw.target } : null;
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
 * a week gets one night's rest and moves to today's number (the days it skipped still save their builds). Returns true if anything changed.
 */
export function catchUp(state: ServerState, today: number, fightsPerDay: number = CONFIG.fightsPerDay): boolean {
  const day = clanDay(state.createdNzDay, today);
  if (day <= state.day) return false;
  dayReset(state.clan);
  empireNewDay(state.clan, Math.max(0, day - state.day - 1));
  empireOf(state.clan).day = day;
  state.fightsLeft = fightsPerDay;
  state.day = day;
  return true;
}

// ---------------------------------------------------------------------------
// Doing an action
// ---------------------------------------------------------------------------

/**
 * Mark the answers to the questions kept by `ask` for `kind`, once: the questions are taken off the clan whatever the answers.
 * Null if none were waiting for it. Answers left out (null, "No thanks") are not marked or recorded.
 */
function takeAnswers(state: ServerState, kind: AskFor, given: (number | null)[], ms: number): { marks: { correct: boolean; answer: number }[]; effects?: Effects } | null {
  const asked = state.ask;
  if (!asked || asked.for !== kind) return null;
  state.ask = null;
  const marks: { correct: boolean; answer: number }[] = [];
  const answers: { key: string; correct: boolean; ms: number; given?: number }[] = [];
  asked.questions.forEach((q, i) => {
    const m = markQuestion(q);
    if (!m) return;
    // Marked already by `askCheck` (and recorded then): that mark stands, whatever is sent now.
    const before = asked.marks?.[i];
    if (before) return void marks.push({ correct: before.correct, answer: m.answer });
    const g = given[i];
    const correct = g !== null && g !== undefined && sameAnswer(g, m.answer);
    marks.push({ correct, answer: m.answer });
    // The pupil's answer goes with it, so a teacher can see "Often answers 54".
    if (g !== null && g !== undefined) answers.push({ key: m.key, correct, ms, given: g });
  });
  return { marks, ...(answers.length ? { effects: { ladder: { once: `clans:ask:${state.seed}:${asked.no}`, answers } } } : {}) };
}

const done = (state: ServerState, result: Result, changed = true, effects?: Effects): Applied => ({ ok: true, state, result, changed, ...(effects ? { effects } : {}) });

/**
 * Apply one action to the saved clan (null if the student has none yet). Works on a copy: the state that
 * comes in is never changed, so a refusal leaves everything as it was.
 */
export function applyAction(saved: ServerState | null, action: Action, ctx: Context): Applied {
  const flags = { newSeason: false };
  const out = applyInner(saved, action, ctx, flags);
  return out.ok && flags.newSeason ? { ...out, newSeason: true } : out;
}

function applyInner(saved: ServerState | null, action: Action, ctx: Context, flags: { newSeason: boolean }): Applied {
  const settings = ctx.settings ?? DEFAULT_PRACTICAL_SETTINGS;

  if (action.type === 'create') {
    if (saved) return refuse('exists', 'You already have a clan.');
    const made = clanFromChoices(ctx.seed, action.name, action.drafts, ctx.typedNames === true);
    if (!made.ok) return refuse('create', made.say);
    const state: ServerState = { clan: made.clan, seed: ctx.seed, day: 1, createdNzDay: ctx.today, fightsLeft: ctx.fightsPerDay ?? CONFIG.fightsPerDay, fightNo: 0, raidNo: 0 };
    return done(state, { type: 'create' });
  }
  if (!saved) {
    return action.type === 'load' ? { ok: true, state: null, result: { type: 'load' }, changed: false } : refuse('no-clan', 'Make a clan first.');
  }

  let state = structuredClone(saved);
  // A save from before My Village is converted once, here (the class village's levels come from the server).
  let upgraded = needsUpgrade(state.clan);
  if (upgraded) state.clan = upgradeSave(state.clan, ctx.groupVillage ?? null);
  // Gear from before the class lines, or from a class a member no longer is, moves onto their own class's line.
  if (refreshGear(state.clan)) upgraded = true;
  // The night's rest waits until a fight in progress is over: it would heal the members the fight is being replayed with.
  let rested = state.fight ? false : catchUp(state, ctx.today, ctx.fightsPerDay);
  // The season: a save with no season yet is stamped with the current one (no reset); one from an earlier season starts again, but never in the middle of a fight.
  const clock = ctx.clock;
  if (clock && clock.number > 0) {
    if (state.clan.season === undefined) {
      state.clan.season = clock.number;
      rested = true;
    } else if (clock.clockOn && state.clan.season < clock.number && !state.fight) {
      state = newSeasonSave(state, clock.number);
      flags.newSeason = true;
      rested = true;
    }
  }
  if (state.fight && action.type !== 'load' && action.type !== 'fightStart' && action.type !== 'monsterStart' && action.type !== 'cryCheck' && action.type !== 'fightRound' && action.type !== 'raidTargets' && action.type !== 'raidStart') {
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
      if (!item) return refuse('item', 'The shop does not have that.');
      // The 10% discount: the ladder question kept by `ask`, marked here once. No question asked (or "No thanks"): full price.
      const marked = takeAnswers(state, 'shop', [action.answer ?? null], action.ms ?? 0);
      const discount = marked?.marks[0]?.correct === true;
      const bought = buyItem(clan, action.member, item, discount);
      if (!bought.ok) return refuse(bought.why ?? 'no', bought.say ?? 'That cannot be done right now.');
      return done(state, { type: 'buy', discount, ...(marked?.marks[0] ? { answer: marked.marks[0].answer } : {}) }, true, marked?.effects);
    }
    case 'ask': {
      if (!ctx.maths) return refuse('no-maths', "We couldn't get your maths questions just now.");
      const waiting = state.ask;
      // A live duel asks one question a round: once its question is answered, the next ask is a new one (duelServer.ts).
      const spent = action.for === 'duel' && !!waiting?.marks?.[0];
      if (waiting && waiting.for === action.for && !spent) return done(state, { type: 'ask', for: action.for, questions: waiting.questions.map((q, i) => publicQuestion(q, i)) }, rested || upgraded);
      const no = (state.askNo ?? 0) + 1;
      const questions = makeRunQuestions(ctx.maths, ASK_COUNT[action.for], seededRandom(`clans:ask:${state.seed}:${no}`));
      if (questions.length === 0) return refuse('no-maths', "We couldn't get your maths questions just now.");
      state.ask = { for: action.for, no, questions };
      state.askNo = no;
      return done(state, { type: 'ask', for: action.for, questions: questions.map((q, i) => publicQuestion(q, i)) });
    }
    case 'askCheck': {
      const asked = state.ask;
      const marked = asked ? markQuestion(asked.questions[action.slot]) : null;
      if (!asked || !marked) return refuse('no-question', 'There is no question to answer.');
      const before = asked.marks?.[action.slot];
      if (before) return done(state, { type: 'askCheck', slot: action.slot, correct: before.correct, answer: marked.answer, given: before.answer }, false);
      const correct = sameAnswer(action.answer, marked.answer);
      const marks = asked.marks ?? [];
      while (marks.length < action.slot) marks.push(null);
      marks[action.slot] = { answer: action.answer, correct };
      asked.marks = marks;
      return done(state, { type: 'askCheck', slot: action.slot, correct, answer: marked.answer, given: action.answer }, true, {
        ladder: { once: `clans:ask:${state.seed}:${asked.no}:${action.slot}`, answers: [{ key: marked.key, correct, ms: action.ms, given: action.answer }] },
      });
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
      // A choice with a puzzle asks the two ladder questions kept by `ask`: both right wins the big prize, otherwise the small one.
      const puzzle = !!q.choices[action.choice].puzzle;
      const marked = puzzle ? takeAnswers(state, 'quest', action.answers, action.ms ?? 0) : null;
      const right = puzzle ? (marked?.marks.length === ASK_COUNT.quest && marked.marks.every((m) => m.correct)) : null;
      const finished = finishQuest(clan, state.day, q, action.choice, right);
      if (!finished.ok) return refuse('quest', finished.say);
      return done(state, { type: 'quest', questId: q.id, text: finished.text, right: finished.right, prize: finished.prize, ...(marked ? { marks: marked.marks } : {}) }, true, marked?.effects);
    }
    case 'raidTargets': {
      const e = empireOf(clan);
      const mates = ctx.mates ?? [];
      return done(state, { type: 'raidTargets', targets: rivalList(clan, e.raidedToday, mates), board: bannerBoard(clan, weekOf(ctx.today), mates), left: raidsLeft(e) }, rested || upgraded);
    }
    case 'raidStart': {
      // A raid is already open (a refresh, or another Chromebook): this is that raid again, and nothing more is used.
      if (state.fight) {
        return state.fight.raid && state.fight.raid.target === action.target
          ? done(state, { type: 'raidStart', resumed: true, right: state.fight.raid.right, breach: state.fight.raid.breach, tower: state.fight.raid.tower }, false)
          : refuse('fight-open', 'You are in the middle of a fight. Finish it first!');
      }
      if (!ctx.raidsOn) return refuse('off', 'Your teacher has switched Village Raids off.');
      const target = ctx.target;
      if (!target || target.id === ctx.self) return refuse('target', "That clan can't be raided right now.");
      const e = empireOf(clan);
      if (raidsLeft(e) <= 0) return refuse('limit', `That's all ${CONFIG.classRaids.perDay} raids for today. Come back tomorrow!`);
      if (e.raidedToday.includes(target.id)) return refuse('same', 'You already raided that clan today. Pick another one!');
      if (target.members.length === 0) return refuse('target', 'That clan has no heroes yet.');
      const theirs = targetEmpire(target);
      const asked = takeAnswers(state, 'raid', [], 0);
      const mark = asked?.marks[0];
      const right = asked ? mark?.correct === true : null;
      const seed = raidSeed(state.seed, state.raidNo);
      const siege = raidSiege(e, theirs, right, seed);
      const sketch: RivalSketch = { id: target.id, name: target.name, heroLevels: target.members.reduce((t, m) => t + m.level, 0), levels: theirs.levels, troops: theirs.troops };
      const setup: RaidSetup = {
        target: target.id, name: target.name, light: lightOf(Math.max(1, clanPower(clan)), sketchPower(sketch)),
        defenders: target.members.map(defenderCopy), breach: siege.breach, tower: siege.tower, right,
      };
      state.fight = { depth: 0, boss: false, seed, no: state.fightNo + 1, settings, rounds: [], raid: setup };
      if (ctx.maths) {
        state.fight.questions = makeRunQuestions(ctx.maths, CONFIG.maxRounds, seededRandom(`clans:raid:${seed}:${state.fightNo + 1}`));
        state.fight.marks = [];
      }
      state.fightNo++;
      state.raidNo++;
      // The raid counts from now (even if the page is closed).
      e.raidsToday++;
      e.raidedToday.push(target.id);
      return done(state, { type: 'raidStart', resumed: false, right, breach: siege.breach, tower: siege.tower }, true, asked?.effects);
    }
    case 'monsterStart': {
      if (state.fight) {
        if (!state.fight.monster) return refuse('fight-open', 'You are in the middle of a fight. Finish it first!');
        return done(state, { type: 'monsterStart', resumed: true, right: state.fight.monster.siege.right, answer: null }, false);
      }
      if (!monsterWeek(clock)) return refuse('not-yet', 'The monster has not come yet. It arrives in the last week of the season.');
      const season = clock.number;
      const save = monsterSave(clan, season);
      if (save.lastDay === ctx.today) return refuse('tried-today', 'You have had your try today. Come back tomorrow!');
      if (!clan.members.some((m) => !m.knockedOut)) return refuse('resting', 'Everyone is resting. They wake up tomorrow.');
      const seed = monsterSeed(state.seed, season, save.tries);
      // The siege's question: the ladder question kept by `ask` (none asked: no help from the maths).
      const asked = takeAnswers(state, 'siege', [action.siege], action.ms ?? 0);
      const mark = asked?.marks[0];
      const marked = { right: asked ? mark?.correct === true : null, answer: mark ? mark.answer : null };
      const arrows = save.supplies.arrows;
      const siege = playSiege(clan, arrows, marked.right, seed);
      const setup: MonsterSetup = {
        kind: monsterOf(season), losses: save.wonDay === undefined ? save.losses : 0, siege: siege.share,
        potions: save.supplies.potions, net: save.supplies.net > 0, walls: empireOf(clan).levels.walls,
      };
      state.fight = { depth: CONFIG.monster.depth, boss: false, seed, no: state.fightNo + 1, settings, rounds: [], monster: { setup, siege } };
      if (ctx.maths) {
        state.fight.questions = makeRunQuestions(ctx.maths, CONFIG.monster.rounds, seededRandom(`clans:monster:${seed}:${state.fightNo + 1}`));
        state.fight.marks = [];
      }
      state.fightNo++;
      // Fire arrows are shot in the siege; the try counts from now (one a day, even if the page is closed).
      clan.monster = { ...save, tries: save.tries + 1, lastDay: ctx.today, supplies: { ...save.supplies, arrows: 0 } };
      return done(state, { type: 'monsterStart', resumed: false, right: marked.right, answer: marked.answer }, true, asked?.effects);
    }
    case 'buySupply': {
      if (!suppliesOnSale(clock)) return refuse('not-yet', 'Monster supplies are sold in the last two weeks of the season.');
      const out = buySupply(clan, clock.number, action.kind, action.count);
      return out.ok ? done(state, { type: 'buySupply' }) : refuse(out.why, out.say);
    }
    case 'repick': {
      if (clan.repick === undefined || clan.repick !== clan.season) return refuse('repick', 'Your clan is already on its way this season.');
      const m = clan.members[action.member];
      if (!m) return refuse('member', 'Pick one of your clan.');
      if (m.level !== 1 || m.xp !== 0) return refuse('repick', `${m.name} has already started this season.`);
      if (!raceByName(action.race) || !classByName(action.cls)) return refuse('choice', 'Pick a race and a class from the lists.');
      const fresh = rollMember({ rng: Math.imul(slotSeed(state.seed, action.member) | 0, 2654435761) + (clan.season ?? 0) * 7919 }, m.name, action.race, action.cls, action.member === 0);
      clan.members[action.member] = { ...fresh, ...(m.look ? { look: m.look } : {}) };
      return done(state, { type: 'repick' });
    }
    case 'rename': {
      // Only on the new-season screen, before "Keep going". A name changes nothing else, so started members may be renamed too.
      if (clan.repick === undefined || clan.repick !== clan.season) return refuse('rename', 'Names can be changed at the start of a season.');
      const named = renameCheck(clan, action.member, action.name, ctx.typedNames === true);
      if (!named.ok) return refuse('name', named.say);
      clan.members[action.member] = { ...clan.members[action.member], name: named.name };
      return done(state, { type: 'rename' });
    }
    case 'repickDone': {
      if (clan.repick === undefined) return done(state, { type: 'repickDone' }, rested || upgraded);
      delete clan.repick;
      return done(state, { type: 'repickDone' });
    }
    case 'fightStart': {
      // A fight is already open (a refresh, or another Chromebook): this is that fight again, and nothing more is used.
      if (state.fight) return state.fight.monster ? refuse('fight-open', 'You are in the middle of the monster fight. Finish it first!') : done(state, { type: 'fightStart', resumed: true }, false);
      const extra = state.fightsLeft <= 0 && ctx.unlimitedToday === true;
      if (state.fightsLeft <= 0 && !extra) return refuse('fights', "That's all the fights for today. Come back tomorrow!");
      if (!clan.members.some((m) => !m.knockedOut)) return refuse('resting', 'Everyone is resting. They wake up tomorrow.');
      if (action.boss && !bossAt(action.depth)) return refuse('boss', 'There is no boss at that depth.');
      const seed = fightSeed(state.seed, state.fightNo);
      if (newFight(clan.members, action.depth, seed, action.boss).result) return refuse('resting', 'Everyone is resting. They wake up tomorrow.');
      state.fight = { depth: action.depth, boss: action.boss, seed, no: state.fightNo + 1, settings, rounds: [], ...(extra ? { extra: true as const } : {}) };
      // A ladder fight: the questions come from the child's own maths, made now from the fight's seed and kept with it.
      // Without the child's maths (it couldn't be loaded) the fight is an old-style one, so the fight still goes ahead.
      if (ctx.maths) {
        state.fight.questions = makeRunQuestions(ctx.maths, CONFIG.maxRounds, seededRandom(`clans:${seed}:${state.fightNo + 1}`));
        state.fight.marks = [];
      }
      if (!extra) state.fightsLeft--;
      state.fightNo++;
      return done(state, { type: 'fightStart', resumed: false });
    }
    case 'cryCheck': {
      const open = state.fight;
      if (!open) return refuse('no-fight', 'That fight is already over.');
      if (!open.questions || !open.marks) return refuse('no-question', 'There is no question to answer.');
      if (action.round !== open.rounds.length + 1) return refuse('stale-round', 'That round was already played.');
      if (!cryAsked(open, action.round)) return refuse('no-question', 'There is no question to answer.');
      // Each question is answered once: asking again gives the first mark back, and nothing changes.
      const marked = markQuestion(open.questions[action.round - 1]);
      if (!marked) return refuse('no-question', 'There is no question to answer.');
      const before = open.marks[action.round - 1];
      if (before) return done(state, { type: 'cryCheck', round: action.round, correct: before.correct, answer: marked.answer, given: before.answer }, false);
      const correct = sameAnswer(action.answer, marked.answer);
      while (open.marks.length < action.round - 1) open.marks.push(null);
      open.marks[action.round - 1] = { answer: action.answer, correct };
      return done(state, { type: 'cryCheck', round: action.round, correct, answer: marked.answer, given: action.answer }, true, {
        ladder: { once: `clans:${open.seed}:${open.no}:${action.round}`, answers: [{ key: marked.key, correct, ms: action.ms, given: action.answer }] },
      });
    }
    case 'fightRound': {
      const open = state.fight;
      if (!open) return refuse('no-fight', 'That fight is already over.');
      if (action.round !== open.rounds.length + 1) return refuse('stale-round', 'That round was already played.');
      const played: RecordedRound = { orders: action.orders, cry: action.cry };
      const { state: replayed, cries } = replayFight(clan.members, open.depth, open.seed, open.boss, [...open.rounds, played], open, open.monster || open.raid ? fightOf(clan.members, open) : undefined);
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
      if (open.raid) return finishRaid(state, open.raid, replayed, action.round, rightCry, effects, ctx);
      const boss = open.boss;
      const summary = payFight(clan, replayed);
      state.fight = null;
      const won = summary.result === 'won';
      if (open.monster) {
        // A monster try: supplies used come off, a loss makes the monster more tired, the first win is kept (the database rewards it once).
        const season = clan.season ?? clock?.number ?? 0;
        const save = monsterSave(clan, season);
        const potionsUsed = open.monster.setup.potions - (replayed.monster?.potions ?? open.monster.setup.potions);
        const netUsed = open.monster.setup.net && replayed.monster?.net === false ? 1 : 0;
        const first = won && save.wonDay === undefined;
        clan.monster = {
          ...save,
          losses: won || save.wonDay !== undefined ? save.losses : save.losses + 1,
          ...(first ? { wonDay: clock?.day ?? 0 } : {}),
          supplies: { ...save.supplies, potions: Math.max(0, save.supplies.potions - potionsUsed), net: Math.max(0, save.supplies.net - netUsed) },
        };
        const foe = replayed.enemies[0];
        const left = won || !foe ? 0 : Math.round((Math.max(0, foe.hp) / Math.max(1, foe.maxHp)) * 100) / 100;
        const monster: MonsterOutcome = { kind: open.monster.setup.kind, season, won, first, tries: clan.monster.tries, left };
        return done(state, { type: 'fightRound', round: action.round, over: true, summary, monster, ...earnedPart(earnedOrNone({ cries: rightCry })) }, true, effects);
      }
      // An extra fight earns no wins or bosses (the database turns those into fame and hub points); Battle Cries still count.
      // The same boss beaten again this season earns less fame each time (CONFIG.rewards.bossFameEachTime).
      const bossWon = won && boss && !open.extra;
      const bossFame = bossWon ? recordBossWin(clan, open.depth, clan.season ?? clock?.number ?? 0) : 0;
      const earned = earnedOrNone({ wins: won && !boss && !open.extra ? 1 : 0, bosses: bossWon ? 1 : 0, ...(bossWon ? { bossFame } : {}), cries: rightCry });
      return done(state, { type: 'fightRound', round: action.round, over: true, summary, ...earnedPart(earned) }, true, effects);
    }
  }
}

/**
 * A Village Raid's last round: nobody's heroes, gold, troops or buildings change. The raiders are paid (more for a win), and
 * the raided clan (loaded again for this request) is paid when it held; both are saved together (`Effects.villageRaid`).
 */
function finishRaid(state: ServerState, raid: RaidSetup, fight: FightState, round: number, rightCry: number, effects: Effects | undefined, ctx: Context): Applied {
  const clan = state.clan;
  const e = empireOf(clan);
  const won = fight.result === 'won';
  const week = weekOf(ctx.today);
  const pay = raidReward(fight.result, raid.light, e);
  clan.gold += pay.gold;
  e.banners = addBanners(e.banners, week, pay.banners);
  state.fight = null;
  const summary: FightSummary = { result: fight.result, gold: pay.gold, followers: 0, xp: clan.members.map(() => 0), levels: clan.members.map(() => 0) };
  const outcome: RaidOutcome = { name: raid.name, light: raid.light, won, gold: pay.gold, banners: pay.banners };
  const result: Result = { type: 'fightRound', round, over: true, summary, raid: outcome, ...earnedPart(earnedOrNone({ classRaids: won ? 1 : 0, cries: rightCry })) };
  // The raided clan, as it is now. It may have left the class since the raid began: then only the raiders are paid.
  const target = ctx.target && ctx.target.id === raid.target ? ctx.target : null;
  if (!target) return done(state, result, true, effects);
  const theirs = targetEmpire(target);
  const held = won ? { gold: 0, banners: addBanners(theirs.banners, week, 0), held: theirs.held ?? { nzDay: ctx.today, paid: 0 } } : heldReward(theirs, ctx.today);
  return done(state, result, true, {
    ...(effects ?? {}),
    villageRaid: { targetId: target.id, gold: held.gold, banners: held.banners, held: held.held, news: raidNews(clan.name, target.name, won), note: raidNote(clan.name, won, held.gold) },
  });
}
