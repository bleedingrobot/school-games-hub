/**
 * Making a new clan. The creator's choices are race, class, a name from a list and up to three "Roll again"s
 * for each of four slots; every roll comes from the clan's seed, so the server can rebuild the whole clan
 * from those choices alone and nobody can type their own stats.
 */
import { CONFIG } from './config';
import { raceByName, classByName, rollMember } from './character';
import { newEmpire } from './empire';
import { CLAN_ADJECTIVES, CLAN_NOUNS, MEMBER_NAMES, memberNameFrom } from './words';
import { isLook, lookFromName, type Look } from './looks';
import type { Clan, Member } from './types';

export const MAX_ROLLS = 3;

/** One slot in the clan creator. */
export interface Draft {
  race: string;
  cls: string;
  name: string;
  /** How many times "Roll again" has been used (0 to MAX_ROLLS). */
  rolls: number;
  /** Fixed for this slot, so the same slot and roll number always show the same member. */
  seed: number;
  /** Which painting (looks.ts). Only the picture: rolls and stats don't depend on it. */
  look?: Look;
}

/** The member a draft shows right now. Slot 0 is the clan leader. */
export function draftMember(d: Draft, slot: number): Member {
  const m = rollMember({ rng: Math.imul(d.seed | 0, 2654435761) + d.rolls * 7919 }, d.name, d.race, d.cls, slot === 0);
  return { ...m, look: d.look ?? lookFromName(d.name) };
}

/** The seed of slot `slot` of a clan with this seed. */
export const slotSeed = (seed: number, slot: number) => seed + slot * 1013;

/** Four starting slots with different races, classes and names. */
export function startingDrafts(seed: number): Draft[] {
  const first = Math.abs(seed) % MEMBER_NAMES.length;
  const picks: [string, string][] = [['Human', 'Warrior'], ['Elf', 'Healer'], ['Dwarf', 'Knight'], ['Halfling', 'Wizard']];
  return picks.map(([race, cls], i) => ({ race, cls, name: MEMBER_NAMES[(first + i * 7) % MEMBER_NAMES.length], rolls: 0, seed: slotSeed(seed, i) }));
}

export const rollAgain = (d: Draft): Draft => (d.rolls < MAX_ROLLS ? { ...d, rolls: d.rolls + 1 } : d);

export function makeClan(name: string, drafts: Draft[]): Clan {
  return {
    name, members: drafts.map((d, i) => draftMember(d, i)), gold: CONFIG.startGold, followers: 0, gearVersion: 2,
    village: { trainingHall: 0, smithy: 0, church: 0 }, wakesToday: 0, empire: newEmpire(),
  };
}

/** True if this is a clan name the creator can make: one adjective and one noun from the lists. */
export function isClanName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const [adjective, noun, ...rest] = name.split(' ');
  return rest.length === 0 && CLAN_ADJECTIVES.includes(adjective) && CLAN_NOUNS.includes(noun);
}

/**
 * Check what the creator sent and build the clan from it. Only the choices matter (race, class, name,
 * how many rolls); the stats are always rebuilt here from the clan's seed. `typedNames` is the teacher's switch:
 * when it is on a hero may have a made-up name (checked and tidied here) as well as one from the list.
 */
export function clanFromChoices(seed: number, name: unknown, drafts: unknown, typedNames = false): { ok: true; clan: Clan } | { ok: false; say: string } {
  if (!isClanName(name)) return { ok: false, say: 'Pick a clan name from the lists.' };
  if (!Array.isArray(drafts) || drafts.length !== CONFIG.minMembers) return { ok: false, say: `A new clan has ${CONFIG.minMembers} members.` };
  const built: Draft[] = [];
  for (const [slot, raw] of drafts.entries()) {
    const d = raw as Partial<Draft> | null;
    if (!d || typeof d !== 'object') return { ok: false, say: 'Those members could not be read.' };
    if (typeof d.race !== 'string' || !raceByName(d.race) || typeof d.cls !== 'string' || !classByName(d.cls)) return { ok: false, say: 'Pick a race and a class from the lists.' };
    const named = memberNameFrom(d.name, typedNames);
    if (!named.ok) return { ok: false, say: named.say };
    // Heroes are told apart by name (the fight log and the news), so no two in a clan may share one.
    if (built.some((b) => b.name.toLowerCase() === named.name.toLowerCase())) return { ok: false, say: 'Give each member a different name.' };
    if (!Number.isInteger(d.rolls) || (d.rolls as number) < 0 || (d.rolls as number) > MAX_ROLLS) return { ok: false, say: `You can roll again ${MAX_ROLLS} times for each member.` };
    if (d.look !== undefined && !isLook(d.look)) return { ok: false, say: 'Pick one of the four looks.' };
    built.push({ race: d.race, cls: d.cls, name: named.name, rolls: d.rolls as number, seed: slotSeed(seed, slot), ...(d.look ? { look: d.look } : {}) });
  }
  return { ok: true, clan: makeClan(name, built) };
}
