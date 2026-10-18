/**
 * The empire: land, buildings, worker energy, troops, the draft, six computer kingdoms, battles,
 * Friendly War, and the rule for raids on classmates. Plain data and plain functions, like
 * `fight.ts`: a battle is settled in one go from two armies, a battle plan and a seed, so the
 * same inputs always give the same answer and the server can replay it.
 *
 * The empire has its own vault. The clan's purse (mine gold) is never at risk; only the vault is.
 * Every number is in `config.ts` (CONFIG.empire).
 */
import { CONFIG } from './config';
import { roll } from './rng';
import { TROOP_KINDS, type BuildingKind, type Clan, type Empire, type Plot, type TroopKind, type Troops } from './types';

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

export function newEmpire(day = 1): Empire {
  return {
    vault: 0, wild: E.startWild, claimed: 0, plots: [], troops: noTroops(), draftPercent: 0, day, createdDay: day,
    energyUsed: 0, raidsToday: 0, kingdomRaidsToday: 0, shieldUntil: 0, raidedToday: [],
  };
}

/** The clan's empire, made the first time it is needed. */
export function empireOf(clan: Clan): Empire {
  return (clan.empire ??= newEmpire());
}

export const BUILDING_NAMES: Record<BuildingKind, string> = {
  barracks: 'Barracks', walls: 'Walls', tower: 'Tower', steelMill: 'Steel Mill', stables: 'Stables', gymnasium: 'Gymnasium', developersHall: "Developer's Hall",
};
export const BUILDING_BLURBS: Record<BuildingKind, string> = {
  barracks: 'A home for troops. Each one holds 20 footmen, 10 axemen and 5 knights.',
  walls: 'Defenders take about 10% less damage, and raiders destroy less.',
  tower: 'Defenders hit back 10% harder.',
  steelMill: 'Your raiding army hits 10% harder.',
  stables: 'Fewer troops fail to come home: 20% fewer lost.',
  gymnasium: 'More villagers volunteer: the draft can go 5% higher.',
  developersHall: 'Developing land costs 10% less.',
};
export const TROOP_NAMES: Record<TroopKind, { one: string; many: string }> = {
  footman: { one: 'footman', many: 'footmen' },
  axeman: { one: 'axeman', many: 'axemen' },
  knight: { one: 'knight', many: 'knights' },
};

// ---------------------------------------------------------------------------
// Land and buildings
// ---------------------------------------------------------------------------

export const area = (width: number, length: number) => width * length;
export const fence = (width: number, length: number) => 2 * (width + length);

export const countBuildings = (e: Empire, kind: BuildingKind) => e.plots.filter((p) => p.building === kind).length;
export const buildingTotal = (e: Empire) => e.plots.filter((p) => p.building).length;
/** Plots with nothing on them: wild land and developed plots with no building. */
export const emptyLand = (e: Empire) => e.wild + e.plots.filter((p) => !p.building).length;

/** What the effect of N buildings of one kind is, in percent (or points), stopping at the most that count. */
export const effect = (e: Empire, kind: BuildingKind) => countBuildings(e, kind) * E.buildings[kind].per;

/** Gold to develop a plot: the squares plus the fence, less the Developer's Hall discount, rounded up. */
export function plotCost(e: Empire, width: number, length: number): number {
  const base = area(width, length) * E.landPerSquare + fence(width, length) * E.fencePerUnit;
  return Math.ceil((base * (100 - effect(e, 'developersHall'))) / 100);
}

export const validSide = (n: number) => Number.isInteger(n) && n >= E.plotSide.min && n <= E.plotSide.max;

/** Gold to claim one more plot of wild land. */
export const claimCost = (e: Empire) => E.claim.base + E.claim.step * e.claimed;

export function claimLand(e: Empire): Done {
  if (e.claimed >= E.claim.max) return no('max', 'There is no more land to claim nearby.');
  const cost = claimCost(e);
  if (e.vault < cost) return no('gold', `Claiming land costs ${cost} gold and the vault has ${e.vault}.`);
  e.vault -= cost;
  e.claimed++;
  e.wild++;
  return ok;
}

/** Turn one piece of wild land into a developed plot. Paid from the empire's vault. */
export function developPlot(e: Empire, width: number, length: number): Done {
  if (!validSide(width) || !validSide(length)) return no('size', `A plot is between ${E.plotSide.min} and ${E.plotSide.max} squares on each side.`);
  if (e.wild < 1) return no('land', 'There is no wild land left to develop.');
  const cost = plotCost(e, width, length);
  if (e.vault < cost) return no('gold', `That plot costs ${cost} gold and the vault has ${e.vault}.`);
  e.vault -= cost;
  e.wild--;
  e.plots.push({ width, length });
  return ok;
}

