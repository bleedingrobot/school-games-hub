/**
 * The empire ("My Village"): eight buildings with levels, troops, six computer kingdoms, battles,
 * Friendly War, and the rule for raids on classmates. Plain data and plain functions, like
 * `fight.ts`: a battle is settled in one go from two armies, a battle plan and a seed, so the
 * same inputs always give the same answer and the server can replay it.
 *
 * There is one purse, `clan.gold`: it pays for upgrades and troops, and a raider can take a share
 * of it (the Strongroom keeps some safe). `empire.levels` is the truth about building levels;
 * `clan.village` is only a copy of three of them, refreshed by `syncVillage`.
 * Every number is in `config.ts` (CONFIG.empire).
 */
import { CONFIG } from './config';
import { roll } from './rng';
import {
  BUILDING_KINDS, TROOP_KINDS, VILLAGE_BUILDINGS,
  type Clan, type Empire, type Levels, type OldEmpire, type TroopKind, type Troops, type Village, type VillageBuilding,
} from './types';

const E = CONFIG.empire;

/** Why something was not allowed: a short code for the code, and a kind sentence for the child. */
export interface Fail {
  ok: false;
  why: string;
  say: string;
}
export type Done = { ok: true } | Fail;
const ok = { ok: true } as const;
const no = (why: string, say: string): Fail => ({ ok: false, why, say });

export const noTroops = (): Troops => ({ footman: 0, axeman: 0, knight: 0 });
export const noLevels = (): Levels => ({ trainingHall: 0, smithy: 0, church: 0, barracks: 0, walls: 0, tower: 0, forge: 0, strongroom: 0 });

export function newEmpire(day = 1): Empire {
  return { version: 2, levels: noLevels(), buildsToday: 0, troops: noTroops(), day, createdDay: day, raidsToday: 0, kingdomRaidsToday: 0, shieldUntil: 0, raidedToday: [] };
}

export const BUILDING_NAMES: Record<VillageBuilding, string> = {
  trainingHall: 'Training Hall', smithy: 'Smithy', church: 'Church', barracks: 'Barracks', walls: 'Walls', tower: 'Tower', forge: 'Forge', strongroom: 'Strongroom',
};
export const BUILDING_BLURBS: Record<VillageBuilding, string> = {
  trainingHall: 'Training is cheaper for everyone in your clan.',
  smithy: 'The shop sells better things.',
  church: 'One more free wake-up a day.',
  barracks: 'Room for 20 footmen, 10 axemen and 5 knights for each level.',
  walls: 'Raiders do 10% less damage for each level, and fewer buildings get knocked down.',
  tower: 'Defenders hit back 10% harder for each level.',
  forge: 'Your raiders hit 10% harder for each level.',
  strongroom: 'Keeps 200 gold safe from raiders for each level.',
};
export const TROOP_NAMES: Record<TroopKind, { one: string; many: string }> = {
  footman: { one: 'footman', many: 'footmen' },
  axeman: { one: 'axeman', many: 'axemen' },
  knight: { one: 'knight', many: 'knights' },
};

// ---------------------------------------------------------------------------
// Saves: telling the two shapes apart and converting the old one
// ---------------------------------------------------------------------------

/** A clan as it may be saved: its empire may still be in the old shape (or missing). */
export type SavedClan = Omit<Clan, 'empire'> & { empire?: Empire | OldEmpire };

/** True if this save still has to go through `upgradeSave` (an old empire, or none at all). */
export const needsUpgrade = (clan: SavedClan) => clan.empire?.version !== 2;

export const maxLevel = (b: VillageBuilding) => E.buildings[b].max;
const clampLevel = (b: VillageBuilding, n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(maxLevel(b), Math.floor(n))) : 0);

/** Gold an old plot cost to develop, at full price (no Developer's Hall discount). */
const oldPlotPrice = (width: number, length: number) => width * length * E.legacy.landPerSquare + 2 * (width + length) * E.legacy.fencePerUnit;

