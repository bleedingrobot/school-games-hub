import { CONFIG } from '../../../shared/clans/config';
import { TROOP_NAMES, buildsLeft, empireOf, maxLevel, might, upgradeCost, type Kingdom } from '../../../shared/clans/empire';
import { TROOP_KINDS, type Clan, type TroopKind, type VillageBuilding } from '../../../shared/clans/types';

// Small, screen-only helpers that turn the engine's numbers into plain words for children.
// Nothing here changes a rule: each one reads the engine's own functions and config.

export interface NextStep {
  say: string;
}

/** The order a child is nudged to upgrade in, and why each one is worth it. */
const UPGRADE_HINTS: [VillageBuilding, string][] = [
  ['smithy', 'Upgrade your Smithy for better weapons.'],
  ['forge', 'Upgrade your Forge so your raiders hit harder.'],
  ['walls', 'Upgrade your Walls so raiders do less damage.'],
  ['tower', 'Upgrade your Tower so your defenders hit back harder.'],
  ['strongroom', 'Upgrade your Strongroom to keep more gold safe.'],
  ['trainingHall', 'Upgrade your Training Hall so training costs less.'],
  ['church', 'Upgrade your Church for another free wake-up.'],
  ['barracks', 'Upgrade your Barracks to make room for more troops.'],
];

/** The one thing a child should do next in My Village. */
export function nextVillageStep(clan: Clan): NextStep {
  const e = empireOf(clan);
  const left = buildsLeft(e);
  if (e.levels.barracks < 1) {
    const cost = upgradeCost('barracks', 1);
    if (left < 1) return { say: 'Your builders are resting. Come back tomorrow to build your first Barracks.' };
    if (clan.gold < cost) return { say: `Win ${cost} gold in the Mines, then build your first Barracks so troops can join you.` };
    return { say: 'Build your first Barracks so troops can join you.' };
  }
  if (might(e.troops) < 1) return { say: 'Buy some troops, or win fights in the Mines so followers join you.' };
  if (e.kingdomRaidsToday < CONFIG.empire.raids.kingdomPerDay) return { say: 'Try a raid! Bunny Hollow is a good first one.' };
  if (left > 0) {
    const hint = UPGRADE_HINTS.find(([b]) => e.levels[b] < maxLevel(b) && clan.gold >= upgradeCost(b, e.levels[b] + 1));
    if (hint) return { say: hint[1] };
    if (UPGRADE_HINTS.some(([b]) => e.levels[b] < maxLevel(b))) return { say: 'Win more gold in the Mines to upgrade your village.' };
  }
  return { say: 'All done for today. Come back tomorrow.' };
}

/** "(footman 1, axeman 2, knight 4)", from the config. */
export function strengthKey(): string {
  return `(${TROOP_KINDS.map((k: TroopKind) => `${TROOP_NAMES[k].one} ${CONFIG.empire.troopMight[k]}`).join(', ')})`;
}

export type Light = 'win' | 'close' | 'tough';
export const LIGHT_WORDS: Record<Light, string> = { win: 'You should win', close: 'A close fight', tough: 'Too strong for now' };

// Kingdoms have walls and towers, so their troop count alone undersells them. These are the army strengths that win
// about 80% of the time, from the simulator (docs/CLANS-RULES.md section 12). A close fight starts at 60% of that.
const WINS_AT: Record<string, number> = { 'bunny-hollow': 15, 'pebble-bridge': 45, 'hilltop-hold': 100, ironwood: 175, stormcrag: 275, 'dragons-rest': 440 };
const WIN_AT = 1.2;
const CLOSE_AT = 0.8;

/** Traffic light for an army of this strength against this strength. */
export function trafficLight(myStrength: number, theirStrength: number): Light {
  if (theirStrength <= 0) return myStrength > 0 ? 'win' : 'close';
  if (myStrength >= theirStrength * WIN_AT) return 'win';
  if (myStrength >= theirStrength * CLOSE_AT) return 'close';
  return 'tough';
}

export function kingdomLight(myStrength: number, k: Kingdom): Light {
  const winsAt = WINS_AT[k.id];
  if (winsAt === undefined) return trafficLight(myStrength, might(k.troops));
  if (myStrength >= winsAt) return 'win';
  if (myStrength >= winsAt * 0.6) return 'close';
  return 'tough';
}

