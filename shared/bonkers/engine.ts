/**
 * Smash Quest's rules (docs/BONKERS-PLAN.md), as pure functions shared by the server, the preview and the simulator:
 * a pupil's progress, today's two quests, making an adventure, and replaying it from the server's marks. Nothing here
 * reads the clock or a random number of its own: the same inputs always give the same adventure and the same result.
 */
import {
  ADVENTURES_A_DAY, BIG_MONSTER_HITS, HEARTS, MAX_LEVEL, MAX_SAVED_ADVENTURES, MONSTER_HITS, POINTS, SPECIAL, STARS, STARS_TO_TRAINER,
  STICKERS_A_WIN, TRAINER_HEARTS, MONSTER_SWINGS, WRONG_HEARTS, TRAINER_HITS, AUTO_BONKS, AUTO_SHARE, BOOSTS, basePower, expectedGear, FIGHTS,
  QUESTIONS_AN_ADVENTURE,
} from './config';
import { CLASSES, GEAR, LOOKS, SLOTS, TOP_TIER, openZones, shopItem, trainerFor, zoneById, type HeroClass, type Look, type ShopKind, type Slot } from './content';

// ---------------------------------------------------------------- progress

export interface Hero {
  cls: HeroClass;
  look: Look;
}

export interface Stats {
  adventures: number;
  fightsWon: number;
  fightsBonked: number;
  quests: number;
  trainers: number;
  rights: number;
}

export interface Progress {
  hero: Hero | null;
  level: number;
  /** Stars into this level (the bar fills to STARS_TO_TRAINER[level], then the trainer appears). */
  stars: number;
  /** The tier worn in each slot (0: the starting piece). */
  gear: Record<Slot, number>;
  /** Chests opened so far (the next chest's piece follows from this). */
  chests: number;
  stickers: number;
  /** Adventures waiting on `creditDay` (an NZ date), before that day's are added. */
  credits: number;
  creditDay: string | null;
  stats: Stats;
  /** The sticker shop (B.2): what's bought, and the hat and pet worn. Missing on saves from before the shop. */
  owned?: string[];
  hat?: string | null;
  pet?: string | null;
  /** The Monster Book (B.2): times each monster has been smashed, by id. Missing on saves from before the book. */
  book?: Record<string, number>;
}

export const emptyProgress = (): Progress => ({
  hero: null,
  level: 1,
  stars: 0,
  gear: { weapon: 0, shoes: 0, cape: 0, shield: 0 },
  chests: 0,
  stickers: 0,
  credits: 0,
  creditDay: null,
  stats: { adventures: 0, fightsWon: 0, fightsBonked: 0, quests: 0, trainers: 0, rights: 0 },
});

export const isHeroClass = (v: unknown): v is HeroClass => typeof v === 'string' && (CLASSES as readonly string[]).includes(v);
export const isLook = (v: unknown): v is Look => typeof v === 'string' && (LOOKS as readonly string[]).includes(v);

/** Power on every right hit: the level's own plus the gear worn. */
export function heroPower(p: Pick<Progress, 'level' | 'gear'>): number {
  const gear = SLOTS.reduce((sum, slot) => sum + (GEAR.find((g) => g.slot === slot && g.tier === p.gear[slot])?.power ?? 0), 0);
  return basePower(p.level) + gear;
}

export const starsToTrainer = (level: number) => (level >= MAX_LEVEL ? 0 : STARS_TO_TRAINER[level]);
export const trainerReady = (p: Pick<Progress, 'level' | 'stars'>) => p.level < MAX_LEVEL && p.stars >= starsToTrainer(p.level);

/** What the next chest holds: the slots in turn, each one tier better than the last time round. Null: everything is gold. */
export function chestPiece(chests: number): { slot: Slot; tier: number } | null {
  const tier = Math.floor(chests / SLOTS.length) + 1;
  if (tier > TOP_TIER) return null;
  return { slot: SLOTS[chests % SLOTS.length], tier };
}

// ---------------------------------------------------------------- days and adventures waiting

const DAY_MS = 86_400_000;
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
/** Monday to Friday. */
const isSchoolDay = (n: number) => {
  const w = new Date(n * DAY_MS).getUTCDay();
  return w >= 1 && w <= 5;
};

/** School days (Mon to Fri) after `from` up to and including `to`. */
export function schoolDaysBetween(from: string, to: string): number {
  let count = 0;
  for (let n = dayNumber(from) + 1, end = dayNumber(to); n <= end && count <= MAX_SAVED_ADVENTURES; n++) if (isSchoolDay(n)) count++;
  return count;
}