/**
 * Convert a saved clan to the "My Village" shape. Pure (the clan that comes in is not changed) and idempotent: a clan
 * whose empire already has `version: 2` comes back as an unchanged copy, so a save is converted only once.
 *
 * - Vault gold goes into the purse.
 * - Training Hall, Smithy and Church take the levels of the class (group) village passed in, or the clan's own `village` if none.
 * - Barracks, Walls and Tower keep their count of buildings as a level, Steel Mills become the Forge, all capped at the top level.
 * - Spare developed plots (no building) give back their develop price; Stables, Gymnasiums and Developer's Halls give back their gold price.
 *   Wild and claimed land gives nothing.
 * - Troops, the day, raid counts, shield and who was raided today are kept.
 */
export function upgradeSave(clan: SavedClan, groupVillage?: Partial<Village> | null): Clan {
  const copy = structuredClone(clan);
  if (copy.empire?.version === 2) return copy as Clan;
  const old = copy.empire as OldEmpire | undefined;
  const from = { ...copy.village, ...(groupVillage ?? {}) };
  const levels = noLevels();
  for (const b of ['trainingHall', 'smithy', 'church'] as const) levels[b] = clampLevel(b, from[b]);
  const e = newEmpire(old?.day ?? 1);
  if (old) {
    const count = (kind: (typeof BUILDING_KINDS)[number]) => (old.plots ?? []).filter((p) => p.building === kind).length;
    let refund = Math.max(0, Math.floor(old.vault ?? 0));
    // Each old building becomes a level; any beyond the top level are paid back at their old price.
    for (const [oldKind, b] of [['barracks', 'barracks'], ['walls', 'walls'], ['tower', 'tower'], ['steelMill', 'forge']] as const) {
      levels[b] = clampLevel(b, count(oldKind));
      refund += Math.max(0, count(oldKind) - levels[b]) * E.legacy.buildings[oldKind].gold;
    }
    for (const p of old.plots ?? []) if (!p.building) refund += oldPlotPrice(p.width, p.length);
    for (const kind of ['stables', 'gymnasium', 'developersHall'] as const) refund += count(kind) * E.legacy.buildings[kind].gold;
    copy.gold += refund;
    e.troops = { ...noTroops(), ...old.troops };
    e.createdDay = old.createdDay;
    e.raidsToday = old.raidsToday;
    e.kingdomRaidsToday = old.kingdomRaidsToday;
    e.shieldUntil = old.shieldUntil;
    e.raidedToday = [...(old.raidedToday ?? [])];
  }
  e.levels = levels;
  copy.empire = e;
  syncVillage(copy as Clan);
  return copy as Clan;
}

/** The clan's empire, made the first time it is needed. An old-shape empire is converted on the spot (using the clan's own `village`). */
export function empireOf(clan: Clan): Empire {
  if (!clan.empire || clan.empire.version !== 2) {
    const up = upgradeSave(clan);
    clan.gold = up.gold;
    clan.village = up.village;
    clan.empire = up.empire;
  }
  return clan.empire as Empire;
}

// ---------------------------------------------------------------------------
// Levels and upgrades
// ---------------------------------------------------------------------------

/** The level of one building. */
export const levelOf = (clan: Clan, b: VillageBuilding): number => empireOf(clan).levels[b];

/** Refresh `clan.village` (the copy of the Training Hall, Smithy and Church levels) from the empire. */
export function syncVillage(clan: Clan): void {
  const l = empireOf(clan).levels;
  clan.village = { trainingHall: l.trainingHall, smithy: l.smithy, church: l.church };
}

/** Gold to take `b` up to level `toLevel`: the base price times the level. */
export const upgradeCost = (b: VillageBuilding, toLevel: number) => E.buildings[b].base * toLevel;

/** The most gold every building could ever cost, for the simulator and "how far along am I". */
export const totalCostToMax = () => VILLAGE_BUILDINGS.reduce((t, b) => t + E.buildings[b].base * ((maxLevel(b) * (maxLevel(b) + 1)) / 2), 0);

/** Builds left to use: today's that are not done yet, plus the saved ones. */
export const buildsLeft = (e: Empire) => Math.max(0, E.buildsPerDay - e.buildsToday) + (e.buildsSaved ?? 0);