export const energyLeft = (e: Empire) => E.energyPerDay - e.energyUsed;

/** Can this building go on this plot, and what stops it? */
export function canBuild(e: Empire, plotIndex: number, kind: BuildingKind): Done {
  const plot: Plot | undefined = e.plots[plotIndex];
  const def = E.buildings[kind];
  if (!plot) return no('plot', 'Pick one of your developed plots.');
  if (plot.building) return no('taken', 'That plot already has a building on it.');
  if (area(plot.width, plot.length) < def.size) return no('size', `A ${BUILDING_NAMES[kind]} needs ${def.size} squares and this plot has ${area(plot.width, plot.length)}.`);
  if (countBuildings(e, kind) >= def.max) return no('max', `You already have as many ${BUILDING_NAMES[kind]} as you can use (${def.max}).`);
  if (energyLeft(e) < def.energy) return no('energy', `The ${BUILDING_NAMES[kind]} needs ${def.energy}% of a day's work and only ${energyLeft(e)}% is left today.`);
  if (e.vault < def.gold) return no('gold', `The ${BUILDING_NAMES[kind]} costs ${def.gold} gold and the vault has ${e.vault}.`);
  return ok;
}

export function build(e: Empire, plotIndex: number, kind: BuildingKind): Done {
  const can = canBuild(e, plotIndex, kind);
  if (!can.ok) return can;
  const def = E.buildings[kind];
  e.vault -= def.gold;
  e.energyUsed += def.energy;
  e.plots[plotIndex].building = kind;
  return ok;
}

// ---------------------------------------------------------------------------
// Gold, troops and the draft
// ---------------------------------------------------------------------------

export function deposit(clan: Clan, gold: number): Done {
  const e = empireOf(clan);
  if (!Number.isInteger(gold) || gold < 1) return no('amount', 'Pick a number of gold to move.');
  if (clan.gold < gold) return no('gold', `The clan purse only has ${clan.gold} gold.`);
  clan.gold -= gold;
  e.vault += gold;
  return ok;
}

export function withdraw(clan: Clan, gold: number): Done {
  const e = empireOf(clan);
  if (!Number.isInteger(gold) || gold < 1) return no('amount', 'Pick a number of gold to move.');
  if (e.vault < gold) return no('gold', `The vault only has ${e.vault} gold.`);
  e.vault -= gold;
  clan.gold += gold;
  return ok;
}

export const capacity = (e: Empire, kind: TroopKind) => countBuildings(e, 'barracks') * E.troopCap[kind];
export const room = (e: Empire, kind: TroopKind) => Math.max(0, capacity(e, kind) - e.troops[kind]);

/** How many barracks the troops you have need: the most any one kind asks for. */
export function barracksFor(troops: Troops): { needed: number; kind: TroopKind; count: number; cap: number } {
  let best = { needed: 0, kind: 'footman' as TroopKind, count: troops.footman, cap: E.troopCap.footman };
  for (const kind of TROOP_KINDS) {
    const needed = Math.ceil(troops[kind] / E.troopCap[kind]);
    if (needed > best.needed) best = { needed, kind, count: troops[kind], cap: E.troopCap[kind] };
  }
  return best;
}

export const troopBillOf = (troops: Troops) => TROOP_KINDS.reduce((t, k) => t + troops[k] * E.troopCost[k], 0);

export function buyTroops(e: Empire, kind: TroopKind, n: number): Done {
  if (!Number.isInteger(n) || n < 1) return no('amount', 'Pick how many to buy.');
  if (room(e, kind) < n) return no('room', `The barracks have room for ${room(e, kind)} more ${TROOP_NAMES[kind].many}.`);
  const cost = n * E.troopCost[kind];
  if (e.vault < cost) return no('gold', `That costs ${cost} gold and the vault has ${e.vault}.`);
  e.vault -= cost;
  e.troops[kind] += n;
  return ok;
}

/** The most the draft can ask for: 20%, and 5% more for each Gymnasium. */
export const draftMax = (e: Empire) => E.draftMax + effect(e, 'gymnasium');

export function setDraft(e: Empire, percent: number): Done {
  const most = draftMax(e);
  if (!Number.isInteger(percent) || percent < 0 || percent > most || percent % E.draftStep !== 0) return no('draft', `The draft is 0 to ${most}%, in steps of ${E.draftStep}.`);
  e.draftPercent = percent;
  return ok;
}

/** How many of this many followers the draft asks for (rounded up, like every "percent of" question). */
export const draftWanted = (followers: number, percent: number) => Math.ceil((followers * percent) / 100);

/**
 * Followers join as footmen at the draft share, as far as the barracks have room. All the
 * followers are used up: the ones not drafted go back to their villages.
 */
