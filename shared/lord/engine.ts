import {
  ARENA_FIGHTS_PER_DAY, ARMOURS, CLASSES, DRAGON_BREATHER, DRAGON_STAGES, EVENT_ONE_IN, FOREST_FIGHTS_PER_DAY, MAX_LEVEL,
  RUN_AWAY_CHANCE, SELL_BACK, SEASON_DAYS, SKILL_USES_PER_DAY, STARTING_GOLD, WAKE_UP_HP_SHARE, WEAKER_ONE_IN,
  WEAPONS, baseStats, expNeeded, friendly, levelUpGain, masterFor, monstersAt, tierPower,
} from './data';
import { EVENTS } from './events';
import type {
  FightAction, FightEvent, FightState, ForestEvent, Hero, HeroClass, Monster, SkillId, TripResult,
} from './types';

// ---------- Random numbers you can save: one number is the whole generator state ----------

/** mulberry32. Returns the random number and the new state. */
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** A plain random function from a seed (for picking a trip, or in tests). */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    const [value, next] = nextRandom(state);
    state = next;
    return value;
  };
}

const pick = <T,>(rand: () => number, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

// ---------- Heroes ----------

export function newHero(heroClass: HeroClass, today: string, previous?: Pick<Hero, 'dragonKills' | 'look'>): Hero {
  const base = baseStats(1);
  return {
    level: 1, exp: 0, hp: base.maxHp, maxHp: base.maxHp, strength: base.strength, defence: base.defence,
    gold: STARTING_GOLD, bank: 0, gems: 0, kindness: 0, weapon: 0, armour: 0, heroClass,
    dragonKills: previous?.dragonKills ?? 0,
    day: today, forestLeft: FOREST_FIGHTS_PER_DAY, arenaLeft: ARENA_FIGHTS_PER_DAY, skillLeft: SKILL_USES_PER_DAY,
    masterTried: false, forestWins: 0, arenaWins: 0, masterWins: 0,
    ...(previous?.look ? { look: previous.look } : {}),
  };
}

export const heroAttack = (h: Hero) => h.strength + WEAPONS[h.weapon].power;
export const heroDefence = (h: Hero) => h.defence + ARMOURS[h.armour].power;

/** Today's date in New Zealand, as YYYY-MM-DD. The server's clock, not the browser's. */
export function nzDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Unused forest fights pile up for missed days, up to this many days' worth in all (a casual pupil gets a double day). */
export const FOREST_PILE_UP_DAYS = 2;

/**
 * The first play of a new day gives back the day's turns and full health. Forest fights you didn't use pile up for
 * the days you missed, but never past two days' worth (a pupil who plays twice a week gets a double day), and a missed
 * day saves up one extra master try. Arena fights and skills don't pile up. Called by the server at the start of every request, so nothing
 * has to run at midnight.
 */
export function rollDay(hero: Hero, today: string, forestPerDay = FOREST_FIGHTS_PER_DAY): Hero {
  if (hero.day === today) return hero;
  const gone = Math.max(1, dayNumber(today) - dayNumber(hero.day || today));
  const kept = Math.max(0, hero.forestLeft);
  return {
    ...hero, day: today, forestLeft: Math.min(forestPerDay * FOREST_PILE_UP_DAYS, kept + forestPerDay * gone),
    arenaLeft: ARENA_FIGHTS_PER_DAY, skillLeft: SKILL_USES_PER_DAY, masterTried: false, hp: hero.maxHp,
    masterExtra: Math.min(2, (hero.masterExtra ?? 0) + Math.max(0, gone - 1)),
  };
}

// ---------- Seasons: 35 days, then everyone starts again ----------

const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);

export function seasonOf(seasonOneStart: string, today: string) {
  const days = dayNumber(today) - dayNumber(seasonOneStart);
  if (days < 0) return { number: 0, dayOfSeason: 0, daysLeft: -days, started: false };
  const number = Math.floor(days / SEASON_DAYS) + 1;
  const dayOfSeason = (days % SEASON_DAYS) + 1;
  return { number, dayOfSeason, daysLeft: SEASON_DAYS - dayOfSeason, started: true };
}

// ---------- The forest ----------

/** Picks what a trip into the forest finds. The same seed always finds the same thing. */
export function forestTrip(hero: Hero, seed: number, events: ForestEvent[] = EVENTS): TripResult {
  const rand = makeRandom(seed);
  if (events.length > 0 && Math.floor(rand() * EVENT_ONE_IN) === 0) return { kind: 'event', event: pick(rand, events) };
  const weaker = hero.level > 1 && Math.floor(rand() * WEAKER_ONE_IN) === 0;
  const monster = pick(rand, monstersAt(weaker ? hero.level - 1 : hero.level));
  return { kind: 'fight', monster, seed: Math.floor(rand() * 4294967296) };
}