/** All the levels the village could ever have (39). */
export const VILLAGE_TOTAL = VILLAGE_BUILDINGS.reduce((t, b) => t + E.buildings[b].max, 0);
/** The levels built so far, added up (the "Village 23 / 39" number). Same as `levelTotal`. */
export const villageLevels = (e: Empire): number => levelTotal(e);
/** True when every building is at its top level. */
export const villageComplete = (e: Empire): boolean => VILLAGE_BUILDINGS.every((b) => e.levels[b] >= maxLevel(b));

/** The building plan for taking `b` up to `level`: the shape the area and fence questions are asked about. Grows with the level. */
export const planOf = (b: VillageBuilding, level: number): { width: number; length: number } => ({ width: E.planWidth[b], length: level + E.planLengthExtra });
export const area = (width: number, length: number) => width * length;
export const fence = (width: number, length: number) => 2 * (width + length);

/** Can this building go up a level now, and what stops it? */
export function canUpgrade(clan: Clan, b: VillageBuilding): Done {
  const e = empireOf(clan);
  if (!VILLAGE_BUILDINGS.includes(b)) return no('building', 'Pick one of the buildings in your village.');
  const level = e.levels[b];
  if (level >= maxLevel(b)) return no('max', `The ${BUILDING_NAMES[b]} is already as big as it can be.`);
  if (buildsLeft(e) <= 0) return no('builds', 'Your builders have done every job they can. They start again tomorrow!');
  const cost = upgradeCost(b, level + 1);
  if (clan.gold < cost) return no('gold', `The ${BUILDING_NAMES[b]} (level ${level + 1}) costs ${cost} gold and the clan has ${clan.gold}.`);
  return ok;
}

/** Pay for one level of a building from the purse. Uses one of today's builds first, a saved one only when today's are gone. */
export function upgrade(clan: Clan, b: VillageBuilding): Done {
  const can = canUpgrade(clan, b);
  if (!can.ok) return can;
  const e = empireOf(clan);
  clan.gold -= upgradeCost(b, e.levels[b] + 1);
  e.levels[b]++;
  if (e.buildsToday < E.buildsPerDay) e.buildsToday++;
  else e.buildsSaved = Math.max(0, (e.buildsSaved ?? 0) - 1);
  syncVillage(clan);
  if (b === 'barracks') joinFollowers(clan);
  return ok;
}

// ---------------------------------------------------------------------------
// Gold, troops and followers
// ---------------------------------------------------------------------------

/** Gold raiders cannot take: 200 for each Strongroom level. */
export const safeGold = (e: Empire) => e.levels.strongroom * E.buildings.strongroom.per;

export const capacity = (e: Empire, kind: TroopKind) => e.levels.barracks * E.troopCap[kind];
export const room = (e: Empire, kind: TroopKind) => Math.max(0, capacity(e, kind) - e.troops[kind]);

/** How many levels of Barracks the troops you have need: the most any one kind asks for. */
export function barracksFor(troops: Troops): { needed: number; kind: TroopKind; count: number; cap: number } {
  let best = { needed: 0, kind: 'footman' as TroopKind, count: troops.footman, cap: E.troopCap.footman };
  for (const kind of TROOP_KINDS) {
    const needed = Math.ceil(troops[kind] / E.troopCap[kind]);
    if (needed > best.needed) best = { needed, kind, count: troops[kind], cap: E.troopCap[kind] };
  }
  return best;
}

export const troopBillOf = (troops: Troops) => TROOP_KINDS.reduce((t, k) => t + troops[k] * E.troopCost[k], 0);

/** Buy troops from the purse, as far as the Barracks have room. */
export function buyTroops(clan: Clan, kind: TroopKind, n: number): Done {
  const e = empireOf(clan);
  if (!Number.isInteger(n) || n < 1) return no('amount', 'Pick how many to buy.');
  if (room(e, kind) < n) return no('room', `The barracks have room for ${room(e, kind)} more ${TROOP_NAMES[kind].many}.`);
  const cost = n * E.troopCost[kind];
  if (clan.gold < cost) return no('gold', `That costs ${cost} gold and the clan has ${clan.gold}.`);
  clan.gold -= cost;
  e.troops[kind] += n;
  return ok;
}

