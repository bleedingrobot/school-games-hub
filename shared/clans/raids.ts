/**
 * Village Raids on classmates (docs/CLANS-PVP-PLAN.md), as plain rules the server and the screens share.
 *
 * A raid is a siege (your army and Forge against their army and Walls, their Tower shooting first, one maths question)
 * and then a hero fight: your four heroes against a computer-played copy of theirs, with a Battle Cry every round.
 * Nobody loses anything: neither clan's heroes, gold, troops or buildings change. The rewards (gold and Banners) are made
 * by the game, for the raiders whatever happens and for the raided village when it holds.
 *
 * Nothing here knows a pupil's name or id: a clan is its clan name and a hidden public id, and the defenders are shown by
 * race and class only.
 */
import { CONFIG } from './config';
import { fightStats } from './character';
import { empireOf, levelTotal, might, needsUpgrade, upgradeSave } from './empire';
import { newFight, type Fighter, type FightResult, type FightState } from './fight';
import { lookOf } from './looks';
import { roll } from './rng';
import { weekOf } from './village';
import type { Banners, Clan, Empire, Held, Levels, Member, OldEmpire, Troops, Village } from './types';

const R = CONFIG.classRaids;

// ---------------------------------------------------------------------------
// Power, rivals and the Banners board
// ---------------------------------------------------------------------------

/** How strong a clan is, to suggest rivals: heroes' levels, building levels and army. */
export const powerOf = (heroLevels: number, buildingLevels: number, armyMight: number) =>
  heroLevels * R.power.heroLevel + buildingLevels * R.power.buildingLevel + Math.floor(armyMight / R.power.mightPer);

export const clanPower = (clan: Clan) => {
  const e = empireOf(clan);
  return powerOf(clan.members.reduce((t, m) => t + m.level, 0), levelTotal(e), might(e.troops));
};

/** Should win, close, or tough: how a rival of `theirs` looks to a clan of `mine`. */
export type Light = 'easy' | 'close' | 'tough';
export const lightOf = (mine: number, theirs: number): Light =>
  theirs >= mine * R.light.tough ? 'tough' : theirs <= mine * R.light.easy ? 'easy' : 'close';
export const LIGHT_NAMES: Record<Light, string> = { easy: 'Should win', close: 'Close', tough: 'Tough' };

/** Banners this week (a save from an earlier week counts as none). */
export const bannersThisWeek = (b: Banners | null | undefined, week: number) => (b && b.week === week ? b.count : 0);

/** What a clan may know about another clan at school: its name, how strong it is and its Banners. No gold, no pupil. */
export interface RivalSketch {
  id: string;
  name: string;
  /** All its heroes' levels added up. */
  heroLevels: number;
  levels: Partial<Levels> | null;
  troops: Partial<Troops> | null;
  banners?: Banners | null;
  /** In my class (missing on older replies: treat as my class). */
  sameClass?: boolean;
  /** Its class's name, only for clans from other classes. */
  className?: string | null;
  /** May be raided (false when its class has raids paused: it still shows on the Banners board). Missing means yes. */
  canRaid?: boolean;
}

export const sketchPower = (s: RivalSketch) => {
  const levels = Object.values(s.levels ?? {}).reduce((t: number, n) => t + (Number(n) || 0), 0);
  const troops = { footman: 0, axeman: 0, knight: 0, ...(s.troops ?? {}) } as Troops;
  return powerOf(s.heroLevels, levels, might(troops));
};

export interface Rival {
  id: string;
  name: string;
  /** In my class. */
  sameClass: boolean;
  /** Its class's name, for clans from other classes. */
  className: string | null;
  light: Light;
  /** One of the closest few: shown big at the top. */
  suggested: boolean;
  /** Already raided today. */
  raided: boolean;
}

/**
 * Every clan that can be raided at school: the closest few in power first (not raided today, from my class when it has
 * enough), then the rest by name (the screen shows my class first, then the rest of the school with a search).
 */
