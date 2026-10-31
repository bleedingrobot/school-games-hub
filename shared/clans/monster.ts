/**
 * The season monster (Clan Quest season goals, part 2). In monster week (the last week of the season) a huge monster
 * attacks every clan's village. One try a day:
 *
 * 1. **The siege.** The village fights first: the army (bigger with the Barracks, harder-hitting with the Forge), the Tower and
 *    any fire arrows knock a share off the monster's HP. One maths question (the Battle Cry kind) makes the siege hit harder.
 *    Buildings it "flattens" are for show only.
 * 2. **The clan fight.** The four members fight what is left, as in the Mines, with a Battle Cry every round. The monster stomps on
 *    two members each round and every third round uses its big move (you see it coming). The Walls cut every hit it does.
 *
 * Each lost try leaves the monster 10% more tired for that clan (up to 40%). Losing costs nothing real: members are knocked out
 * until tomorrow, the village is not touched. Pure, so the server and the screens use the same sums.
 */
import { CONFIG } from './config';
import { cryQuestion } from './battleCry';
import { empireOf, might } from './empire';
import { newFight, type Fighter, type FightState } from './fight';
import type { PracticalQuestion, PracticalSettings } from '../maths/practical';
import { markAnswer } from '../maths/practical';
import { roll } from './rng';
import { MONSTER_KINDS, type Clan, type Member, type MonsterKind, type MonsterSave, type Supplies } from './types';

const M = CONFIG.monster;

/** How each monster is shown. Only the name, the words and the big move differ; the numbers are the same. */
export interface MonsterLook {
  name: string;
  /** Short name for sentences ("Grimmor lifts a boulder!"). */
  short: string;
  /** One line about it. */
  blurb: string;
  /** Said the round before the big move. */
  warn: string;
  /** Said as the big move lands. */
  big: string;
  /** What the big move does, for How to play and the fight screen. */
  bigHelp: string;
  /** Said when it is beaten, and when a try is lost. */
  beaten: string;
  stompsOff: string;
  /** The trophy a winning clan keeps on its village. */
  trophy: string;
  /** Placeholder picture until the painted one is made. */
  emoji: string;
  /** The warning-week news lines, one a day from day `warnFrom`. */
  signs: string[];
}

export const MONSTER_LOOKS: Record<MonsterKind, MonsterLook> = {
  giant: {
    name: 'Grimmor the Storm Giant', short: 'Grimmor', emoji: '🗿',
    blurb: 'A huge mountain giant who throws boulders and stamps on everything.',
    warn: 'Grimmor lifts a boulder!', big: 'Grimmor throws the boulder!',
    bigHelp: 'Every third round he throws a boulder at one member. Guard to take half.',
    beaten: 'Grimmor stomps off back to the mountains for good!', stompsOff: 'Grimmor stomps off for the night. He will be back tomorrow.',
    trophy: "Grimmor's club",
    signs: ['Giant footprints were found by the river.', 'Trees on the hill have been pushed over.', 'Thunder rumbles from the mountains every night.'],
  },
  golem: {
    name: 'Old Craghold the Stone Golem', short: 'Craghold', emoji: '🪨',
    blurb: 'A slow, walking hill of rock.',
    warn: 'Craghold raises both fists!', big: 'Craghold slams the ground!',
    bigHelp: 'Every third round he slams the ground: everyone takes a little damage. Guard to take half.',
    beaten: 'Craghold crumbles into a pile of pebbles!', stompsOff: 'Craghold rumbles away for the night. He will be back tomorrow.',
    trophy: "Craghold's stone heart",
    signs: ['The ground shook in the night.', 'A hill near the village has moved.', 'Big round stones keep rolling down the road.'],
  },
  troll: {
    name: 'Frostjaw the Frost Troll', short: 'Frostjaw', emoji: '🧊',
    blurb: 'A shaggy, wintry brute with icy breath.',
    warn: 'Frostjaw takes a deep, cold breath!', big: 'Frostjaw breathes ice!',
    bigHelp: 'Every third round he breathes ice on one member, who is frozen for a round. Guard to take half.',
    beaten: 'Frostjaw runs off to the far north, shivering!', stompsOff: 'Frostjaw slinks off for the night. He will be back tomorrow.',
    trophy: "Frostjaw's icy tooth",
    signs: ['The village pond froze in the middle of a warm day.', 'Huge furry footprints were found in the frost.', 'A cold wind howls from the north every night.'],
  },
};