/**
 * Followers join by themselves: as footmen, as far as the Barracks have room. The rest stay as followers
 * (and join later, when there is room). Returns how many joined.
 */
export function joinFollowers(clan: Clan): number {
  const e = empireOf(clan);
  const joined = Math.min(Math.max(0, clan.followers), room(e, 'footman'));
  e.troops.footman += joined;
  clan.followers -= joined;
  return joined;
}

/**
 * A new day for the empire: fresh builds and raids. Builds not used (today's, and a full set for each day `missedDays` skipped)
 * are saved, up to `buildsSavedMax`. (A shield ends by itself when the day number passes it.)
 */
export function empireNewDay(clan: Clan, missedDays = 0): void {
  const e = empireOf(clan);
  e.day++;
  const unused = Math.max(0, E.buildsPerDay - e.buildsToday) + Math.max(0, missedDays) * E.buildsPerDay;
  e.buildsSaved = Math.min(E.buildsSavedMax, (e.buildsSaved ?? 0) + unused);
  e.buildsToday = 0;
  e.raidsToday = 0;
  e.kingdomRaidsToday = 0;
  e.raidedToday = [];
}

// ---------------------------------------------------------------------------
// Armies, computer kingdoms and battles
// ---------------------------------------------------------------------------

/** What an army is worth in a battle: footmen 1, axemen 2, knights 4. */
export const might = (t: Troops) => TROOP_KINDS.reduce((s, k) => s + t[k] * E.troopMight[k], 0);

/** One side of a battle. `walls`, `towers` and `forge` are building levels. */
export interface Side {
  troops: Troops;
  walls: number;
  towers: number;
  forge: number;
}

export const sideOf = (e: Empire): Side => ({ troops: { ...e.troops }, walls: e.levels.walls, towers: e.levels.tower, forge: e.levels.forge });

export interface Kingdom {
  id: string;
  name: string;
  /** How it is shown to children. */
  feel: string;
  blurb: string;
  troops: Troops;
  walls: number;
  towers: number;
  /** The gold a raider can take a share of. It fills up again every day. */
  treasury: number;
}

export const KINGDOMS: Kingdom[] = [
  { id: 'bunny-hollow', name: 'Bunny Hollow', feel: 'an easy one', blurb: 'A sleepy village with a few farmers on guard.', troops: { footman: 12, axeman: 0, knight: 0 }, walls: 0, towers: 0, treasury: 300 },
  { id: 'pebble-bridge', name: 'Pebble Bridge', feel: 'quite easy', blurb: 'Bridge keepers who like a quiet life.', troops: { footman: 24, axeman: 6, knight: 0 }, walls: 0, towers: 0, treasury: 600 },
  { id: 'hilltop-hold', name: 'Hilltop Hold', feel: 'a fair fight', blurb: 'A hill fort with a sturdy fence.', troops: { footman: 40, axeman: 15, knight: 3 }, walls: 1, towers: 0, treasury: 1000 },
  { id: 'ironwood', name: 'Ironwood', feel: 'a bit tough', blurb: 'Woodcutters with very sharp axes.', troops: { footman: 50, axeman: 30, knight: 6 }, walls: 2, towers: 1, treasury: 1600 },
  { id: 'stormcrag', name: 'Stormcrag', feel: 'tough', blurb: 'A castle on a windy cliff.', troops: { footman: 60, axeman: 40, knight: 14 }, walls: 3, towers: 2, treasury: 2500 },
  { id: 'dragons-rest', name: "Dragon's Rest", feel: 'very tough', blurb: 'The biggest kingdom around, with tall walls.', troops: { footman: 80, axeman: 50, knight: 25 }, walls: 4, towers: 4, treasury: 3700 },
];
export const kingdomById = (id: string) => KINGDOMS.find((k) => k.id === id);
export const kingdomSide = (k: Kingdom): Side => ({ troops: { ...k.troops }, walls: k.walls, towers: k.towers, forge: 0 });