export function rivalList(clan: Clan, raidedToday: readonly string[], sketches: RivalSketch[]): Rival[] {
  const mine = Math.max(1, clanPower(clan));
  const all = sketches.filter((s) => s.canRaid !== false).map((s) => ({ s, power: sketchPower(s), raided: raidedToday.includes(s.id), same: s.sameClass !== false }));
  const close = all.filter((x) => !x.raided)
    .sort((a, b) => Number(b.same) - Number(a.same) || Math.abs(a.power - mine) - Math.abs(b.power - mine) || a.s.name.localeCompare(b.s.name))
    .slice(0, R.suggested);
  const rest = all.filter((x) => !close.includes(x)).sort((a, b) => a.s.name.localeCompare(b.s.name));
  return [...close.map((x) => ({ x, suggested: true })), ...rest.map((x) => ({ x, suggested: false }))].map(({ x, suggested }) => ({
    id: x.s.id, name: x.s.name, sameClass: x.same, className: x.same ? null : x.s.className ?? null, light: lightOf(mine, x.power), suggested, raided: x.raided,
  }));
}

export interface BoardRow {
  name: string;
  banners: number;
  /** This is your own clan. */
  me: boolean;
  /** Its place on the board (1 is the most). */
  place: number;
}

/** How many clans the whole-school board shows (your own clan shows too, below them, if it isn't among them). */
export const BOARD_TOP = 10;

/** This week's Banners board for the whole school: the top clans with a Banner, and your own clan even with none. Most first. */
export function bannerBoard(clan: Clan, week: number, sketches: RivalSketch[]): BoardRow[] {
  const rows = [
    { name: clan.name, banners: bannersThisWeek(empireOf(clan).banners, week), me: true },
    ...sketches.map((s) => ({ name: s.name, banners: bannersThisWeek(s.banners, week), me: false })),
  ].filter((r) => r.me || r.banners > 0).sort((a, b) => b.banners - a.banners || Number(b.me) - Number(a.me) || a.name.localeCompare(b.name));
  const placed = rows.map((r, i) => ({ ...r, place: i + 1 }));
  return placed.filter((r) => r.place <= BOARD_TOP || r.me);
}

/** Raids left today. */
export const raidsLeft = (e: Empire) => Math.max(0, R.perDay - e.raidsToday);

// ---------------------------------------------------------------------------
// The raid
// ---------------------------------------------------------------------------

/** A classmate's clan as the server loads it to be raided. `empire` may still be an old-shape save. */
export interface RaidTarget {
  id: string;
  name: string;
  empire: Empire | OldEmpire;
  /** Its purse (only needed to convert an old-shape save). */
  gold: number;
  members: Member[];
  village?: Partial<Village>;
}

/** The raided clan's empire in the new shape (an old save is converted in a scratch copy; nothing is saved from it). */
export function targetEmpire(t: RaidTarget): Empire {
  if (t.empire.version === 2) return t.empire;
  const scratch = { name: t.name, members: [], gold: t.gold, followers: 0, village: { trainingHall: 0, smithy: 0, church: 0 }, empire: t.empire } as unknown as Clan;
  return (needsUpgrade(scratch) ? upgradeSave(scratch, t.village) : scratch).empire as Empire;
}

/** A defender as the raid keeps it: everything the fight needs, with the name swapped for its race and class. */
export const defenderCopy = (m: Member): Member => ({ ...structuredClone(m), name: `${m.race} ${m.cls}`, look: lookOf(m), knockedOut: false, hp: m.maxHp, sp: m.maxSp });

/** Everything a raid needs to be played again exactly: kept with the open fight. */
export interface RaidSetup {
  /** The raided clan's public id and name. */
  target: string;
  name: string;
  light: Light;
  defenders: Member[];
  /** Share of the defenders' HP the siege knocked off, and of the raiders' HP the Tower did. */
  breach: number;
  tower: number;
  /** Was the siege question right? Null when there was none or it was skipped. */
  right: boolean | null;
}

