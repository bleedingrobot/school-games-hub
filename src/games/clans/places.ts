/**
 * What happens in the Market, the Training Hall and the Church, as plain functions on the session.
 * The rules (prices, costs, who can wake) live in shared/clans; these only apply them to a copy of the clan
 * and say no (null) when something can't be done, so the screens stay display-only.
 */
import { CONFIG } from '../../../shared/clans/config';
import { churchCost, examineCost, hpCost, shopPrice, spCost, trainCost, wakeCost } from '../../../shared/clans/character';
import { buyItem as buyItemFor, buyTroopMix as buyTroopMixFor, examineItemFor, knockedOutMembers, raidSeed as raidSeedFor, sendArmyTo, trainMember, wakeAllCost, wakeAllPayers, wakeEveryone, wakeOne, wakeOrder, type TrainKey } from '../../../shared/clans/play';
import type { ServerState } from '../../../shared/clans/actions';
import { canUpgrade, capacity, empireOf, might, newEmpire, raidKingdom, upgrade, type BattleResult, type Done, type Fail, type Push, type Take } from '../../../shared/clans/empire';
import { raidClassmateNz, raidTargetList, type TargetEntry } from '../../../shared/clans/village';
import { STATS, TROOP_KINDS, type Clan, type Empire, type ItemDef, type Member, type Stat, type Troops, type VillageBuilding } from '../../../shared/clans/types';
import { finishQuest, puzzleFor, questById, questDoneToday, todaysQuest, type PuzzleSpec, type QuestDef, type QuestDone } from '../../../shared/clans/quests';
import { earn, type Session } from './session';
import { setLook, type Look } from '../../../shared/clans/looks';

const withClan = (s: Session, change: (clan: Clan) => boolean): Session | null => {
  const clan = structuredClone(s.clan);
  return change(clan) ? { ...s, clan } : null;
};

export const examinedKey = (m: Member, item: ItemDef) => `${m.name}|${item.name}`;
export const hasExamined = (s: Session, m: Member, item: ItemDef) => s.examined.includes(examinedKey(m, item));

/** Pay the shop price and put the item on the member (swapping out what was there). Null if the gold isn't there. */
export const buyItem = (s: Session, memberIndex: number, item: ItemDef): Session | null => withClan(s, (clan) => buyItemFor(clan, memberIndex, item).ok);

/** Pay to look closely at an item for a member. Null if the gold isn't there. */
export function examineItem(s: Session, memberIndex: number, item: ItemDef): Session | null {
  const clan = structuredClone(s.clan);
  const examined = [...s.examined];
  return examineItemFor(clan, examined, memberIndex, item).ok ? { ...s, clan, examined } : null;
}

export { shopPrice, examineCost };

export type { TrainKey };

export interface TrainOption {
  key: TrainKey;
  label: string;
  /** What one purchase gives, for the button. */
  gives: string;
  /** Points for one purchase. */
  cost: number;
  /** How many the member could buy right now. */
  most: number;
}

const STAT_LABEL: Record<Stat, string> = { agility: 'Agility', dexterity: 'Dexterity', strength: 'Strength', wisdom: 'Wisdom', armor: 'Armour', charisma: 'Charisma' };

/** Everything a member can train, with its price at this Training Hall level and how many they could afford. */
export function trainOptions(m: Member, hall: number): TrainOption[] {
  const stats = STATS.map((stat): TrainOption => {
    const cost = trainCost(stat, hall);
    return { key: stat, label: STAT_LABEL[stat], gives: `+1 (now ${m.stats[stat]})`, cost, most: Math.max(0, Math.min(Math.floor(m.points / cost), CONFIG.statCap - m.stats[stat])) };
  });
  const hp = hpCost(hall);
  const sp = spCost(hall);
  return [
    ...stats,
    { key: 'hp', label: 'Health', gives: `+${CONFIG.hpBuy.amount} HP (now ${m.maxHp})`, cost: hp, most: Math.floor(m.points / hp) },
    ...(m.maxSp > 0 || m.spells.length > 0 ? [{ key: 'sp' as const, label: 'Skill points', gives: `+${CONFIG.spBuy.amount} SP (now ${m.maxSp})`, cost: sp, most: Math.floor(m.points / sp) }] : []),
  ];
}

