/**
 * A sensible, not clever, empire builder. Used by the simulator to see whether a clan can afford
 * a real empire in a few weeks, and whether the computer kingdoms can be beaten at the right level.
 * It does what a careful child would: save the surplus, build in a sensible order, fill the
 * barracks, try a Friendly War to test a plan, and only then raid.
 */
import { CONFIG } from './config';
import { KINGDOMS, buyTroops, empireOf, friendlyWar, joinFollowers, maxLevel, might, raidKingdom, room, upgrade, upgradeCost, type Push } from './empire';
import { VILLAGE_BUILDINGS, type Clan, type Empire, type VillageBuilding } from './types';

const E = CONFIG.empire;

/** What to build, in order: level 1 of everything useful first (homes for troops, then training, shop and defence), then level 2, and so on. */
export const BUILD_ORDER: VillageBuilding[] = (() => {
  const first: VillageBuilding[] = ['barracks', 'trainingHall', 'smithy', 'tower', 'forge', 'walls', 'church', 'strongroom'];
  const order: VillageBuilding[] = [];
  for (let level = 1; level <= Math.max(...VILLAGE_BUILDINGS.map(maxLevel)); level++) for (const b of first) if (level <= maxLevel(b)) order.push(b);
  return order;
})();

/** The next building the bot would upgrade: the first in the order that is not at the level the order asks for. */
export function nextToBuild(e: Empire): VillageBuilding | null {
  const seen: Partial<Record<VillageBuilding, number>> = {};
  for (const b of BUILD_ORDER) {
    const want = (seen[b] = (seen[b] ?? 0) + 1);
    if (e.levels[b] < want) return b;
  }
  return null;
}

/** How strong a kingdom looks to the bot, as a ratio of its army to the kingdom's (walls and towers counted). */
export function looksLike(e: Empire, kingdomIndex: number, loot: number): number {
  const k = KINGDOMS[kingdomIndex];
  const mine = might(e.troops) * (1 + (e.levels.forge * E.buildings.forge.per) / 100);
  const theirs = (might(k.troops) * (1 + (k.towers * E.buildings.tower.per) / 100) * (1 + loot / 100)) / Math.max(0.1, (100 - k.walls * E.buildings.walls.per) / 100);
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

/** One day's village chores. `seed` feeds the battles. `reserve` is the gold the bot keeps in the purse for the shop. */
export function botEmpire(clan: Clan, seed: number, reserve = 0): EmpireDay {
  const e = empireOf(clan);
  const report: EmpireDay = { raids: 0, raidWins: 0, raidGold: 0, lostMight: 0, friendly: 0, friendlyWins: 0 };
  joinFollowers(clan);

  // Build the next things in the order, as far as gold and the day's builds go; save up when the next one is too dear.
  for (let n = 0; n < E.buildsPerDay + E.buildsSavedMax; n++) {
    const next = nextToBuild(e);
    if (!next) break;
    if (clan.gold - reserve < upgradeCost(next, e.levels[next] + 1)) break;
    if (!upgrade(clan, next).ok) break;
  }

  // Fill the barracks with the troops that are worth the most for the gold, a few of each at a time.
  for (let guard = 0; guard < 200; guard++) {
    let bought = false;
    for (const kind of ['axeman', 'footman', 'knight'] as const) {
      const n = Math.min(kind === 'footman' ? 4 : 2, room(e, kind));
      if (n > 0 && clan.gold - reserve >= n * E.troopCost[kind] && buyTroops(clan, kind, n).ok) bought = true;
    }
    if (!bought) break;
  }

  // Raid the toughest kingdom it expects to beat, after a Friendly War to try the plan.
  for (let n = 0; n < E.raids.kingdomPerDay; n++) {
    let pick = -1;
    for (let i = KINGDOMS.length - 1; i >= 0; i--) {
      if (looksLike(e, i, E.battle.loot) >= 1.35) {
        pick = i;
        break;
      }
    }
    if (pick < 0) break;
    const push: Push = 'steady';
    const practice = friendlyWar(e, KINGDOMS[pick].id, push, seed * 31 + n * 7 + 1);
    report.friendly++;
    if (practice.ok && practice.result.outcome === 'won') report.friendlyWins++;
    else continue;
    const go = raidKingdom(clan, KINGDOMS[pick].id, push, seed * 31 + n * 7 + 2);
    if (!go.ok) break;
    report.lostMight += might(go.result.attackerLost);
    report.raids++;
    if (go.result.outcome === 'won') report.raidWins++;
    report.raidGold += go.gold;
  }
  return report;
}