export function applyEvent(hero: Hero, event: ForestEvent, mathsRight = false): Hero {
  const scale = tierPower(hero.level) / 10;
  const scaled = (n = 0) => friendly(n * scale);
  const next = { ...hero };
  next.gold += scaled(event.gold);
  next.exp += scaled(event.exp);
  next.gems += event.gems ?? 0;
  next.kindness += event.kindness ?? 0;
  if (event.heal === 'full') next.hp = next.maxHp;
  else if (typeof event.heal === 'number') next.hp = Math.min(next.maxHp, next.hp + Math.ceil(next.maxHp * event.heal));
  if (event.maths && mathsRight) {
    next.gold += scaled(event.maths.reward.gold);
    next.exp += scaled(event.maths.reward.exp);
    next.gems += event.maths.reward.gems ?? 0;
  }
  return next;
}

// ---------- Fights ----------

/** LORD's damage: a random half of your strength, plus the other half. */
export function damageRoll(attack: number, rand: () => number): number {
  const half = Math.floor(attack / 2);
  return half + Math.floor(rand() * (half + 1));
}

export interface FightOptions {
  kind?: FightState['kind'];
  firstHitBonus?: number;
  shield?: number;
  /** HP the hero starts this fight with (the dragon's stages carry it over). Defaults to the hero's HP. */
  heroHp?: number;
}

export function startFight(hero: Hero, monster: Monster, seed: number, options: FightOptions = {}): FightState {
  return {
    monster, monsterHp: monster.hp, heroHp: options.heroHp ?? hero.hp, kind: options.kind ?? 'forest',
    heroClass: hero.heroClass, heroAttack: heroAttack(hero), heroDefence: heroDefence(hero), heroMaxHp: hero.maxHp,
    round: 0, firstHitBonus: options.firstHitBonus ?? 1, shield: options.shield ?? 0, dodging: false,
    skillLeft: hero.skillLeft, goldPinched: 0, rng: seed >>> 0, over: false, outcome: null, log: [],
  };
}

export const canRun = (fight: FightState) => fight.kind === 'forest';

export function skillsFor(heroClass: HeroClass): SkillId[] {
  return CLASSES[heroClass].skills;
}

/** Plays one round: the hero acts, then the monster hits back. Pure: returns a new state. */
export function stepFight(fight: FightState, action: FightAction): FightState {
  if (fight.over) throw new Error('This fight is over');
  let rng = fight.rng;
  const rand = () => {
    const [value, next] = nextRandom(rng);
    rng = next;
    return value;
  };
  const f: FightState = { ...fight, log: [] };
  f.round += 1;
  const log: FightEvent[] = f.log;
  let monsterActs = true;

  const hitMonster = (damage: number, crit = false) => {
    f.monsterHp = Math.max(0, f.monsterHp - damage);
    log.push({ type: 'hero-hit', damage, crit });
  };
  const bonus = f.round === 1 ? f.firstHitBonus : 1;

  if (action.type === 'attack') {
    hitMonster(Math.max(1, Math.round(damageRoll(f.heroAttack, rand) * bonus)));
  } else if (action.type === 'run') {
    if (!canRun(f)) throw new Error('You cannot run from this fight');
    const success = rand() < RUN_AWAY_CHANCE;
    log.push({ type: 'ran', success });
    if (success) {
      f.over = true;
      f.outcome = 'fled';
      monsterActs = false;
    }
  } else {
    if (!skillsFor(f.heroClass).includes(action.skill)) throw new Error('Your class cannot do that');
    if (f.skillLeft <= 0) throw new Error('No skill uses left today');
    if (action.skill === 'pinch' && f.goldPinched > 0) throw new Error('You already pinched this monster');
    f.skillLeft -= 1;
    switch (action.skill) {
      case 'power-strike': {
        const damage = Math.max(1, Math.round(damageRoll(f.heroAttack, rand) * 2 * bonus));
        hitMonster(damage, true);
        log.push({ type: 'skill', skill: 'power-strike', amount: damage });
        break;
      }
      case 'zap': {
        const damage = Math.max(1, Math.round(f.heroAttack * 1.5 * bonus));
        hitMonster(damage);
        log.push({ type: 'skill', skill: 'zap', amount: damage });
        break;
      }
      case 'mend': {
        const healed = Math.min(f.heroMaxHp - f.heroHp, Math.ceil(f.heroMaxHp * 0.25));
        f.heroHp += healed;
        log.push({ type: 'skill', skill: 'mend', amount: healed });
        break;
      }
      case 'dodge': {
        // Slip aside and counter: the monster's next hit misses and you hit back normally.
        f.dodging = true;
        log.push({ type: 'skill', skill: 'dodge', amount: 0 });
        hitMonster(Math.max(1, Math.round(damageRoll(f.heroAttack, rand) * bonus)));
        break;
      }
      case 'pinch': {
        // Lift a little gold while hitting: a normal hit plus a quarter of the monster's gold.
        f.goldPinched = Math.max(1, Math.floor(f.monster.gold / 4));
        log.push({ type: 'skill', skill: 'pinch', amount: f.goldPinched });
        hitMonster(Math.max(1, Math.round(damageRoll(f.heroAttack, rand) * bonus)));
        break;
      }
    }
  }

  if (!f.over && f.monsterHp <= 0) {
    f.over = true;
    f.outcome = 'won';
    monsterActs = false;
  }

  if (monsterActs && !f.over) {
    if (f.dodging) {
      f.dodging = false;
      log.push({ type: 'monster-missed' });
    } else {
      const raw = damageRoll(f.monster.strength, rand);
      const blocked = Math.floor(rand() * (f.heroDefence + 1)) + f.shield;
      const damage = Math.max(0, raw - blocked);
      f.heroHp = Math.max(0, f.heroHp - damage);
      log.push({ type: 'monster-hit', damage, blocked: Math.min(raw, blocked) });
      if (f.heroHp <= 0) {
        f.over = true;
        f.outcome = 'lost';
      }
    }
  }

  if (f.over && f.outcome) log.push({ type: 'end', outcome: f.outcome });
  f.rng = rng;
  return f;
}

