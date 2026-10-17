/**
 * A sensible, not clever, empire builder. Used by the simulator to see whether a clan can afford
 * a real empire in a few weeks, and whether the computer kingdoms can be beaten at the right level.
 * It does what a careful child would: save the surplus, build in a sensible order, fill the
 * barracks, try a Friendly War to test a plan, and only then raid.
 */
import { CONFIG } from './config';
import { KINGDOMS, area, build, buyTroops, claimLand, countBuildings, deposit, developPlot, draft, draftMax, effect, empireOf, friendlyWar, might, plotCost, raidKingdom, room, setDraft, type BattlePlan } from './empire';
import type { BuildingKind, Clan, Empire } from './types';

const E = CONFIG.empire;

/** What to build, in order: homes for troops first, then defence, then the rest. */
export const BUILD_ORDER: BuildingKind[] = [
  'barracks', 'barracks', 'tower', 'walls', 'barracks', 'steelMill', 'gymnasium', 'walls', 'tower', 'stables', 'barracks', 'developersHall',
  'barracks', 'steelMill', 'walls', 'tower', 'barracks', 'barracks', 'stables', 'walls', 'tower', 'barracks', 'steelMill', 'walls', 'tower',
  'barracks', 'barracks', 'barracks', 'barracks',
];

/** The cheapest plot (by gold) that is big enough for a building. */
export function smallestPlot(e: Empire, kind: BuildingKind): { width: number; length: number } {
  const size = E.buildings[kind].size;
  let best: { width: number; length: number } = { width: E.plotSide.max, length: E.plotSide.max };
  let bestCost = Infinity;
  for (let w: number = E.plotSide.min; w <= E.plotSide.max; w++)
    for (let l: number = w; l <= E.plotSide.max; l++) {
      if (area(w, l) < size) continue;
      const cost = plotCost(e, w, l);
      if (cost < bestCost) {
        best = { width: w, length: l };
        bestCost = cost;
      }
    }
  return best;
}

/** How strong a kingdom looks to the bot, as a ratio of its army to the kingdom's (walls and towers counted). */
export function looksLike(e: Empire, kingdomIndex: number, loot: number): number {
  const k = KINGDOMS[kingdomIndex];
  const mine = might(e.troops) * (1 + effect(e, 'steelMill') / 100);
  const theirs = might(k.troops) * (1 + (k.towers * E.buildings.tower.per) / 100) * (1 + loot / 100) * (1 + (k.walls * E.buildings.walls.per) / 100);
  return mine / Math.max(1, theirs);
}

export interface EmpireDay {
  raids: number;
  raidWins: number;
  raidGold: number;
  /** Strength (footman = 1) of the troops that did not come home. */
  lostMight: number;
  friendly: number;
  friendlyWins: number;
}

/** One day's empire chores. `seed` feeds the battles. */
export function botEmpire(clan: Clan, seed: number, reserve = 600): EmpireDay {
  const e = empireOf(clan);
  const report: EmpireDay = { raids: 0, raidWins: 0, raidGold: 0, lostMight: 0, friendly: 0, friendlyWins: 0 };
  if (clan.gold > reserve) deposit(clan, clan.gold - reserve);
  setDraft(e, draftMax(e));
  draft(clan);

  // Build the next things in the order, one plot each, as far as gold and energy go.
  for (let i = 0; i < BUILD_ORDER.length; i++) {
    const kind = BUILD_ORDER[i];
    const wanted = BUILD_ORDER.slice(0, i + 1).filter((x) => x === kind).length;
    if (countBuildings(e, kind) >= wanted) continue;
    // Use an empty developed plot that is big enough, or develop a new one.
    let plot = e.plots.findIndex((p) => !p.building && area(p.width, p.length) >= E.buildings[kind].size);
    if (plot < 0) {
      const size = smallestPlot(e, kind);
      if (e.wild < 1 && !claimLand(e).ok) break;
      if (!developPlot(e, size.width, size.length).ok) break;
      plot = e.plots.length - 1;
    }
    if (!build(e, plot, kind).ok) break;
  }

  // Fill the barracks with the troops that are worth the most for the gold, a few of each at a time.
  for (let guard = 0; guard < 200; guard++) {
    let bought = false;
    for (const kind of ['axeman', 'footman', 'knight'] as const) {
      const n = Math.min(kind === 'footman' ? 4 : 2, room(e, kind));
      if (n > 0 && buyTroops(e, kind, n).ok) bought = true;
    }
    if (!bought) break;
  }

  // Raid the toughest kingdom it expects to beat, after a Friendly War to try the plan.
  for (let n = 0; n < E.raids.kingdomPerDay; n++) {
    let pick = -1;
    for (let i = KINGDOMS.length - 1; i >= 0; i--) {
      if (looksLike(e, i, 10) >= 1.35) {
        pick = i;
        break;
      }
    }
    if (pick < 0) break;
    const plan: BattlePlan = { rounds: 4, push: 'steady', loot: looksLike(e, pick, 20) >= 2 ? 20 : 10 };
    const practice = friendlyWar(e, KINGDOMS[pick].id, plan, seed * 31 + n * 7 + 1);
    report.friendly++;
    if (practice.ok && practice.result.outcome === 'won') report.friendlyWins++;
    else continue;
    const go = raidKingdom(e, KINGDOMS[pick].id, plan, seed * 31 + n * 7 + 2);
    if (!go.ok) break;
    report.lostMight += might(go.result.attackerLost);
    report.raids++;
    if (go.result.outcome === 'won') report.raidWins++;
    report.raidGold += go.gold;
  }
  return report;
}