/** Buy `count` of something at the Training Hall (stops early if the points run out). Null if not even one could be bought. */
export const train = (s: Session, memberIndex: number, key: TrainKey, count: number): Session | null => withClan(s, (clan) => trainMember(clan, memberIndex, key, count).ok);

/** Wake one member at the Church (the first wake-up each day is free). Null if they're not out or the gold isn't there. */
export const wakeMember = (s: Session, memberIndex: number): Session | null => withClan(s, (clan) => wakeOne(clan, memberIndex).ok);

export const knockedOut = knockedOutMembers;

/** "Change look": only the picture changes. Null if there is no such member. */
export const changeLook = (s: Session, memberIndex: number, look: Look): Session | null => withClan(s, (clan) => setLook(clan, memberIndex, look).ok);
export { wakeOrder, wakeAllPayers, wakeAllCost };

/** Wake everyone, dearest first. Null if the clan can't afford the lot (nobody is woken). */
export const wakeAll = (s: Session): Session | null => withClan(s, (clan) => wakeEveryone(clan).ok);

export { wakeCost, churchCost };

// Test-only helpers for James's settings strip.
export const giveGold = (s: Session, amount: number): Session => ({ ...s, clan: { ...s.clan, gold: s.clan.gold + amount } });
export const givePoints = (s: Session, amount: number): Session => ({ ...s, clan: { ...s.clan, members: s.clan.members.map((m) => ({ ...m, points: m.points + amount })) } });
/** Knock out the last `n` members (never the first, so someone can still fight). */
export const knockOutSome = (s: Session, n: number): Session => ({
  ...s, clan: { ...s.clan, members: s.clan.members.map((m, i, all) => (i >= all.length - n ? { ...m, knockedOut: true, hp: 0 } : m)) },
});

// ---------------------------------------------------------------------------
// My Village. Same idea: apply the engine's rule to a copy, null when it can't be done.
// ---------------------------------------------------------------------------

/** The engine's own kind sentence for why something can't be done (for the screens to show). */
export const whyNot = (done: Done): string => (done.ok ? '' : done.say);

/** Take a building up one level, paid from the purse. Null if it can't be done (see `canUpgradeBuilding` for why). */
export const upgradeBuilding = (s: Session, b: VillageBuilding): Session | null => withClan(s, (clan) => upgrade(clan, b).ok);
/** Can this building go up a level right now, and if not, why? Works on a copy, so the session is never changed. */
export const canUpgradeBuilding = (s: Session, b: VillageBuilding): Done => canUpgrade(structuredClone(s.clan), b);

// Test-only helpers for James's settings strip.
export const giveFollowers = (s: Session, amount: number): Session => ({ ...s, clan: { ...s.clan, followers: s.clan.followers + amount } });
/** Take the Barracks to its top level and fill the room with troops, whatever it costs. */
export function barracksAndFill(s: Session): Session {
  const next = structuredClone(s);
  const e = empireOf(next.clan);
  e.levels.barracks = CONFIG.empire.buildings.barracks.max;
  for (const kind of TROOP_KINDS) e.troops[kind] = capacity(e, kind);
  return next;
}

// ---------------------------------------------------------------------------
// Troops, raids and Friendly War
// ---------------------------------------------------------------------------

/** Buy a mix of troops in one go, or none of them: the first thing that can't be done is the answer. */
export function buyTroopMix(s: Session, mix: Troops): Session | { fail: Fail } {
  const clan = structuredClone(s.clan);
  const done = buyTroopMixFor(clan, mix);
  return done.ok ? { ...s, clan } : { fail: done };
}
/** Can this mix be bought right now? Works on a copy. */
export const canBuyMix = (s: Session, mix: Troops): Done => { const r = buyTroopMix(s, mix); return 'fail' in r ? r.fail : { ok: true }; };

