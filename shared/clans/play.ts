/**
 * Everyday actions on a clan: shop, Training Hall, Church, troops, raids. Each one changes the clan it is given and says
 * yes or no (with a kind sentence). The screens call these through `places.ts` on a copy of the clan; the server
 * calls the very same functions, so a changed browser cannot do anything the rules refuse.
 */
import { CONFIG } from './config';
import { buy, cannotBuy, churchCost, freeWakes, gainXp, hpCost, shopPrice, spCost, trainHp, trainSp, trainStat, wake, wakeCost } from './character';
import { buyTroops, empireOf, friendlyWar, joinFollowers, levelOf, raidKingdom, type BattleResult, type Done, type Push } from './empire';
import { settle, type FightState } from './fight';
import { STATS, TROOP_KINDS, type Clan, type ItemDef, type Member, type Stat, type Troops } from './types';

const ok = { ok: true } as const;
const no = (why: string, say: string): Done => ({ ok: false, why, say });

export type TrainKey = Stat | 'hp' | 'sp';
export const TRAIN_KEYS: readonly TrainKey[] = [...STATS, 'hp', 'sp'];

const memberAt = (clan: Clan, index: number): Member | null => clan.members[index] ?? null;

/**
 * Pay for an item and put it on the member (swapping out what was there). `discount` is true when the Market's maths
 * question was answered right (the caller has checked it): 10% off.
 */
export function buyItem(clan: Clan, memberIndex: number, item: ItemDef, discount = false): Done {
  const m = memberAt(clan, memberIndex);
  if (!m) return no('member', 'Pick one of your clan.');
  const why = cannotBuy(clan, m, item);
  if (why) return no('shelf', why);
  const price = shopPrice(item, discount);
  if (clan.gold < price) return no('gold', `That costs ${price} gold and the clan has ${clan.gold}.`);
  return buy(clan, m, item, discount) ? ok : no('gold', 'That cannot be bought right now.');
}

/** Buy `count` of something at the Training Hall (stops early if the points run out). Fails if not even one could be bought. */
export function trainMember(clan: Clan, memberIndex: number, key: TrainKey, count: number): Done {
  const m = memberAt(clan, memberIndex);
  if (!m) return no('member', 'Pick one of your clan.');
  if (!TRAIN_KEYS.includes(key) || !Number.isInteger(count) || count < 1) return no('amount', 'Pick what to train and how many.');
  const hall = levelOf(clan, 'trainingHall');
  let done = 0;
  for (let i = 0; i < count; i++) {
    const worked = key === 'hp' ? trainHp(m, hall) : key === 'sp' ? trainSp(m, hall) : trainStat(m, key, hall);
    if (!worked) break;
    done++;
  }
  if (done > 0) return ok;
  const cost = key === 'hp' ? hpCost(hall) : key === 'sp' ? spCost(hall) : Math.max(1, CONFIG.trainCost[key] - hall);
  return no('points', `That needs ${cost} training points and ${m.name} has ${m.points}, or is already as strong as can be.`);
}

/** Wake one member at the Church (the first wake-up each day is free). */
export function wakeOne(clan: Clan, memberIndex: number): Done {
  const m = memberAt(clan, memberIndex);
  if (!m) return no('member', 'Pick one of your clan.');
  if (!m.knockedOut) return no('awake', `${m.name} is already awake.`);
  const cost = wakeCost(clan, m);
  if (clan.gold < cost) return no('gold', `Waking ${m.name} costs ${cost} gold and the clan has ${clan.gold}.`);
  return wake(clan, m) ? ok : no('gold', 'That cannot be done right now.');
}

export const knockedOutMembers = (clan: Clan) => clan.members.map((m, i) => ({ m, i })).filter(({ m }) => m.knockedOut);

/** The order "wake everyone" goes in: dearest first, so the free wake-up saves the most. */
export const wakeOrder = (clan: Clan) => knockedOutMembers(clan).sort((a, b) => churchCost(b.m) - churchCost(a.m) || a.i - b.i);