export type Push = keyof typeof E.battle.push;
export const PUSHES = Object.keys(E.battle.push) as Push[];
export const PUSH_NAMES: Record<Push, string> = { careful: 'Careful', steady: 'Steady', bold: 'Bold' };

/** The battle plan: how many rounds, how hard, how much loot you ask for (a percent). A raid or Friendly War only lets you choose the push; see `fixedPlan`. */
export interface BattlePlan {
  rounds: number;
  push: Push;
  loot: number;
}

/** The plan a raid or Friendly War plays: the child's push, 3 rounds, 10% loot. */
export const fixedPlan = (push: Push): BattlePlan => ({ rounds: E.battle.rounds, push, loot: E.battle.loot });

/** A plan with every part forced into what is allowed. */
export function cleanPlan(plan: Partial<BattlePlan>, lootMax: number = Math.max(...E.battle.lootChoices)): BattlePlan {
  const rounds = Math.min(E.battle.maxRounds, Math.max(1, Math.round(plan.rounds ?? E.battle.rounds)));
  const push: Push = plan.push && PUSHES.includes(plan.push) ? plan.push : 'steady';
  const choices = E.battle.lootChoices.filter((c) => c <= lootMax);
  const asked = plan.loot ?? choices[0];
  const loot = [...choices].reverse().find((c) => c <= asked) ?? choices[0];
  return { rounds, push, loot };
}

export interface RoundReport {
  round: number;
  /** Strength left on each side after the round. */
  attacker: number;
  defender: number;
}

export type BattleOutcome = 'won' | 'lost' | 'stalemate';

export interface BattleResult {
  outcome: BattleOutcome;
  plan: BattlePlan;
  startAttacker: number;
  startDefender: number;
  rounds: RoundReport[];
  /** Troops that do not come home. */
  attackerLost: Troops;
  defenderLost: Troops;
}

function lost(troops: Troops, start: number, left: number): Troops {
  const hurt = start > 0 ? (start - left) / start : 0;
  const out = noTroops();
  for (const k of TROOP_KINDS) out[k] = Math.min(troops[k], Math.floor(troops[k] * hurt * E.battle.lossShare));
  return out;
}

/**
 * Settle a whole battle. Each round both sides lose about a quarter of what they have left, a
 * little more or less by luck. The Forge adds to the attacker's damage, each Walls level cuts the damage the
 * defender takes by 10%, the Tower adds to the defender's; asking for more loot makes the defenders fight
 * harder. When the rounds are over, the defenders have given way if they are down to half
 * strength and worse off than the attackers; if the attackers are worse off they fall back; if
 * not, it is a stalemate and nobody wins. A careful push does less damage but takes much less,
 * a bold one does more but takes more, so more rounds means more troops hurt on both sides.
 * Nothing is taken from either side here: `raidKingdom` and `raidClassmate` do that.
 */
export function battle(attacker: Side, defender: Side, planIn: Partial<BattlePlan>, seed: number): BattleResult {
  const plan = cleanPlan(planIn);
  const dice = { rng: seed | 0 };
  const b = E.battle;
  const push = b.push[plan.push];
  const startA = might(attacker.troops);
  const startD = might(defender.troops);
  let a = startA;
  let d = startD;
  const rounds: RoundReport[] = [];
  let outcome: BattleOutcome = 'stalemate';
  if (startA === 0) outcome = 'lost';
  else if (startD === 0) outcome = 'won';
  else {
    const outA = (1 + (attacker.forge * E.buildings.forge.per) / 100) * push.hit;
    const outD = (1 + (defender.towers * E.buildings.tower.per) / 100) * (1 + plan.loot / 100) * push.takes;
    const soak = 1 + (defender.walls * E.buildings.walls.per) / 100;
    for (let r = 1; r <= plan.rounds; r++) {
      const toD = Math.floor((a * outA * b.roundDamage * (b.luck.min + roll(dice, b.luck.span))) / 100 / soak);
      const toA = Math.floor((d * outD * b.roundDamage * (b.luck.min + roll(dice, b.luck.span))) / 100);
      d = Math.max(0, d - toD);
      a = Math.max(0, a - toA);
      rounds.push({ round: r, attacker: a, defender: d });
      if (a === 0 || d === 0) break;
    }
    const aLeft = a / startA;
    const dLeft = d / startD;
    // The defenders give way if they are down to half strength and worse off than the attackers; the attackers fall back if the defenders are better off.
    outcome = dLeft < aLeft && dLeft <= b.retreatAt ? 'won' : aLeft < dLeft ? 'lost' : 'stalemate';
  }
  return {
    outcome, plan, startAttacker: startA, startDefender: startD, rounds,
    attackerLost: lost(attacker.troops, startA, a),
    defenderLost: lost(defender.troops, startD, d),
  };
}