/**
 * Adventures waiting today: one for each school day since they were last counted (today too, if it's a school day),
 * never more than MAX_SAVED_ADVENTURES. A first visit gets one, whatever the day.
 */
export function adventuresWaiting(p: Pick<Progress, 'credits' | 'creditDay'>, today: string): number {
  if (!p.creditDay) return ADVENTURES_A_DAY;
  return Math.min(MAX_SAVED_ADVENTURES, p.credits + schoolDaysBetween(p.creditDay, today));
}

// ---------------------------------------------------------------- quests

export type QuestKind = 'wins' | 'big' | 'hunt';

export interface Quest {
  /** `zone:kind:fights:monster`, e.g. "laundry:hunt:5:0". */
  id: string;
  zone: string;
  kind: QuestKind;
  fights: number;
  /** The monster to hunt (index into the zone's three), for a hunt. */
  monster: number;
}

/** A small, fast, seeded random number maker (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number from any text (FNV-1a), for seeding from a pupil and a day. */
export function hashText(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const questId = (q: Omit<Quest, 'id'>) => `${q.zone}:${q.kind}:${q.fights}:${q.monster}`;

export function parseQuest(id: unknown): Quest | null {
  if (typeof id !== 'string' || id.length > 40) return null;
  const [zone, kind, f, mon] = id.split(':');
  const fights = Number(f);
  const monster = Number(mon);
  if (!zoneById(zone) || !['wins', 'big', 'hunt'].includes(kind)) return null;
  if (!Number.isInteger(fights) || fights < FIGHTS.min || fights > FIGHTS.max || !Number.isInteger(monster) || monster < 0 || monster > 2) return null;
  return { id, zone, kind: kind as QuestKind, fights, monster };
}

/**
 * Today's two quests at the inn for this pupil: two different zones they have opened (the newest one is always offered
 * when there are two or more), each with a kind of quest. The same pupil, day and level always get the same two.
 */
export function questOptions(player: string, today: string, level: number, adventuresToday = 0): [Quest, Quest] {
  const r = seeded(hashText(`${player}|${today}|${adventuresToday}`));
  const zones = openZones(level);
  const newest = zones[zones.length - 1];
  const others = zones.slice(0, -1);
  const first = newest;
  const second = others.length ? others[Math.floor(r() * others.length)] : newest;
  const kinds: QuestKind[] = ['wins', 'big', 'hunt'];
  const make = (zone: string, avoid?: QuestKind): Quest => {
    let kind = kinds[Math.floor(r() * kinds.length)];
    if (kind === avoid) kind = kinds[(kinds.indexOf(kind) + 1) % kinds.length];
    const fights = kind === 'big' ? 4 + Math.floor(r() * 2) : FIGHTS.min + Math.floor(r() * (FIGHTS.max - FIGHTS.min + 1));
    const monster = Math.floor(r() * 3);
    const q = { zone, kind, fights, monster };
    return { ...q, id: questId(q) };
  };
  const a = make(first.id);
  const b = make(second.id, second.id === first.id ? a.kind : undefined);
  return [a, b];
}

/** How many it takes to finish the quest. */
export const questTarget = (q: Quest) => (q.kind === 'wins' ? q.fights - 1 : q.kind === 'big' ? 1 : 3);

// ---------------------------------------------------------------- an adventure

export interface Foe {
  /** The monster's id (or `trainer`). */
  id: string;
  name: string;
  hp: number;
  /** The zone's big monster. */
  big: boolean;
}

/** Before each question: the hero's own bonks, then the question's surprise damage boost. */
export interface Moment {
  autos: number;
  boost: number;
}

export interface Adventure {
  quest: Quest;
  /** One for each question slot (made with the fights, so the server decides them). Missing on the first test adventures. */
  moments?: Moment[];
  /** The hero as they set out (the fights are sized for this). */
  start: { cls: HeroClass; level: number; power: number; stars: number };
  foes: Foe[];
}

/** A monster's health at a level: this many ordinary right hits (`hits`), so better gear makes fights shorter. */
export const foeHp = (level: number, hits: number) => Math.round((basePower(level) + expectedGear(level)) * hits);

/** Makes an adventure: the quest's fights, monsters picked from the seed (a hunt brings its monster 3 times). */
export function makeAdventure(seed: number, quest: Quest, p: Pick<Progress, 'hero' | 'level' | 'gear' | 'stars'>): Adventure {
  const zone = zoneById(quest.zone);
  if (!zone || !p.hero) throw new Error('No such quest.');
  const r = seeded(seed);
  const picks: number[] = [];
  for (let i = 0; i < quest.fights; i++) picks.push(Math.floor(r() * 3));
  if (quest.kind === 'hunt') {
    // The hunted monster comes in fights 1, 3 and 5 (or the last), so the hunt can always be done.
    const spots = [0, 2, Math.min(4, quest.fights - 1)];
    for (const s of spots) picks[s] = quest.monster;
    for (let i = 0; i < picks.length; i++) if (!spots.includes(i) && picks[i] === quest.monster) picks[i] = (quest.monster + 1 + Math.floor(r() * 2)) % 3;
  }
  const foes: Foe[] = picks.map((v) => {
    const mon = zone.monsters[v];
    return { id: mon.id, name: mon.name, hp: foeHp(p.level, MONSTER_HITS[v]), big: false };
  });
  if (quest.kind === 'big') foes[foes.length - 1] = { id: zone.big.id, name: zone.big.name, hp: foeHp(p.level, BIG_MONSTER_HITS), big: true };
  const total = BOOSTS.reduce((t, b) => t + b.weight, 0);
  const moments: Moment[] = Array.from({ length: QUESTIONS_AN_ADVENTURE }, () => {
    const autos = AUTO_BONKS.min + Math.floor(r() * (AUTO_BONKS.max - AUTO_BONKS.min + 1));
    let roll = r() * total;
    const boost = BOOSTS.find((b) => (roll -= b.weight) < 0) ?? BOOSTS[0];
    return { autos, boost: boost.times };
  });
  return { quest, start: { cls: p.hero.cls, level: p.level, power: heroPower(p), stars: p.stars }, foes, moments };
}

/** One answer as the server marked it, and whether the special move was used on it. */
export interface Mark {
  right: boolean;
  special: boolean;
}

export type Outcome = 'won' | 'bonked';

/** What one answer did, for the fight screen. */
export interface Blow {
  slot: number;
  right: boolean;
  special: boolean;
  /** The hero's own bonks before the question popped up. */
  auto: number;
  /** The question's surprise damage boost (×2, ×3 or ×10). */
  boost: number;
  /** Damage to the monster from the answer (0 when wrong). */
  hit: number;
  /** Hearts the monster knocked off while the hero smashed before the question (never the last one). */
  swung: number;
  /** The monster bonked you back (lost a heart). */
  ouch: boolean;
  foeHp: number;
  hearts: number;
  /** The fight ended on this answer. */
  ended: Outcome | null;
}

export interface FightResult {
  foe: Foe;
  trainer: boolean;
  outcome: Outcome;
  questions: number;
  rights: number;
}

export type Phase = 'fight' | 'trainer' | 'done';

export interface Replay {
  phase: Phase;
  /** Index of the fight now (into `foes`; the trainer is the last fight when it's on). */
  fight: number;
  /** The foe now (null when done). */
  foe: Foe | null;
  foeHp: number;
  hearts: number;
  maxHearts: number;
  specialUsed: boolean;
  /** Questions where the monster can't bonk you (Wool Whirlwind). */
  calm: number;
  results: FightResult[];
  blows: Blow[];
  /** The next question's slot. */
  slot: number;
  /** Stars earned so far, and stickers. */
  stars: number;
  stickers: number;
  questDone: boolean;
  /** The trainer was met (only when the bar was full after the fights). */
  trainerMet: boolean;
  trainerWon: boolean;
}

export function trainerFoe(level: number): Foe {
  const t = trainerFor(level);
  return { id: `trainer-${level + 1}`, name: t?.name ?? 'Trainer', hp: foeHp(level, TRAINER_HITS), big: true };
}

function questDone(adv: Adventure, results: FightResult[]): boolean {
  const fights = results.filter((r) => !r.trainer);
  const q = adv.quest;
  if (q.kind === 'wins') return fights.filter((r) => r.outcome === 'won').length >= questTarget(q);
  if (q.kind === 'big') return fights.some((r) => r.foe.big && r.outcome === 'won');
  const zone = zoneById(q.zone);
  const hunted = zone?.monsters[q.monster].id;
  return fights.filter((r) => r.foe.id === hunted && r.outcome === 'won').length >= questTarget(q);
}

/** The monster's hits on the hero while they smash, before a question: never the last heart. Tied up (Wool Whirlwind): none. */
export function monsterSwings(hearts: number, moment: Moment, tiedUp: boolean): number {
  if (!moment.autos || tiedUp) return 0;
  return Math.max(0, Math.min(MONSTER_SWINGS, hearts - 1));
}

/**
 * The hero's own smashes before a question. One question a fight (James, 27 Nov 2026): they wear the monster down until
 * the question's boosted smash is enough to finish it, so a right answer always wins the fight. Never the last smash.
 * Adventures from before moments (no autos) keep the old rules.
 */
export function autoSmash(power: number, foeHp: number, moment: Moment): number {
  if (!moment.autos) return 0;
  const own = Math.max(1, Math.round(power * AUTO_SHARE)) * moment.autos;
  const toFinish = foeHp - Math.round(power * moment.boost);
  return Math.max(0, Math.min(Math.max(own, toFinish), foeHp - 1));
}

/** Plays the adventure through the server's marks, in order. The fight screen and the server both use it. */
export function replay(adv: Adventure, marks: readonly Mark[]): Replay {
  const { power, cls, level, stars: startStars } = adv.start;
  const fresh = (foe: Foe, trainer: boolean) => ({ foe, foeHp: foe.hp, hearts: trainer ? TRAINER_HEARTS : HEARTS, maxHearts: trainer ? TRAINER_HEARTS : HEARTS, specialUsed: false, calm: 0, questions: 0, rights: 0 });
  let phase: Phase = adv.foes.length ? 'fight' : 'done';
  let fight = 0;
  let cur = adv.foes.length ? fresh(adv.foes[0], false) : null;
  const results: FightResult[] = [];
  const blows: Blow[] = [];
  let stars = 0;
  let stickers = 0;
  let done = false;
  let trainerMet = false;
  let trainerWon = false;

  const afterFights = () => {
    done = questDone(adv, results);
    if (done) stars += STARS.quest;
    const barFull = level < MAX_LEVEL && startStars + stars >= starsToTrainer(level);
    if (barFull) {
      trainerMet = true;
      phase = 'trainer';
      cur = fresh(trainerFoe(level), true);
    } else {
      phase = 'done';
      cur = null;
    }
  };

  for (let slot = 0; slot < marks.length && cur && phase !== 'done'; slot++) {
    const mark = marks[slot];
    // The monster's swing lands while the hero smashes, before the answer (and so before any special move).
    const swung = monsterSwings(cur.hearts, adv.moments?.[slot] ?? { autos: 0, boost: 1 }, cur.calm > 0);
    cur.hearts -= swung;
    const useSpecial = mark.special && !cur.specialUsed;
    if (useSpecial) cur.specialUsed = true;
    let times = 1;
    let shield = cur.calm > 0;
    if (useSpecial) {
      if (cls === 'knight') times = SPECIAL.knight.times;
      if (cls === 'dazzler') { times = SPECIAL.dazzler.times; shield = true; }
      if (cls === 'granny') { cur.calm = SPECIAL.granny.calmQuestions; shield = true; }
      if (cls === 'ninja') times = SPECIAL.ninja.times;
    }
    // The hero's own smashes first (never the last one: a question always finishes a monster) while the monster swings
    // back (never the hero's last heart), then the question.
    const moment = adv.moments?.[slot] ?? { autos: 0, boost: 1 };
    const autoHit = autoSmash(power, cur.foeHp, moment);
    cur.foeHp -= autoHit;
    const hit = mark.right ? Math.round(power * moment.boost * times) : 0;
    const ouch = !mark.right && !shield;
    cur.foeHp = Math.max(0, cur.foeHp - hit);
    if (ouch) cur.hearts = Math.max(0, cur.hearts - WRONG_HEARTS);
    if (cur.calm > 0) cur.calm -= 1;
    cur.questions += 1;
    if (mark.right) cur.rights += 1;
    if (useSpecial && cls === 'ninja' && mark.right) stickers += SPECIAL.ninja.stickers;
    const ended: Outcome | null = cur.foeHp <= 0 ? 'won' : cur.hearts <= 0 ? 'bonked' : null;
    blows.push({ slot, right: mark.right, special: useSpecial, auto: autoHit, boost: moment.boost, hit, swung, ouch, foeHp: cur.foeHp, hearts: cur.hearts, ended });
    if (!ended) continue;
    const trainer = (phase as Phase) === 'trainer';
    results.push({ foe: cur.foe, trainer, outcome: ended, questions: cur.questions, rights: cur.rights });
    if (trainer) {
      trainerWon = ended === 'won';
      phase = 'done';
      cur = null;
      break;
    }
    stars += ended === 'won' ? STARS.win : STARS.bonked;
    if (ended === 'won') stickers += STICKERS_A_WIN;
    fight += 1;
    if (fight < adv.foes.length) cur = fresh(adv.foes[fight], false);
    else afterFights();
  }
  // No marks yet, and no fights at all: nothing to play.
  if (!adv.foes.length && phase !== 'done') phase = 'done';

  return {
    phase,
    fight: (phase as Phase) === 'trainer' ? adv.foes.length : fight,
    foe: cur?.foe ?? null,
    foeHp: cur?.foeHp ?? 0,
    hearts: cur?.hearts ?? 0,
    maxHearts: cur?.maxHearts ?? HEARTS,
    specialUsed: cur?.specialUsed ?? false,
    calm: cur?.calm ?? 0,
    results,
    blows,
    slot: marks.length,
    stars,
    stickers,
    questDone: done,
    trainerMet,
    trainerWon,
  };
}

// ---------------------------------------------------------------- what it all earns

export interface Rewards {
  progress: Progress;
  starsEarned: number;
  levelUp: number | null;
  /** The pieces the chests gave (one for the quest, one for a trainer beaten). */
  gear: string[];
  stickers: number;
  points: number;
}

/** The pupil's progress after a finished adventure (the replay must be done), and what it earned. */
export function rewardsFor(before: Progress, r: Replay): Rewards {
  const p: Progress = { ...before, gear: { ...before.gear }, stats: { ...before.stats } };
  const fights = r.results.filter((x) => !x.trainer);
  const won = fights.filter((x) => x.outcome === 'won').length;
  p.stats.adventures += 1;
  p.stats.fightsWon += won;
  p.stats.fightsBonked += fights.length - won;
  p.stats.rights += r.results.reduce((s, x) => s + x.rights, 0);
  if (r.questDone) p.stats.quests += 1;
  let levelUp: number | null = null;
  const need = starsToTrainer(p.level);
  if (r.trainerWon) {
    p.stars = Math.max(0, p.stars + r.stars - need);
    p.level = Math.min(MAX_LEVEL, p.level + 1);
    p.stars = Math.min(p.stars, Math.max(0, starsToTrainer(p.level) - 1));
    p.stats.trainers += 1;
    levelUp = p.level;
  } else {
    p.stars = p.level >= MAX_LEVEL ? 0 : Math.min(need, p.stars + r.stars);
  }
  // The Monster Book: every monster smashed this adventure gets a tick.
  const book = { ...(before.book ?? {}) };
  for (const f of fights) if (f.outcome === 'won') book[f.foe.id] = (book[f.foe.id] ?? 0) + 1;
  p.book = book;
  const gear: string[] = [];
  const chests = (r.questDone ? 1 : 0) + (r.trainerWon ? 1 : 0);
  let extraStickers = 0;
  for (let i = 0; i < chests; i++) {
    const piece = chestPiece(p.chests);
    p.chests += 1;
    if (!piece) {
      extraStickers += 5;
      continue;
    }
    p.gear[piece.slot] = Math.max(p.gear[piece.slot], piece.tier);
    gear.push(`${piece.slot}-${piece.tier}`);
  }
  const stickers = r.stickers + extraStickers;
  p.stickers += stickers;
  const points = won * POINTS.fightWon + (r.questDone ? POINTS.quest : 0) + (r.trainerWon ? POINTS.trainer : 0);
  return { progress: p, starsEarned: r.stars, levelUp, gear, stickers, points };
}

/** Buys a shop item and wears it straight away. Null when it can't be bought (unknown, already owned, too few stickers). */
export function buyItem(before: Progress, id: string): Progress | null {
  const item = shopItem(id);
  const owned = before.owned ?? [];
  if (!item || owned.includes(item.id) || before.stickers < item.price) return null;
  return { ...before, stickers: before.stickers - item.price, owned: [...owned, item.id], [item.kind]: item.id };
}

/** Wears an owned hat or pet, or takes it off (null). Null when it isn't owned. */
export function wearItem(before: Progress, kind: ShopKind, id: string | null): Progress | null {
  if (id !== null) {
    const item = shopItem(id);
    if (!item || item.kind !== kind || !(before.owned ?? []).includes(id)) return null;
  }
  return { ...before, [kind]: id };
}