/** The siege: your army and Forge against their army and Walls, then their Tower. The same seed gives the same siege. */
export function raidSiege(attacker: Empire, defender: Empire, right: boolean | null, seed: number): { breach: number; tower: number } {
  const S = R.siege;
  const dice = { rng: Math.imul(seed | 0, 0x2c1b3c6d) ^ 0x51ed270b };
  const a = might(attacker.troops) * (1 + attacker.levels.forge * S.forgePer) + S.base;
  const d = might(defender.troops) * (1 + defender.levels.walls * S.wallsPer) + S.base;
  const luck = (90 + roll(dice, 21)) / 100;
  const breach = Math.min(S.most * S.rightBoost, ((S.most * a) / (a + d)) * (right ? S.rightBoost : 1) * luck);
  return { breach: Math.round(breach * 100) / 100, tower: Math.round(defender.levels.tower * S.towerPerLevel * 100) / 100 };
}

function defenderFighter(m: Member, index: number, breach: number): Fighter {
  return {
    side: 'enemy', index, name: m.name, level: m.level, hp: Math.max(1, Math.round(m.maxHp * (1 - breach))), maxHp: m.maxHp, sp: m.maxSp, maxSp: m.maxSp,
    stats: fightStats(m), spells: m.spells, mods: [], tied: 0, guarding: false, difficulty: 0,
  };
}

/** Start a raid's hero fight. Your heroes come fresh (a raid never hurts them), less what the Tower did. */
export function newRaidFight(members: Member[], setup: RaidSetup, seed: number): FightState {
  const fresh = members.map((m) => ({ ...m, knockedOut: false, hp: m.maxHp, sp: m.maxSp }));
  const state = newFight(fresh, 0, seed, false);
  for (const f of state.clan) f.hp = Math.max(1, Math.round(f.maxHp * (1 - setup.tower)));
  state.enemies = setup.defenders.map((m, i) => defenderFighter(m, i, setup.breach));
  state.raid = { defenders: setup.defenders.map((m) => ({ race: m.race, cls: m.cls, look: m.look })) };
  return state;
}

/** Extra gold the Strongroom adds to a raid won or held. */
export const strongroomGold = (e: Empire) => e.levels.strongroom * R.strongroomGold;

/** What the raiders get: a win pays more against a Tough rival (and the Strongroom adds to it); anything else still pays a little. */
export function raidReward(result: FightResult | null, light: Light, e: Empire): { gold: number; banners: number } {
  if (result !== 'won') return { ...R.reward.lost };
  const r = light === 'tough' ? R.reward.wonTough : R.reward.won;
  return { gold: r.gold + strongroomGold(e), banners: r.banners };
}

/** Add Banners for the week `week` (a new week starts from 0). */
export const addBanners = (b: Banners | null | undefined, week: number, n: number): Banners => ({ week, count: bannersThisWeek(b, week) + n });

/** The raided village held: what it is paid (the first few a day), and its new Banners and count. */
export function heldReward(e: Empire, nzDay: number): { gold: number; banners: Banners; held: Held } {
  const paid = e.held && e.held.nzDay === nzDay ? e.held.paid : 0;
  const pays = paid < R.heldPaidPerDay;
  return {
    gold: pays ? R.reward.held.gold + strongroomGold(e) : 0,
    banners: addBanners(e.banners, weekOf(nzDay), pays ? R.reward.held.banners : 0),
    held: { nzDay, paid: pays ? paid + 1 : paid },
  };
}

/** The village news line: clan names only. */
export const raidNews = (raiders: string, raided: string, won: boolean) =>
  won ? `The ${raiders} clan raided the ${raided} clan and won!` : `The ${raided} clan held off a raid by the ${raiders} clan!`;

/** What the raided clan reads next time. */
export const raidNote = (raiders: string, won: boolean, gold: number) =>
  won
    ? `Raiders from the ${raiders} clan got past your walls. Nothing was taken.`
    : `Your village held off raiders from the ${raiders} clan!${gold > 0 ? ` You earned ${gold} gold.` : ''}`;
