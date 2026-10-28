import { CONFIG } from '../../../shared/clans/config';
import { TROOP_NAMES, countBuildings, draftWanted, might, room, type Kingdom } from '../../../shared/clans/empire';
import { BUILDING_KINDS, TROOP_KINDS, type Clan, type Empire, type TroopKind } from '../../../shared/clans/types';

// Small, screen-only helpers that turn the engine's numbers into plain words for children.
// Nothing here changes a rule: each one reads the engine's own functions and config.

/** What the draft would do right now. Mirrors `draft()` in shared/clans/empire.ts: wanted = share rounded up, joined = as far as the footmen's room goes. */
export interface DraftPreview {
  followers: number;
  wanted: number;
  joined: number;
  /** Why nobody would join, or null when somebody would. */
  why: string | null;
}

export function draftPreview(e: Empire, followers: number): DraftPreview {
  const wanted = draftWanted(followers, e.draftPercent);
  const joined = Math.min(wanted, room(e, 'footman'));
  let why: string | null = null;
  if (joined < 1) {
    if (followers < 1) why = 'You have no followers to draft';
    else if (e.draftPercent < 1) why = 'Pick a bigger draft first';
    else if (countBuildings(e, 'barracks') < 1) why = 'Build a Barracks first';
    else why = 'Your barracks are full';
  }
  return { followers, wanted, joined, why };
}

/** The cheapest building costs this much gold. */
const cheapestBuilding = () => Math.min(...BUILDING_KINDS.map((k) => CONFIG.empire.buildings[k].gold));

export interface NextStep {
  say: string;
  /** A quick button: put this much of the purse into the vault. */
  putIn?: number;
}

/** The one thing a child should do next in the empire. */
export function nextEmpireStep(e: Empire, clan: Pick<Clan, 'gold'>): NextStep {
  if (e.vault < cheapestBuilding() && clan.gold > 0) {
    return { say: 'Put some gold in your vault so you can build.', putIn: Math.min(clan.gold, 100) };
  }
  if (e.plots.length < 1) return { say: 'Get a plot of land ready in Land and buildings.' };
  if (countBuildings(e, 'barracks') < 1) return { say: 'Build a Barracks so your troops have somewhere to live.' };
  if (might(e.troops) < 1) return { say: 'Buy some troops, or draft your followers, in Barracks and troops.' };
  if (e.kingdomRaidsToday < CONFIG.empire.raids.kingdomPerDay) return { say: 'Try a raid! Bunny Hollow is a good first one.' };
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