function takeLosses(e: Empire, lostTroops: Troops): void {
  for (const k of TROOP_KINDS) e.troops[k] -= lostTroops[k];
}

/** Gold a raid takes from a treasury: the share asked for, rounded up like every "percent of" question, never more than there is. */
export const lootGold = (treasury: number, percent: number) => Math.min(treasury, Math.ceil((treasury * percent) / 100));

export type KingdomRaid = Fail | { ok: true; result: BattleResult; gold: number };

/** Raid a computer kingdom: your army fights, you lose the troops that do not come home, and a win takes loot into the purse. */
export function raidKingdom(clan: Clan, kingdomId: string, push: Push, seed: number): KingdomRaid {
  const e = empireOf(clan);
  const k = kingdomById(kingdomId);
  if (!k) return no('kingdom', 'Pick one of the six kingdoms.');
  if (might(e.troops) === 0) return no('army', 'You need some troops to send.');
  if (e.kingdomRaidsToday >= E.raids.kingdomPerDay) return no('limit', `You have already raided ${E.raids.kingdomPerDay} times today. Try again tomorrow, or have a Friendly War.`);
  const result = battle(sideOf(e), kingdomSide(k), fixedPlan(push), seed);
  e.kingdomRaidsToday++;
  takeLosses(e, result.attackerLost);
  const gold = result.outcome === 'won' ? lootGold(k.treasury, result.plan.loot) : 0;
  clan.gold += gold;
  return { ok: true, result, gold };
}

/** Friendly War: the same battle, but nobody loses or wins anything, and it does not count as a raid. */
export function friendlyWar(e: Empire, kingdomId: string, push: Push, seed: number): Fail | { ok: true; result: BattleResult } {
  const k = kingdomById(kingdomId);
  if (!k) return no('kingdom', 'Pick one of the six kingdoms.');
  if (might(e.troops) === 0) return no('army', 'You need some troops to send.');
  return { ok: true, result: battle(sideOf(e), kingdomSide(k), fixedPlan(push), seed) };
}

// ---------------------------------------------------------------------------
// Raids on classmates
// ---------------------------------------------------------------------------

export type Take = 'gold' | 'buildings';
export const TAKES: readonly Take[] = ['gold', 'buildings'];

/** A classmate clan as the rules see it. `id` is private: news only ever shows the clan name. `gold` is its purse. */
export interface Party {
  id: string;
  empire: Empire;
  gold: number;
}

/** Why a classmate raid is not allowed, or null if it is. `raidsOn` is the teacher's switch. */
export function raidRefusal(attacker: Party, defender: Party, today: number, raidsOn = true): { why: string; say: string } | null {
  const a = attacker.empire;
  const d = defender.empire;
  const r = E.raids;
  if (!raidsOn) return { why: 'off', say: 'Your teacher has switched raids on classmates off.' };
  if (attacker.id === defender.id) return { why: 'self', say: 'You cannot raid your own village.' };
  if (today < a.createdDay + r.newClanDays) return { why: 'new-attacker', say: `Your clan is new. Raids on classmates start on day ${a.createdDay + r.newClanDays}.` };
  if (today < d.createdDay + r.newClanDays) return { why: 'new-defender', say: 'That clan is brand new and is still protected.' };
  if (a.raidsToday >= r.perDay) return { why: 'limit', say: `You have already raided ${r.perDay === 1 ? 'once' : `${r.perDay} times`} today.` };
  if (a.raidedToday.includes(defender.id)) return { why: 'same', say: 'You already raided that clan today.' };
  if (today <= d.shieldUntil) return { why: 'shield', say: 'That clan was raided recently and is resting behind its shield.' };
  const mine = might(a.troops);
  const theirs = might(d.troops);
  if (mine === 0) return { why: 'army', say: 'You need some troops to send.' };
  if (theirs * r.fairRatio < mine || mine * r.fairRatio < theirs) return { why: 'unfair', say: 'That clan is not a fair match for the size of your army.' };
  return null;
}