/** The seed for the next raid or Friendly War. */
export const raidSeed = (s: Session) => raidSeedFor(s.baseSeed, s.raidNo ?? 0);

/** Has today's raid on a kingdom been used? */
export const raidUsed = (s: Session) => canRaid(s) !== null;
/** Why a real raid can't go out right now, or null if it can. */
export function canRaid(s: Session): string | null {
  const probe = structuredClone(s.clan);
  const r = raidKingdom(probe, 'bunny-hollow', 'steady', 1);
  return r.ok ? null : r.say;
}

export interface WarDone {
  session: Session;
  result: BattleResult;
  /** Gold won (0 for a Friendly War or a loss). */
  gold: number;
  friendly: boolean;
}

/** Send the army to a kingdom: a real raid (loses troops, wins loot) or a Friendly War (changes nothing). */
export function sendArmy(s: Session, kingdomId: string, push: Push, friendly: boolean): WarDone | Fail {
  const clan = structuredClone(s.clan);
  const out = sendArmyTo(clan, kingdomId, push, friendly, raidSeed(s));
  if (!out.ok) return out;
  const won = out.result.outcome === 'won';
  const next = { ...s, clan: friendly ? s.clan : clan, raidNo: (s.raidNo ?? 0) + 1 };
  const paid = earn(next, { wars: friendly && won ? 1 : 0, kingdomRaids: !friendly && won ? 1 : 0 });
  return { session: paid, result: out.result, gold: out.gold, friendly };
}

// Test-only helpers for James's settings strip.
/** A huge army, and the day's raid not yet used. */
export function armyToWin(s: Session): Session {
  const next = structuredClone(s);
  const e = empireOf(next.clan);
  e.troops = { footman: 2000, axeman: 500, knight: 200 };
  e.kingdomRaidsToday = 0;
  return next;
}
/** One lone footman, and the day's raid not yet used. */
export function armyToLose(s: Session): Session {
  const next = structuredClone(s);
  const e = empireOf(next.clan);
  e.troops = { footman: 1, axeman: 0, knight: 0 };
  e.kingdomRaidsToday = 0;
  return next;
}
export function freshRaid(s: Session): Session {
  const next = structuredClone(s);
  empireOf(next.clan).kingdomRaidsToday = 0;
  next.pretendRaids = 0;
  return next;
}

// Quests.
/** The quest to show: the one picked for testing, or today's. Null if no quest suits the settings. */
export const questToday = (s: Session): QuestDef | null => (s.questPick ? questById(s.questPick) ?? null : todaysQuest(s.baseSeed, s.day, s.settings));

/** Has the clan already done a quest today? */
export const questUsed = (s: Session) => questDoneToday(s.clan, s.day);

/** The puzzle on one of today's choices, made from the clan's seed and the day. */
export const questPuzzle = (s: Session, q: QuestDef, choice: number): PuzzleSpec | null => puzzleFor(q, choice, s.baseSeed, s.day, s.settings);

/** Do the quest on a copy of the clan. `right` is how the puzzle went (null if the choice had none). */
export function doQuest(s: Session, q: QuestDef, choice: number, right: boolean | null): { session: Session; done: Extract<QuestDone, { ok: true }> } | Extract<QuestDone, { ok: false }> {
  const clan = structuredClone(s.clan);
  const done = finishQuest(clan, s.day, q, choice, right);
  return done.ok ? { session: { ...s, clan }, done } : done;
}

// Test-only helpers for James's settings strip.
export function freshQuest(s: Session): Session {
  const next = structuredClone(s);
  delete next.clan.questDay;
  return next;
}

// ---------------------------------------------------------------------------
// Raids on classmates. With a server these are only drawn; on the test page the pretend classmates below stand in so the
// screens can be tried.
// ---------------------------------------------------------------------------