/** Plays a saved list of actions from the start. This is what the server does to check a fight. */
export function replayFight(start: FightState, actions: FightAction[]): FightState {
  let fight = start;
  for (const action of actions) {
    if (fight.over) throw new Error('Too many actions: the fight was already over');
    fight = stepFight(fight, action);
  }
  return fight;
}

/** What a finished fight does to the hero. Master and dragon fights are handled by their own functions. */
export function applyForestResult(hero: Hero, fight: FightState): Hero {
  if (!fight.over) throw new Error('The fight is not finished');
  const next: Hero = { ...hero, skillLeft: fight.skillLeft };
  if (fight.outcome === 'won') {
    next.hp = fight.heroHp;
    next.gold += fight.monster.gold + fight.goldPinched;
    next.exp += fight.monster.exp;
    next.forestWins += 1;
  } else if (fight.outcome === 'lost') {
    // Soft losing: you drop the gold you were carrying (banked gold is safe), keep your exp, and wake at the healer.
    next.gold = 0;
    next.hp = Math.max(1, Math.ceil(hero.maxHp * WAKE_UP_HP_SHARE));
  } else {
    next.hp = fight.heroHp;
  }
  return next;
}

/** The forest-fight turn is taken when the fight is handed out, so closing the tab does not give it back. */
export const useForestTurn = (hero: Hero): Hero => {
  if (hero.forestLeft <= 0) throw new Error('No forest fights left today');
  return { ...hero, forestLeft: hero.forestLeft - 1 };
};

// ---------- Masters ----------

export function canChallengeMaster(hero: Hero): { ok: boolean; reason?: string } {
  if (hero.level >= MAX_LEVEL) return { ok: false, reason: 'You have beaten every master. The dragon is next!' };
  if (hero.masterTried) return { ok: false, reason: 'You already challenged your master today. Come back tomorrow.' };
  const need = expNeeded(hero.level);
  if (hero.exp < need) return { ok: false, reason: `You need ${need - hero.exp} more experience before your master will fight you.` };
  return { ok: true };
}

export function startMasterFight(hero: Hero, seed: number, options: Omit<FightOptions, 'kind'> = {}): FightState {
  const check = canChallengeMaster(hero);
  if (!check.ok) throw new Error(check.reason);
  const master = masterFor(hero.level)!;
  const monster: Monster = {
    id: `master-${master.level}`, name: master.name, level: master.level, hp: master.hp, strength: master.strength,
    gold: 0, exp: 0, intro: master.intro,
  };
  return startFight(hero, monster, seed, { ...options, kind: 'master' });
}

