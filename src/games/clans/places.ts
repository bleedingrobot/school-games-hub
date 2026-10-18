/**
 * What happens in the Market, the Training Hall and the Church, as plain functions on the session.
 * The rules (prices, costs, who can wake) live in shared/clans; these only apply them to a copy of the clan
 * and say no (null) when something can't be done, so the screens stay display-only.
 */
import { CONFIG } from '../../../shared/clans/config';
import { buy, churchCost, examineCost, hpCost, shopPrice, spCost, trainCost, trainHp, trainSp, trainStat, wake, wakeCost } from '../../../shared/clans/character';
import { build, canBuild, capacity, claimLand, deposit, developPlot, empireOf, withdraw, type Done } from '../../../shared/clans/empire';
import { STATS, TROOP_KINDS, type BuildingKind, type Clan, type Empire, type ItemDef, type Member, type Stat } from '../../../shared/clans/types';
import type { Session } from './session';

const withClan = (s: Session, change: (clan: Clan) => boolean): Session | null => {
  const clan = structuredClone(s.clan);
  return change(clan) ? { ...s, clan } : null;
};

export const examinedKey = (m: Member, item: ItemDef) => `${m.name}|${item.name}`;
export const hasExamined = (s: Session, m: Member, item: ItemDef) => s.examined.includes(examinedKey(m, item));

/** Pay the shop price and put the item on the member (swapping out what was there). Null if the gold isn't there. */
export const buyItem = (s: Session, memberIndex: number, item: ItemDef): Session | null => withClan(s, (clan) => buy(clan, clan.members[memberIndex], item));

/** Pay to look closely at an item for a member. Null if the gold isn't there. */
export function examineItem(s: Session, memberIndex: number, item: ItemDef): Session | null {
  const cost = examineCost(item);
  if (s.clan.gold < cost) return null;
  const next = withClan(s, (clan) => ((clan.gold -= cost), true))!;
  const key = examinedKey(s.clan.members[memberIndex], item);
  return { ...next, examined: next.examined.includes(key) ? next.examined : [...next.examined, key] };
}

export { shopPrice, examineCost };

export type TrainKey = Stat | 'hp' | 'sp';

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
export function train(s: Session, memberIndex: number, key: TrainKey, count: number): Session | null {
  return withClan(s, (clan) => {
    const m = clan.members[memberIndex];
    const hall = clan.village.trainingHall;
    let done = 0;
    for (let i = 0; i < count; i++) {
      const ok = key === 'hp' ? trainHp(m, hall) : key === 'sp' ? trainSp(m, hall) : trainStat(m, key, hall);
      if (!ok) break;
      done++;
    }
    return done > 0;
  });
}

/** Wake one member at the Church (the first wake-up each day is free). Null if they're not out or the gold isn't there. */
export const wakeMember = (s: Session, memberIndex: number): Session | null => withClan(s, (clan) => wake(clan, clan.members[memberIndex]));

export const knockedOut = (clan: Clan) => clan.members.map((m, i) => ({ m, i })).filter(({ m }) => m.knockedOut);

/** The order "wake everyone" goes in: dearest first, so the free wake-up saves the most. */
export const wakeOrder = (clan: Clan) => knockedOut(clan).sort((a, b) => churchCost(b.m) - churchCost(a.m) || a.i - b.i);

/** Levels of the members who would have to pay if everyone were woken now (everyone but the free ones). */
export function wakeAllPayers(clan: Clan): number[] {
  const free = Math.max(0, CONFIG.freeWakesPerDay - (clan.wakesToday ?? 0));
  return wakeOrder(clan).slice(free).map(({ m }) => m.level);
}

/** What waking everyone costs in gold right now. */
export const wakeAllCost = (clan: Clan) => wakeAllPayers(clan).reduce((t, l) => t + (l + 1) * CONFIG.churchPerLevel, 0);

/** Wake everyone, dearest first. Null if the clan can't afford the lot (nobody is woken). */
export function wakeAll(s: Session): Session | null {
  return withClan(s, (clan) => {
    const order = wakeOrder(clan);
    if (order.length === 0 || clan.gold < wakeAllCost(clan)) return false;
    return order.every(({ i }) => wake(clan, clan.members[i]));
  });
}

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