/** Levels of the members who would have to pay if everyone were woken now (everyone but the free ones). */
export function wakeAllPayers(clan: Clan): number[] {
  const free = Math.max(0, freeWakes(clan) - (clan.wakesToday ?? 0));
  return wakeOrder(clan).slice(free).map(({ m }) => m.level);
}

/** What waking everyone costs in gold right now. */
export const wakeAllCost = (clan: Clan) => wakeAllPayers(clan).reduce((t, l) => t + (l + 1) * CONFIG.churchPerLevel, 0);

/** Wake everyone, dearest first. Nobody is woken unless the clan can afford the lot. */
export function wakeEveryone(clan: Clan): Done {
  const order = wakeOrder(clan);
  if (order.length === 0) return no('awake', 'Everyone is already awake.');
  const cost = wakeAllCost(clan);
  if (clan.gold < cost) return no('gold', `Waking everyone costs ${cost} gold and the clan has ${clan.gold}.`);
  return order.every(({ i }) => wake(clan, clan.members[i])) ? ok : no('gold', 'That cannot be done right now.');
}

const noMix = (mix: Troops) => TROOP_KINDS.every((k) => mix[k] === 0);

/** Buy a mix of troops in one go, or none of them: the first thing that cannot be done is the answer. Works on the clan it is given, so callers keep a copy. */
export function buyTroopMix(clan: Clan, mix: Troops): Done {
  const e = empireOf(clan);
  if (noMix(mix)) return no('amount', 'Pick how many to buy.');
  const before = { gold: clan.gold, troops: { ...e.troops } };
  for (const kind of TROOP_KINDS) {
    if (mix[kind] === 0) continue;
    const done = buyTroops(clan, kind, mix[kind]);
    if (!done.ok) {
      clan.gold = before.gold;
      e.troops = before.troops;
      return done;
    }
  }
  return ok;
}

/** The seed for the next raid or Friendly War: from the clan's seed and how many there have been. */
export const raidSeed = (baseSeed: number, raidNo: number) => Math.imul(baseSeed | 0, 0x2545f491) ^ Math.imul(raidNo + 1, 0x27d4eb2f);

export type WarOutcome = { ok: true; result: BattleResult; gold: number; friendly: boolean } | Extract<Done, { ok: false }>;

/** Send the army to a kingdom: a real raid (loses troops, wins loot) or a Friendly War (changes nothing). Always 3 rounds and 10% loot; the child picks only the push. */
export function sendArmyTo(clan: Clan, kingdomId: string, push: Push, friendly: boolean, seed: number): WarOutcome {
  const e = empireOf(clan);
  if (friendly) {
    const r = friendlyWar(e, kingdomId, push, seed);
    return r.ok ? { ok: true, result: r.result, gold: 0, friendly } : r;
  }
  const r = raidKingdom(clan, kingdomId, push, seed);
  return r.ok ? { ok: true, result: r.result, gold: r.gold, friendly } : r;
}

/** The seed for a mine fight: from the clan's seed and how many fights there have been (the fight about to start is number `fightNo` + 1). */
export const fightSeed = (baseSeed: number, fightNo: number) => Math.imul(baseSeed | 0, 0x9e3779b1) ^ Math.imul(fightNo + 1, 0x85ebca6b);

/** How a finished fight went, for the results screen. */
export interface FightSummary {
  result: FightState['result'];
  gold: number;
  followers: number;
  xp: number[];
  /** Levels gained by each member. */
  levels: number[];
}

/**
 * Pay out a finished fight on the clan it was played for: surviving HP and SP (with the rest between fights), knock-outs,
 * experience and levels, then the gold and followers. The browser's test page and the server both call this one function.
 */
export function payFight(clan: Clan, fight: FightState): FightSummary {
  const levels = settle(clan.members, fight, gainXp);
  clan.gold += fight.gold;
  clan.followers += fight.followers;
  // Followers join by themselves as footmen, as far as the barracks have room; the rest stay as followers.
  joinFollowers(clan);
  return { result: fight.result, gold: fight.gold, followers: fight.followers, xp: fight.xp, levels };
}