/** Beat your master and you go up a level, a bit stronger, fully healed. Lose and nothing is lost: you are just healed. */
export function applyMasterResult(hero: Hero, fight: FightState): Hero {
  if (!fight.over) throw new Error('The fight is not finished');
  // A saved-up extra try is used before the day's try is spent.
  const extra = hero.masterExtra ?? 0;
  const next: Hero = { ...hero, masterTried: extra <= 0, masterExtra: Math.max(0, extra - 1), skillLeft: fight.skillLeft };
  if (fight.outcome === 'won') {
    const gain = levelUpGain(hero.level + 1);
    next.level += 1;
    next.maxHp += gain.maxHp;
    next.strength += gain.strength;
    next.defence += gain.defence;
    next.masterWins += 1;
  }
  next.hp = next.maxHp;
  return next;
}

// ---------- The Red Dragon ----------

export function canFaceDragon(hero: Hero): boolean {
  return hero.level >= MAX_LEVEL && hero.exp >= expNeeded(MAX_LEVEL - 1);
}

/** A dragon stage, 1 to 3. Pass the hero's HP from the stage before. */
export function startDragonStage(hero: Hero, stage: 1 | 2 | 3, seed: number, options: Omit<FightOptions, 'kind'> = {}): FightState {
  if (!canFaceDragon(hero)) throw new Error('You are not ready for the dragon yet');
  return startFight(hero, DRAGON_STAGES[stage - 1], seed, { ...options, kind: 'dragon' });
}

/** Between dragon stages the dragon pauses to roar and you catch your breath: a share of your HP comes back. */
export function dragonBreather(hero: Hero, hp: number): number {
  return Math.min(hero.maxHp, hp + Math.ceil(hero.maxHp * DRAGON_BREATHER));
}

/** Win all three stages: a star, and your hero starts again at level 1 (class and stars are kept). */
export function finishDragon(hero: Hero, today: string): Hero {
  return newHero(hero.heroClass, today, { dragonKills: hero.dragonKills + 1 });
}

/** Lose to the dragon: you wake at the healer, nothing lost but a day's try. */
export function loseToDragon(hero: Hero): Hero {
  return { ...hero, hp: Math.max(1, Math.ceil(hero.maxHp * WAKE_UP_HP_SHARE)) };
}

// ---------- The healer, the bank and the shop ----------

/** Gold per HP at the healer. */
export const healPrice = (level: number) => Math.max(1, Math.round(level * 0.25));

export function healCost(hero: Hero, hp: number, discount = 0): number {
  return Math.ceil(hp * healPrice(hero.level) * (1 - discount));
}

/** Heal up to `hp` points, as many as you can afford. `discount` is 0.1 after a right answer. */
export function heal(hero: Hero, hp: number, discount = 0): Hero {
  const missing = hero.maxHp - hero.hp;
  let n = Math.max(0, Math.min(hp, missing));
  while (n > 0 && healCost(hero, n, discount) > hero.gold) n -= 1;
  return { ...hero, hp: hero.hp + n, gold: hero.gold - healCost(hero, n, discount) };
}

export function deposit(hero: Hero, amount: number): Hero {
  const n = Math.max(0, Math.min(Math.floor(amount), hero.gold));
  return { ...hero, gold: hero.gold - n, bank: hero.bank + n };
}

export function withdraw(hero: Hero, amount: number): Hero {
  const n = Math.max(0, Math.min(Math.floor(amount), hero.bank));
  return { ...hero, gold: hero.gold + n, bank: hero.bank - n };
}

/** 1% off for every point of Kindness, up to 10%. */
export const kindnessDiscount = (hero: Hero) => Math.min(0.1, hero.kindness * 0.01);

export function shopPrice(hero: Hero, cost: number, extraDiscount = 0): number {
  return Math.ceil(cost * (1 - kindnessDiscount(hero)) * (1 - extraDiscount));
}

export type BuyResult = { ok: true; hero: Hero; paid: number; refund: number } | { ok: false; reason: string };

/**
 * Buy a weapon or armour. Your old one is sold back for half its price first, then you pay, so
 * saved-up gold can't skip half the game: the best gear needs enough strength or defence (LORD's rule).
 */
