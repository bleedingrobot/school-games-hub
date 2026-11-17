/**
 * The class village (Clan Quest stage C.6 part A), as plain rules the server and the screens share.
 *
 * - The OLD class village (chest, weekly vote, `closeWeek`): no longer used by the game ("My Village" gives every clan its own
 *   buildings, see empire.ts). It is kept only because the SQL function `clan_village_close` and its parity test still read
 *   these functions and CONFIG.village; nothing in actions.ts calls them any more.
 * - Raids on classmates are in raids.ts.
 *
 * Nothing here knows a student's name or id. A clan is known by its name (adjective + noun from the word lists) and a
 * hidden `public_id` made for the purpose.
 */
import { CONFIG } from './config';
import type { Village } from './types';

const V = CONFIG.village;

export type VillageKind = keyof Village;
export const VILLAGE_KINDS = V.order as readonly VillageKind[];
export const isVillageKind = (v: unknown): v is VillageKind => typeof v === 'string' && (VILLAGE_KINDS as readonly string[]).includes(v);

export const VILLAGE_NAMES: Record<VillageKind, string> = { trainingHall: 'Training Hall', smithy: 'Smithy', church: 'Church' };
export const VILLAGE_BLURBS: Record<VillageKind, string> = {
  trainingHall: 'Training is cheaper for everyone.',
  smithy: 'The shop sells better things.',
  church: 'One more free wake-up a day.',
};

export const newVillageLevels = (): Village => ({ trainingHall: 0, smithy: 0, church: 0 });

/** The most levels a building can have. */
export const villageMax = (kind: VillageKind) => V[kind].max;

/** Gold to build `kind` up to level `toLevel`. */
export const villageCost = (kind: VillageKind, toLevel: number) => V[kind].base * toLevel;

// ---------------------------------------------------------------------------
// Weeks
// ---------------------------------------------------------------------------

/** The week a New Zealand day is in. Weeks start on Monday (day 0, 1 Jan 1970, was a Thursday). */
export const weekOf = (nzDay: number) => Math.floor((nzDay + 3) / 7);

// ---------------------------------------------------------------------------
// The vote
// ---------------------------------------------------------------------------

export interface VillageOption {
  kind: VillageKind;
  /** The level it would be built to. */
  level: number;
  cost: number;
}

/** What the class can vote for: every building that is not yet at its top level. */
export function voteOptions(levels: Village): VillageOption[] {
  return VILLAGE_KINDS.filter((k) => levels[k] < V[k].max).map((kind) => ({ kind, level: levels[kind] + 1, cost: villageCost(kind, levels[kind] + 1) }));
}

export type Votes = Partial<Record<VillageKind, number>>;

/** The winning option: most votes; a tie goes to the cheaper one, then to the fixed order. Null if nobody voted for a possible option. */
export function winner(levels: Village, votes: Votes): VillageOption | null {
  const options = voteOptions(levels).filter((o) => (votes[o.kind] ?? 0) > 0);
  options.sort((a, b) => (votes[b.kind] ?? 0) - (votes[a.kind] ?? 0) || a.cost - b.cost || VILLAGE_KINDS.indexOf(a.kind) - VILLAGE_KINDS.indexOf(b.kind));
  return options[0] ?? null;
}

export interface WeekClosed {
  levels: Village;
  chest: number;
  /** What was built, if anything. */
  built: VillageOption | null;
  /** The news line, or null if nobody voted. */
  news: string | null;
}

/** The end of a week's vote: build the winner if the chest covers it. The chest never goes below zero. */
export function closeWeek(levels: Village, chest: number, votes: Votes): WeekClosed {
  const won = winner(levels, votes);
  if (!won) return { levels, chest, built: null, news: null };
  const name = VILLAGE_NAMES[won.kind];
  if (chest < won.cost) {
    return { levels, chest, built: null, news: `The class voted for the ${name} (level ${won.level}) but the chest was ${won.cost - chest} gold short.` };
  }
  return { levels: { ...levels, [won.kind]: won.level }, chest: chest - won.cost, built: won, news: `The class built the ${name} (level ${won.level})!` };
}

export interface Goal {
  kind: VillageKind;
  level: number;
  cost: number;
  /** Gold in the chest, never more than the cost. */
  have: number;
  /** Whole percent of the way there, 0 to 100. */
  percent: number;
  /** "Church level 2: 380 / 500 gold". */
  text: string;
}

/** The class goal on the village screen: the building in the lead, or the cheapest if nobody has voted. Null when everything is built. */
export function goalOf(levels: Village, chest: number, votes: Votes): Goal | null {
  const options = voteOptions(levels);
  if (options.length === 0) return null;
  const lead = winner(levels, votes) ?? [...options].sort((a, b) => a.cost - b.cost || VILLAGE_KINDS.indexOf(a.kind) - VILLAGE_KINDS.indexOf(b.kind))[0];
  const have = Math.min(chest, lead.cost);
  return {
    kind: lead.kind, level: lead.level, cost: lead.cost, have, percent: Math.floor((have * 100) / lead.cost),
    text: `${VILLAGE_NAMES[lead.kind]} level ${lead.level}: ${chest} / ${lead.cost} gold`,
  };
}

export interface GoalQuestion {
  text: string;
  answer: number;
  /** The working, shown after the answer whether it was right or not. */
  working: string;
}

/**
 * A gentle class-wide maths moment: how much more gold does the class need for the goal? Made and marked by code, from the
 * goal alone. A wrong answer blocks nothing. Null when the chest already covers the goal.
 */
export function goalQuestion(goal: Goal): GoalQuestion | null {
  const need = goal.cost - goal.have;
  if (need <= 0) return null;
  return {
    text: `The ${VILLAGE_NAMES[goal.kind]} (level ${goal.level}) costs ${goal.cost} gold and the chest has ${goal.have}. How much more gold does the class need?`,
    answer: need,
    working: `${goal.cost} − ${goal.have} = ${need}`,
  };
}

/** What the browser is told about its village. Counts only: nobody's name or id. */
export interface VillageView {
  name: string;
  chest: number;
  levels: Village;
  /** The week it is now. */
  week: number;
  /** Votes so far this week, by building. */
  votes: Votes;
  /** The building this pupil voted for this week, if they did. */
  myVote: VillageKind | null;
  /** How many clans are in the village. */
  clans: number;
}
