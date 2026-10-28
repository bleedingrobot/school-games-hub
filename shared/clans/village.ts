/**
 * The class village (Clan Quest stage C.6 part A), as plain rules the server and the screens share.
 *
 * - The OLD class village (chest, weekly vote, `closeWeek`): no longer used by the game ("My Village" gives every clan its own
 *   buildings, see empire.ts). It is kept only because the SQL function `clan_village_close` and its parity test still read
 *   these functions and CONFIG.village; nothing in actions.ts calls them any more.
 * - Raids on classmates: `raidTargetList` says who a clan may raid (and why not, in kind words), and `raidClassmateNz`
 *   does a raid. Clans count their days from their own first day, so classmate raids use New Zealand day numbers.
 *
 * Nothing here knows a student's name or id. A clan is known by its name (adjective + noun from the word lists) and a
 * hidden `public_id` made for the purpose.
 */
import { CONFIG } from './config';
import { empireOf, needsUpgrade, newEmpire, raidClassmate, raidNews, raidRefusal, upgradeSave, type ClassmateRaid, type Fail, type Party, type Push, type Take } from './empire';
import type { ServerState } from './actions';
import type { Clan, Empire, OldEmpire, Troops, Village } from './types';

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

// ---------------------------------------------------------------------------
// Raids on classmates
// ---------------------------------------------------------------------------

/** What a clan may know about another clan in its village when picking one to raid: no gold, no exact army. */
export interface Sketch {
  id: string;
  name: string;
  /** The New Zealand day the clan began. */
  createdNzDay: number;
  /** The last New Zealand day it is shielded (0 for never). */
  shieldUntil: number;
  troops: Troops;
}

export interface TargetEntry {
  id: string;
  name: string;
  allowed: boolean;
  /** Why not, in kind words; empty when allowed. */
  say: string;
}

const partyOf = (id: string, empire: Empire, createdNzDay: number, gold = 0): Party => ({ id, empire: { ...empire, createdDay: createdNzDay }, gold });

/** Who this clan may raid, and why not for the rest. Allowed ones come first. */
export function raidTargetList(state: ServerState, today: number, self: string, raidsOn: boolean, sketches: Sketch[]): TargetEntry[] {
  const attacker = partyOf(self, empireOf(state.clan), state.createdNzDay, state.clan.gold);
  const list = sketches.map((s): TargetEntry => {
    const defender = partyOf(s.id, { ...newEmpire(), troops: s.troops, shieldUntil: s.shieldUntil }, s.createdNzDay);
    const refused = raidRefusal(attacker, defender, today, raidsOn);
    return { id: s.id, name: s.name, allowed: !refused, say: refused ? refused.say : '' };
  });
  return [...list.filter((t) => t.allowed), ...list.filter((t) => !t.allowed)];
}

/**
 * A classmate clan as the server loads it to be raided. `empire` may still be an old-shape save: then `gold` is the clan
 * purse (the old vault is added to it by the conversion) and `village` is the class village's levels, if the server has them.
 */
export interface RaidTarget {
  id: string;
  name: string;
  createdNzDay: number;
  empire: Empire | OldEmpire;
  /** The raided clan's purse. */
  gold: number;
  village?: Partial<Village>;
}

export interface ClassmateDone {
  ok: true;
  raid: ClassmateRaid;
  /** The raided clan's empire after the raid, for the server to save in the same transaction. */
  defenderEmpire: Empire;
  /** The raided clan's purse after the raid (gold may have been taken), saved in the same transaction. */
  defenderGold: number;
  /** The line for the village news (the raiders' clan name only). */
  news: string;
  /** The raided clan's own note, read next time they open the game. */
  note: string;
}

/** What the raided clan reads next time. The raiders' clan name only. */
export function raidNote(raiderClan: string, raid: ClassmateRaid): string {
  if (raid.result.outcome !== 'won') return `A raider from the ${raiderClan} clan attacked, and your defenders drove them off!`;
  if (raid.take === 'gold') return `A raider from the ${raiderClan} clan beat your defenders and took ${raid.gold} gold from your purse.`;
  return `A raider from the ${raiderClan} clan beat your defenders and knocked ${raid.destroyed.length} ${raid.destroyed.length === 1 ? 'level' : 'levels'} off your buildings.`;
}

/**
 * Raid a classmate with the attacker's saved state (which is changed: the caller passes a copy). The rules are
 * `raidClassmate`, with day numbers turned into New Zealand days. The defender's empire and purse come back changed; the
 * caller saves both clans in one go. The attacker's own empire and purse are changed in `state`.
 */
export function raidClassmateNz(state: ServerState, self: string, target: RaidTarget, take: Take, push: Push, seed: number, today: number, raidsOn: boolean): Fail | ClassmateDone {
  const mine = empireOf(state.clan);
  const keep = mine.createdDay;
  mine.createdDay = state.createdNzDay;
  // An old-shape defender is converted first (in a scratch clan), so the raid is played on the new rules.
  let defenderEmpire: Empire;
  let defenderGold = target.gold;
  if (target.empire.version === 2) defenderEmpire = structuredClone(target.empire);
  else {
    const scratch = { name: target.name, members: [], gold: target.gold, followers: 0, village: { trainingHall: 0, smithy: 0, church: 0 }, empire: target.empire } as unknown as Clan;
    const up = needsUpgrade(scratch) ? upgradeSave(scratch, target.village) : scratch;
    defenderEmpire = up.empire as Empire;
    defenderGold = up.gold;
  }
  const originalCreated = target.empire.createdDay;
  defenderEmpire.createdDay = target.createdNzDay;
  const attacker: Party = { id: self, empire: mine, gold: state.clan.gold };
  const defender: Party = { id: target.id, empire: defenderEmpire, gold: defenderGold };
  const out = raidClassmate(attacker, defender, take, push, seed, today, raidsOn);
  mine.createdDay = keep;
  if (!out.ok) return out;
  state.clan.gold = attacker.gold;
  defenderEmpire.createdDay = originalCreated;
  const { ok: _ok, ...raid } = out;
  return { ok: true, raid, defenderEmpire, defenderGold: defender.gold, news: raidNews(state.clan.name, raid), note: raidNote(state.clan.name, raid) };
}
