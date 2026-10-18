/**
 * What happens in the Market, the Training Hall and the Church, as plain functions on the session.
 * The rules (prices, costs, who can wake) live in shared/clans; these only apply them to a copy of the clan
 * and say no (null) when something can't be done, so the screens stay display-only.
 */
import { CONFIG } from '../../../shared/clans/config';
import { churchCost, examineCost, hpCost, shopPrice, spCost, trainCost, wakeCost } from '../../../shared/clans/character';
import { buyItem as buyItemFor, buyTroopMix as buyTroopMixFor, draftFollowers as draftFollowersFor, examineItemFor, knockedOutMembers, raidSeed as raidSeedFor, sendArmyTo, trainMember, wakeAllCost, wakeAllPayers, wakeEveryone, wakeOne, wakeOrder, type TrainKey } from '../../../shared/clans/play';
import { build, canBuild, capacity, claimLand, deposit, developPlot, empireOf, raidKingdom, setDraft, withdraw, type BattlePlan, type BattleResult, type Done, type Fail } from '../../../shared/clans/empire';
import { STATS, TROOP_KINDS, type BuildingKind, type Clan, type Empire, type ItemDef, type Member, type Stat, type Troops } from '../../../shared/clans/types';
import { finishQuest, puzzleFor, questById, questDoneToday, todaysQuest, type PuzzleSpec, type QuestDef, type QuestDone } from '../../../shared/clans/quests';
import type { Session } from './session';

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
// The empire. Same idea: apply the engine's rule to a copy, null when it can't be done.
// ---------------------------------------------------------------------------

const withEmpire = (s: Session, change: (e: Empire, clan: Clan) => Done): Session | null => withClan(s, (clan) => change(empireOf(clan), clan).ok);

/** The engine's own kind sentence for why something can't be done (for the screens to show). */
export const whyNot = (done: Done): string => (done.ok ? '' : done.say);

export const putInVault = (s: Session, gold: number): Session | null => withEmpire(s, (_e, clan) => deposit(clan, gold));
export const takeFromVault = (s: Session, gold: number): Session | null => withEmpire(s, (_e, clan) => withdraw(clan, gold));
export const developLand = (s: Session, width: number, length: number): Session | null => withEmpire(s, (e) => developPlot(e, width, length));
export const claimMoreLand = (s: Session): Session | null => withEmpire(s, (e) => claimLand(e));
export const buildOn = (s: Session, plotIndex: number, kind: BuildingKind): Session | null => withEmpire(s, (e) => build(e, plotIndex, kind));

/** Can this go on this plot right now? Works on a copy, so the session is never changed. */
export const canBuildOn = (s: Session, plotIndex: number, kind: BuildingKind): Done => canBuild(empireOf(structuredClone(s.clan)), plotIndex, kind);
/** Can this size of plot be developed right now? */
export const canDevelop = (s: Session, width: number, length: number): Done => developPlot(empireOf(structuredClone(s.clan)), width, length);
export const canClaim = (s: Session): Done => claimLand(empireOf(structuredClone(s.clan)));

// Test-only helpers for James's settings strip.
export const giveFollowers = (s: Session, amount: number): Session => ({ ...s, clan: { ...s.clan, followers: s.clan.followers + amount } });
export const giveVault = (s: Session, amount: number): Session => withEmpire(s, (e) => ((e.vault += amount), { ok: true }))!;
/** Develop a 4 by 4 plot, put a barracks on it and fill the room with troops, whatever it costs. */
export function barracksAndFill(s: Session): Session {
  const next = structuredClone(s);
  const e = empireOf(next.clan);
  if (e.wild < 1) e.wild = 1;
  e.plots.push({ width: 4, length: 4, building: 'barracks' });
  e.wild--;
  for (const kind of TROOP_KINDS) e.troops[kind] = capacity(e, kind);
  return next;
}

// ---------------------------------------------------------------------------
// Troops, the draft, raids and Friendly War
// ---------------------------------------------------------------------------

/** Buy a mix of troops in one go, or none of them: the first thing that can't be done is the answer. */
export function buyTroopMix(s: Session, mix: Troops): Session | { fail: Fail } {
  const clan = structuredClone(s.clan);
  const done = buyTroopMixFor(clan, mix);
  return done.ok ? { ...s, clan } : { fail: done };
}
/** Can this mix be bought right now? Works on a copy. */
export const canBuyMix = (s: Session, mix: Troops): Done => { const r = buyTroopMix(s, mix); return 'fail' in r ? r.fail : { ok: true }; };

export const setDraftTo = (s: Session, percent: number): Session | null => withEmpire(s, (e) => setDraft(e, percent));

/** Draft the followers: they all leave, some join as footmen as far as there is room. */
export function draftFollowers(s: Session): { session: Session; wanted: number; joined: number; followers: number } {
  const clan = structuredClone(s.clan);
  const out = draftFollowersFor(clan);
  return { session: { ...s, clan }, ...out };
}

/** The seed for the next raid or Friendly War. */
export const raidSeed = (s: Session) => raidSeedFor(s.baseSeed, s.raidNo ?? 0);

/** Has today's raid on a kingdom been used? */
export const raidUsed = (s: Session) => canRaid(s) !== null;
/** Why a real raid can't go out right now, or null if it can. */
export function canRaid(s: Session): string | null {
  const probe = structuredClone(s.clan);
  const e = empireOf(probe);
  const r = raidKingdom(e, 'bunny-hollow', {}, 1);
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
export function sendArmy(s: Session, kingdomId: string, plan: BattlePlan, friendly: boolean): WarDone | Fail {
  const clan = structuredClone(s.clan);
  const out = sendArmyTo(clan, kingdomId, plan, friendly, raidSeed(s));
  if (!out.ok) return out;
  const next = { ...s, raidNo: (s.raidNo ?? 0) + 1 };
  return { session: friendly ? next : { ...next, clan }, result: out.result, gold: out.gold, friendly };
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