/** The monster of a season: the giant, the golem and the troll take turns. */
export const monsterOf = (season: number): MonsterKind => MONSTER_KINDS[(((Math.max(1, season) - 1) % MONSTER_KINDS.length) + MONSTER_KINDS.length) % MONSTER_KINDS.length];

export const noSupplies = (): Supplies => ({ arrows: 0, potions: 0, net: 0 });

/** This season's monster save (a fresh one if the clan has none for this season). */
export function monsterSave(clan: Clan, season: number): MonsterSave {
  const m = clan.monster;
  return m && m.season === season ? m : { season, tries: 0, losses: 0, lastDay: 0, supplies: noSupplies() };
}

/** How tired the monster is for a clan that has lost `losses` tries: a share, 0 to `tiredMax`. */
export const tiredShare = (losses: number) => Math.min(M.tiredMax, Math.max(0, losses) * M.tiredPerLoss);

// ---------------------------------------------------------------------------
// The siege
// ---------------------------------------------------------------------------

export interface SiegeRound {
  /** Share of the monster's HP the army and the tower knocked off this round. */
  army: number;
  tower: number;
}

export interface Siege {
  rounds: SiegeRound[];
  /** The whole share knocked off (0 to `siege.most`). */
  share: number;
  /** Was the siege question answered right? Null if there was no question (the teacher has every topic off) or it was skipped. */
  right: boolean | null;
  /** Fire arrows shot. */
  arrows: number;
}

/** The siege's maths question for a try (the Battle Cry kind, from the try's seed and the teacher's topics). Null with every topic off. */
export const siegeQuestion = (seed: number, settings: PracticalSettings): PracticalQuestion | null => cryQuestion(seed, 0, settings);

/** The share of the monster's HP the village knocks off before the clan fights, before luck: the army, the tower, fire arrows and the maths. */
export function siegeShare(clan: Clan, arrows: number, right: boolean): number {
  const e = empireOf(clan);
  const S = M.siege;
  const army = S.armyShare * Math.min(1, might(e.troops) / S.fullMight) * (1 + (e.levels.forge * CONFIG.empire.buildings.forge.per) / 100);
  const tower = S.towerShare * e.levels.tower + S.arrowShare * arrows;
  return Math.min(S.most, (army + tower) * (right ? S.rightAnswer : 1));
}

/** Play the siege: 3 rounds, each a third of the share with a little luck. */
export function playSiege(clan: Clan, arrows: number, right: boolean | null, seed: number): Siege {
  const dice = { rng: Math.imul(seed | 0, 0x2c1b3c6d) ^ 0x297a2d39 };
  const e = empireOf(clan);
  const S = M.siege;
  const boost = right ? S.rightAnswer : 1;
  const armyAll = S.armyShare * Math.min(1, might(e.troops) / S.fullMight) * (1 + (e.levels.forge * CONFIG.empire.buildings.forge.per) / 100) * boost;
  const towerAll = (S.towerShare * e.levels.tower + S.arrowShare * arrows) * boost;
  const rounds: SiegeRound[] = [];
  let share = 0;
  for (let r = 0; r < 3; r++) {
    const luck = (90 + roll(dice, 21)) / 100;
    const army = Math.max(0, Math.min(S.most - share, (armyAll / 3) * luck));
    share += army;
    const tower = Math.max(0, Math.min(S.most - share, (towerAll / 3) * luck));
    share += tower;
    rounds.push({ army, tower });
  }
  return { rounds, share, right, arrows };
}

/** Mark a siege answer (null: skipped, or no question). */
export function markSiege(seed: number, settings: PracticalSettings, answer: number | null): { question: PracticalQuestion | null; right: boolean | null } {
  const question = siegeQuestion(seed, settings);
  if (!question || answer === null) return { question, right: question ? false : null };
  return { question, right: markAnswer(question, answer) };
}