export function draft(clan: Clan): { wanted: number; joined: number; followers: number } {
  const e = empireOf(clan);
  const followers = clan.followers;
  const wanted = draftWanted(followers, e.draftPercent);
  const joined = Math.min(wanted, room(e, 'footman'));
  e.troops.footman += joined;
  clan.followers = 0;
  return { wanted, joined, followers };
}

/** A new day for the empire: fresh worker energy and raids. (A shield ends by itself when the day number passes it.) */
export function empireNewDay(clan: Clan): void {
  const e = empireOf(clan);
  e.day++;
  e.energyUsed = 0;
  e.raidsToday = 0;
  e.kingdomRaidsToday = 0;
  e.raidedToday = [];
}

// ---------------------------------------------------------------------------
// Armies, computer kingdoms and battles
// ---------------------------------------------------------------------------

/** What an army is worth in a battle: footmen 1, axemen 2, knights 4. */
export const might = (t: Troops) => TROOP_KINDS.reduce((s, k) => s + t[k] * E.troopMight[k], 0);

/** One side of a battle. */
export interface Side {
  troops: Troops;
  walls: number;
  towers: number;
  mills: number;
  stables: number;
}

export const sideOf = (e: Empire): Side => ({
  troops: { ...e.troops }, walls: countBuildings(e, 'walls'), towers: countBuildings(e, 'tower'), mills: countBuildings(e, 'steelMill'), stables: countBuildings(e, 'stables'),
});

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
export const kingdomSide = (k: Kingdom): Side => ({ troops: { ...k.troops }, walls: k.walls, towers: k.towers, mills: 0, stables: 0 });

export type Push = keyof typeof E.battle.push;
export const PUSHES = Object.keys(E.battle.push) as Push[];
export const PUSH_NAMES: Record<Push, string> = { careful: 'Careful', steady: 'Steady', bold: 'Bold' };

/** The battle plan: how many rounds, how hard, how much loot you ask for (a percent). */
export interface BattlePlan {
  rounds: number;
  push: Push;
  loot: number;
}