/** Test page only: the pretend classmates, sized from your own army so there is always a fair one. */
export function pretendMates(s: Session): { id: string; name: string; empire: Empire; gold: number; createdNzDay: number }[] {
  const mine = Math.max(10, might(empireOf(s.clan).troops));
  const make = (id: string, name: string, share: number, created: number) => ({
    id, name, createdNzDay: created, gold: 400, empire: { ...newEmpire(), troops: { footman: Math.max(1, Math.round(mine * share)), axeman: 0, knight: 0 }, shieldUntil: s.pretendShield?.includes(id) ? PRETEND_TODAY + s.day : 0 },
  });
  return [
    make('pretend-foxes', 'Swift Foxes', 0.9, PRETEND_TODAY - 30),
    make('pretend-owls', 'Brave Owls', 1.2, PRETEND_TODAY - 30),
    make('pretend-wolves', 'Iron Wolves', 5, PRETEND_TODAY - 30),
    make('pretend-stars', 'Lucky Stars', 1, PRETEND_TODAY + s.day - 1),
  ];
}
/** The New Zealand day the test page pretends it is (its days are counted up from here). */
const PRETEND_TODAY = 30000;

/** A clan you could raid, as the list shows it. `shieldUntil` (the last day of its shield) is there when the clan is resting behind one and the list knows the day. */
export type RaidChoice = TargetEntry & { shieldUntil?: number };

export interface ClassDone {
  session: Session;
  take: Take;
  result: BattleResult;
  gold: number;
  destroyed: VillageBuilding[];
}

/** Test page only: raid a pretend classmate, with the very same rule the server uses. Nothing is saved anywhere. */
export function pretendRaid(s: Session, mateId: string, take: Take, push: Push): ClassDone | Fail {
  const mate = pretendMates(s).find((m) => m.id === mateId);
  if (!mate) return { ok: false, why: 'target', say: 'That clan is not in your class.' };
  const clan = structuredClone(s.clan);
  const e = empireOf(clan);
  e.raidsToday = s.pretendRaids ?? 0;
  const state = { clan, seed: s.baseSeed, day: s.day, createdNzDay: PRETEND_TODAY - 30, fightsLeft: s.fightsLeft, fightNo: s.fightNo, raidNo: s.raidNo ?? 0, examined: s.examined } as ServerState;
  const out = raidClassmateNz(state, 'you', mate, take, push, raidSeedFor(s.baseSeed, s.raidNo ?? 0), PRETEND_TODAY + s.day - 1, s.raidsOn !== false);
  if (!out.ok) return out;
  return {
    session: earn({
      ...s, clan, raidNo: (s.raidNo ?? 0) + 1, pretendRaids: (s.pretendRaids ?? 0) + 1, pretendShield: [...(s.pretendShield ?? []), mateId],
      news: [out.news, ...(s.news ?? [])],
    }, { classRaids: out.raid.result.outcome === 'won' ? 1 : 0 }),
    take, result: out.raid.result, gold: out.raid.gold, destroyed: out.raid.destroyed,
  };
}

/** Test page only: who the pretend clan could raid, by the very same rule the server uses (with the reasons). */
export function pretendTargets(s: Session): RaidChoice[] {
  const clan = structuredClone(s.clan);
  empireOf(clan).raidsToday = s.pretendRaids ?? 0;
  const state = { clan, seed: s.baseSeed, day: s.day, createdNzDay: PRETEND_TODAY - 30, fightsLeft: s.fightsLeft, fightNo: s.fightNo, raidNo: s.raidNo ?? 0, examined: s.examined } as ServerState;
  const today = PRETEND_TODAY + s.day - 1;
  const sketches = pretendMates(s).map((m) => ({ id: m.id, name: m.name, createdNzDay: m.createdNzDay, shieldUntil: m.empire.shieldUntil, troops: m.empire.troops }));
  const shields = new Map(sketches.filter((m) => m.shieldUntil >= today).map((m) => [m.id, m.shieldUntil]));
  return raidTargetList(state, today, 'you', s.raidsOn !== false, sketches).map((t) => (shields.has(t.id) ? { ...t, shieldUntil: shields.get(t.id) } : t));
}