export interface ClassmateRaid {
  result: BattleResult;
  take: Take;
  /** Gold taken (0 unless the raiders won). */
  gold: number;
  /** One entry for each level knocked off a building (empty unless the raiders won). */
  destroyed: VillageBuilding[];
}

/** The shortest news line, safe to show: the raiders' clan name and what happened, never a student's name. */
export function raidNews(raiderClan: string, raid: ClassmateRaid): string {
  if (raid.result.outcome !== 'won') return `A raider from the ${raiderClan} clan was driven off.`;
  if (raid.take === 'gold') return `A raider from the ${raiderClan} clan took ${raid.gold} gold.`;
  return `A raider from the ${raiderClan} clan knocked ${raid.destroyed.length} ${raid.destroyed.length === 1 ? 'level' : 'levels'} off the buildings.`;
}

/** Buildings a raid may damage: everything except the Walls and the Strongroom. */
export const RAIDABLE: readonly VillageBuilding[] = VILLAGE_BUILDINGS.filter((b) => b !== 'walls' && b !== 'strongroom' && b !== 'barracks');

/** All the levels of all the buildings added up (what "10% of the buildings" is worked out from). */
export const levelTotal = (e: Empire) => VILLAGE_BUILDINGS.reduce((t, b) => t + e.levels[b], 0);

/**
 * Raid a classmate. The defender is a saved copy played by the computer (same battle, steady
 * defence). Loot is 10%. A win takes gold (10% of the purse above the Strongroom's safe gold) or knocks levels off
 * buildings (10% of all the levels, rounded up, less one for each Walls level; never the Walls or the Strongroom).
 * Both sides lose the troops that do not come home, and the defender gets a shield. Both purses are in the parties.
 */
export function raidClassmate(attacker: Party, defender: Party, take: Take, push: Push, seed: number, today: number, raidsOn = true): Fail | ({ ok: true } & ClassmateRaid) {
  const refused = raidRefusal(attacker, defender, today, raidsOn);
  if (refused) return { ok: false, ...refused };
  if (!TAKES.includes(take)) return no('take', 'Pick gold or buildings.');
  const a = attacker.empire;
  const d = defender.empire;
  const plan = cleanPlan(fixedPlan(push), E.raids.classmateLootMax);
  const result = battle(sideOf(a), sideOf(d), plan, seed);
  const dice = { rng: (seed ^ 0x5bd1e995) | 0 };
  a.raidsToday++;
  a.raidedToday.push(defender.id);
  d.shieldUntil = today + E.raids.shieldDays;
  takeLosses(a, result.attackerLost);
  takeLosses(d, result.defenderLost);
  const out: ClassmateRaid = { result, take, gold: 0, destroyed: [] };
  if (result.outcome === 'won') {
    if (take === 'gold') {
      out.gold = lootGold(Math.max(0, defender.gold - safeGold(d)), plan.loot);
      defender.gold -= out.gold;
      attacker.gold += out.gold;
    } else {
      const count = Math.max(0, Math.ceil((levelTotal(d) * plan.loot) / 100) - d.levels.walls);
      for (let i = 0; i < count; i++) {
        const hit = RAIDABLE.filter((b) => d.levels[b] > 0);
        if (hit.length === 0) break;
        const b = hit[roll(dice, hit.length)];
        d.levels[b]--;
        out.destroyed.push(b);
      }
    }
  }
  return { ok: true, ...out };
}