/** A plan with every part forced into what is allowed. */
export function cleanPlan(plan: Partial<BattlePlan>, lootMax: number = Math.max(...E.battle.lootChoices)): BattlePlan {
  const rounds = Math.min(E.battle.maxRounds, Math.max(1, Math.round(plan.rounds ?? 3)));
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

function lost(troops: Troops, start: number, left: number, stables: number): Troops {
  const hurt = start > 0 ? (start - left) / start : 0;
  const keep = Math.max(0, 100 - stables * E.buildings.stables.per) / 100;
  const out = noTroops();
  for (const k of TROOP_KINDS) out[k] = Math.min(troops[k], Math.floor(troops[k] * hurt * E.battle.lossShare * keep));
  return out;
}

/**
 * Settle a whole battle. Each round both sides lose about a quarter of what they have left, a
 * little more or less by luck. Mills add to the attacker's damage, walls cut the damage the
 * defender takes, towers add to the defender's; asking for more loot makes the defenders fight
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
    const outA = (1 + (attacker.mills * E.buildings.steelMill.per) / 100) * push.hit;
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
    attackerLost: lost(attacker.troops, startA, a, attacker.stables),
    defenderLost: lost(defender.troops, startD, d, defender.stables),
  };
}

function takeLosses(e: Empire, lostTroops: Troops): void {
  for (const k of TROOP_KINDS) e.troops[k] -= lostTroops[k];
}

/** Gold a raid takes from a treasury: the share asked for, rounded up like every "percent of" question, never more than there is. */
export const lootGold = (treasury: number, percent: number) => Math.min(treasury, Math.ceil((treasury * percent) / 100));

export type KingdomRaid = Fail | { ok: true; result: BattleResult; gold: number };

/** Raid a computer kingdom: your army fights, you lose the troops that do not come home, and a win takes loot into the vault. */
export function raidKingdom(e: Empire, kingdomId: string, plan: Partial<BattlePlan>, seed: number): KingdomRaid {
  const k = kingdomById(kingdomId);
  if (!k) return no('kingdom', 'Pick one of the six kingdoms.');
  if (might(e.troops) === 0) return no('army', 'You need some troops to send.');
  if (e.kingdomRaidsToday >= E.raids.kingdomPerDay) return no('limit', `You have already raided ${E.raids.kingdomPerDay} times today. Try again tomorrow, or have a Friendly War.`);
  const result = battle(sideOf(e), kingdomSide(k), plan, seed);
  e.kingdomRaidsToday++;
  takeLosses(e, result.attackerLost);
  const gold = result.outcome === 'won' ? lootGold(k.treasury, result.plan.loot) : 0;
  e.vault += gold;
  return { ok: true, result, gold };
}

/** Friendly War: the same battle, but nobody loses or wins anything, and it does not count as a raid. */
export function friendlyWar(e: Empire, kingdomId: string, plan: Partial<BattlePlan>, seed: number): Fail | { ok: true; result: BattleResult } {
  const k = kingdomById(kingdomId);
  if (!k) return no('kingdom', 'Pick one of the six kingdoms.');
  if (might(e.troops) === 0) return no('army', 'You need some troops to send.');
  return { ok: true, result: battle(sideOf(e), kingdomSide(k), plan, seed) };
}

// ---------------------------------------------------------------------------
// Raids on classmates (the rule only: no screens and no saving yet)
// ---------------------------------------------------------------------------

export type Take = 'gold' | 'land' | 'buildings';

/** A classmate empire as the rules see it. `id` is private: news only ever shows the clan name. */
export interface Party {
  id: string;
  empire: Empire;
}

/** Why a classmate raid is not allowed, or null if it is. `raidsOn` is the teacher's switch. */
export function raidRefusal(attacker: Party, defender: Party, today: number, raidsOn = true): { why: string; say: string } | null {
  const a = attacker.empire;
  const d = defender.empire;
  const r = E.raids;
  if (!raidsOn) return { why: 'off', say: 'Your teacher has switched raids on classmates off.' };
  if (attacker.id === defender.id) return { why: 'self', say: 'You cannot raid your own empire.' };
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
  /** Gold taken, plots of land taken, or buildings destroyed (all 0 unless the raiders won). */
  gold: number;
  land: number;
  destroyed: BuildingKind[];
}

/** The shortest news line, safe to show: the raiders' clan name and what happened, never a student's name. */
export function raidNews(raiderClan: string, raid: ClassmateRaid): string {
  if (raid.result.outcome !== 'won') return `A raider from the ${raiderClan} clan was driven off.`;
  if (raid.take === 'gold') return `A raider from the ${raiderClan} clan took ${raid.gold} gold.`;
  if (raid.take === 'land') return `A raider from the ${raiderClan} clan took ${raid.land} ${raid.land === 1 ? 'plot' : 'plots'} of land.`;
  return `A raider from the ${raiderClan} clan knocked down ${raid.destroyed.length} ${raid.destroyed.length === 1 ? 'building' : 'buildings'}.`;
}

/**
 * Raid a classmate. The defender is a saved copy played by the computer (same battle, steady
 * defence). Loot is at most 10%. A win takes gold, land or buildings; buildings are made harder
 * to knock down by Walls. Both sides lose the troops that do not come home, and the defender gets a shield.
 */
export function raidClassmate(attacker: Party, defender: Party, take: Take, planIn: Partial<BattlePlan>, seed: number, today: number, raidsOn = true): Fail | ({ ok: true } & ClassmateRaid) {
  const refused = raidRefusal(attacker, defender, today, raidsOn);
  if (refused) return { ok: false, ...refused };
  const a = attacker.empire;
  const d = defender.empire;
  const plan = cleanPlan(planIn, E.raids.classmateLootMax);
  const result = battle(sideOf(a), sideOf(d), plan, seed);
  const dice = { rng: (seed ^ 0x5bd1e995) | 0 };
  a.raidsToday++;
  a.raidedToday.push(defender.id);
  d.shieldUntil = today + E.raids.shieldDays;
  takeLosses(a, result.attackerLost);
  takeLosses(d, result.defenderLost);
  const out: ClassmateRaid = { result, take, gold: 0, land: 0, destroyed: [] };
  if (result.outcome === 'won') {
    if (take === 'gold') {
      out.gold = lootGold(d.vault, plan.loot);
      d.vault -= out.gold;
      a.vault += out.gold;
    } else if (take === 'land') {
      out.land = Math.min(emptyLand(d), Math.ceil((emptyLand(d) * plan.loot) / 100));
      for (let i = 0; i < out.land; i++) {
        if (d.wild > 0) d.wild--;
        else d.plots.splice(d.plots.map((p) => !p.building).lastIndexOf(true), 1);
      }
      a.wild += out.land;
    } else {
      const walls = countBuildings(d, 'walls');
      const count = Math.max(0, Math.ceil((buildingTotal(d) * plan.loot) / 100) - walls);
      for (let i = 0; i < count; i++) {
        const hit = d.plots.map((p, n) => (p.building && p.building !== 'walls' ? n : -1)).filter((n) => n >= 0);
        if (hit.length === 0) break;
        const plot = d.plots[hit[roll(dice, hit.length)]];
        out.destroyed.push(plot.building as BuildingKind);
        plot.building = undefined;
      }
    }
  }
  return { ok: true, ...out };
}