// ---------------------------------------------------------------------------
// The clan fight
// ---------------------------------------------------------------------------

/** Everything a monster try needs to be played again exactly: kept with the open fight. */
export interface MonsterSetup {
  kind: MonsterKind;
  /** Lost tries before this one (the monster is that much more tired). */
  losses: number;
  /** The siege's share of HP knocked off. */
  siege: number;
  potions: number;
  net: boolean;
  walls: number;
}

/** The monster's full HP (after tiredness, before the siege) and the HP it starts the clan fight with. */
export function monsterHp(setup: Pick<MonsterSetup, 'losses' | 'siege'>): { maxHp: number; hp: number } {
  const maxHp = Math.max(1, Math.round(M.hp * (1 - tiredShare(setup.losses))));
  return { maxHp, hp: Math.max(1, Math.round(maxHp * (1 - setup.siege))) };
}

function monsterFighter(setup: MonsterSetup): Fighter {
  const { maxHp, hp } = monsterHp(setup);
  const tired = 1 - tiredShare(setup.losses);
  return {
    side: 'enemy', index: 0, name: MONSTER_LOOKS[setup.kind].short, level: M.depth + 8, hp, maxHp, sp: 0, maxSp: 0,
    stats: { ...M.stats, strength: Math.round(M.stats.strength * tired) }, spells: [], mods: [], tied: 0, guarding: false, difficulty: M.depth * 3,
  };
}

/** Start the clan part of a monster try. Same seed and setup, same fight, so the server can replay it. */
export function newMonsterFight(members: Member[], setup: MonsterSetup, seed: number): FightState {
  // newFight makes the clan's side and the dice; the mine monsters it picks are replaced by the monster.
  const state = newFight(members, M.depth, seed, false);
  state.enemies = [monsterFighter(setup)];
  state.monster = { kind: setup.kind, potions: setup.potions, net: setup.net, wallsCut: Math.min(90, setup.walls * M.wallsCut), rounds: M.rounds };
  return state;
}

// ---------------------------------------------------------------------------
// Supplies
// ---------------------------------------------------------------------------

export type SupplyKind = keyof Supplies;
export const SUPPLY_KINDS: readonly SupplyKind[] = ['arrows', 'potions', 'net'];
export const SUPPLY_NAMES: Record<SupplyKind, { one: string; many: string; help: string }> = {
  arrows: { one: 'fire arrow', many: 'fire arrows', help: 'Your tower hits harder in the siege.' },
  potions: { one: 'healing potion', many: 'healing potions', help: 'Heal a member in the middle of the monster fight.' },
  net: { one: 'giant net', many: 'giant nets', help: 'The monster misses its first big move.' },
};

/** A supply's price with the village tax, like the shop's. */
export const supplyPrice = (kind: SupplyKind) => Math.ceil((M.supplies[kind].price * (100 + CONFIG.shopTax)) / 100);

export type SupplyBuy = { ok: true } | { ok: false; why: string; say: string };

/** Buy `count` of a supply for this season (paid from the purse, never more than the most a clan may hold). */
export function buySupply(clan: Clan, season: number, kind: SupplyKind, count: number): SupplyBuy {
  if (!SUPPLY_KINDS.includes(kind) || !Number.isInteger(count) || count < 1) return { ok: false, why: 'amount', say: 'Pick what to buy and how many.' };
  const save = monsterSave(clan, season);
  const room = M.supplies[kind].max - save.supplies[kind];
  if (count > room) return { ok: false, why: 'full', say: room > 0 ? `You can carry ${room} more ${room === 1 ? SUPPLY_NAMES[kind].one : SUPPLY_NAMES[kind].many}.` : `You already have as many ${SUPPLY_NAMES[kind].many} as you can carry.` };
  const cost = supplyPrice(kind) * count;
  if (clan.gold < cost) return { ok: false, why: 'gold', say: `That costs ${cost} gold and the clan has ${clan.gold}.` };
  clan.gold -= cost;
  clan.monster = { ...save, supplies: { ...save.supplies, [kind]: save.supplies[kind] + count } };
  return { ok: true };
}