export function buyGear(hero: Hero, slot: 'weapon' | 'armour', index: number, extraDiscount = 0): BuyResult {
  const table = slot === 'weapon' ? WEAPONS : ARMOURS;
  const item = table[index];
  if (!item || index === 0) return { ok: false, reason: 'The shop does not sell that.' };
  if (index <= hero[slot]) return { ok: false, reason: 'That is no better than what you have.' };
  const have = slot === 'weapon' ? hero.strength : hero.defence;
  if (have < item.need) {
    return { ok: false, reason: `You need ${item.need} base ${slot === 'weapon' ? 'strength' : 'defence'} to use that. Beat your next master first.` };
  }
  const refund = Math.floor(table[hero[slot]].cost * SELL_BACK);
  const paid = shopPrice(hero, item.cost, extraDiscount);
  if (hero.gold + refund < paid) return { ok: false, reason: `You need ${paid - refund - hero.gold} more gold (after selling your old one).` };
  return { ok: true, hero: { ...hero, [slot]: index, gold: hero.gold + refund - paid }, paid, refund };
}

// ---------- The arena: two heroes, played by the computer ----------

/** What a hero brings to a duel. Nothing about gold, gear names or the pupil: just the numbers that decide it. */
export interface Duelist {
  name: string;
  heroClass: HeroClass;
  level: number;
  attack: number;
  defence: number;
  maxHp: number;
}

export type DuelEvent =
  | { who: 'a' | 'b'; type: 'hit'; damage: number; move?: SkillId }
  | { who: 'a' | 'b'; type: 'miss' };

export interface DuelResult {
  winner: 'a' | 'b';
  rounds: number;
  hpA: number;
  hpB: number;
  log: DuelEvent[];
}

/** The most rounds a duel can last. After that, whoever has the larger share of health left wins. */
export const MAX_DUEL_ROUNDS = 30;
/** The round each side uses its class move. */
const MOVE_ROUND = 2;

export const duelistOf = (hero: Hero, name: string): Duelist => ({
  name, heroClass: hero.heroClass, level: hero.level, attack: heroAttack(hero), defence: heroDefence(hero), maxHp: hero.maxHp,
});

/**
 * An arena duel. Both heroes start at full health and take turns (a first, then b) for up to 30 rounds. A hit is
 * LORD's damage roll minus a random 0 to the other hero's defence (in player fights defence counts on both sides),
 * and always at least 1. In round 2 each hero uses its class move once, for free: a Knight's power strike (double),
 * a Mage's zap (1.5 × attack, no roll) or a Trickster's dodge (the next hit misses). Pure and seeded, so the very
 * same duel can be played again from the same two heroes and the same seed.
 */
export function playDuel(a: Duelist, b: Duelist, seed: number): DuelResult {
  let rng = seed >>> 0;
  const rand = () => {
    const [value, next] = nextRandom(rng);
    rng = next;
    return value;
  };
  const hp = { a: a.maxHp, b: b.maxHp };
  const side = { a, b };
  const dodging = { a: false, b: false };
  const log: DuelEvent[] = [];
  let rounds = 0;
  const strike = (who: 'a' | 'b') => {
    const us = side[who];
    const other = who === 'a' ? 'b' : 'a';
    const them = side[other];
    if (dodging[other]) {
      dodging[other] = false;
      log.push({ who, type: 'miss' });
      return;
    }
    let move: SkillId | undefined;
    let raw: number;
    if (rounds === MOVE_ROUND && us.heroClass === 'knight') {
      move = 'power-strike';
      raw = damageRoll(us.attack, rand) * 2;
    } else if (rounds === MOVE_ROUND && us.heroClass === 'mage') {
      move = 'zap';
      raw = Math.round(us.attack * 1.5);
    } else {
      raw = damageRoll(us.attack, rand);
      if (rounds === MOVE_ROUND && us.heroClass === 'trickster') {
        move = 'dodge';
        dodging[who] = true;
      }
    }
    const damage = Math.max(1, raw - Math.floor(rand() * (them.defence + 1)));
    hp[other] = Math.max(0, hp[other] - damage);
    log.push({ who, type: 'hit', damage, ...(move ? { move } : {}) });
  };
  while (rounds < MAX_DUEL_ROUNDS && hp.a > 0 && hp.b > 0) {
    rounds += 1;
    strike('a');
    if (hp.b > 0) strike('b');
  }
  const winner = hp.b <= 0 ? 'a' : hp.a <= 0 ? 'b' : hp.a / a.maxHp > hp.b / b.maxHp ? 'a' : 'b';
  return { winner, rounds, hpA: hp.a, hpB: hp.b, log };
}

/** A little experience for an arena win: about half a forest monster's worth. Losing costs nothing and gives nothing. */
export const arenaExp = (level: number) => Math.max(1, Math.round(tierPower(level) * 0.5));
