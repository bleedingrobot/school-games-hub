/** Making and growing clan members: rolling stats, gear, levels, training, the Church and the shop. */
import { CONFIG } from './config';
import { CLASSES, ITEMS, RACES } from './gamedata';
import { roll, type HasRng } from './rng';
import { STATS, type Clan, type ItemDef, type Member, type Stat, type Stats } from './types';

export const raceByName = (name: string) => RACES.find((r) => r.name === name);
export const classByName = (name: string) => CLASSES.find((c) => c.name === name);
export const itemByName = (name: string) => ITEMS.find((i) => i.name === name);

const emptyStats = (): Stats => ({ agility: 0, dexterity: 0, strength: 0, wisdom: 0, armor: 0, charisma: 0 });
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Race + class, then a small roll (-1 to +1 on each stat, -2 to +2 on HP and SP) for "Roll again".
 * The clan leader gets +2 on every stat but armour and +4 HP. Same dice state, same roll.
 */
export function rollMember(dice: HasRng, name: string, race: string, cls: string, leader = false): Member {
  const r = raceByName(race);
  const c = classByName(cls);
  if (!r || !c) throw new Error(`Unknown race or class: ${race} ${cls}`);
  const stats = emptyStats();
  for (const s of STATS) {
    const wobble = s === 'armor' ? 0 : roll(dice, 3) - 1;
    stats[s] = clamp(r.stats[s] + c.stats[s] + wobble + (leader && s !== 'armor' ? 2 : 0), 0, CONFIG.statCap);
  }
  const maxHp = Math.max(5, r.hp + c.hp + roll(dice, 5) - 2 + (leader ? 4 : 0));
  const maxSp = Math.max(0, r.sp + c.sp + roll(dice, 5) - 2);
  const spells = [...new Set([...r.spells, ...c.spells])];
  return { name, race, cls, level: 1, xp: 0, hp: maxHp, maxHp, sp: maxSp, maxSp, stats, spells, gear: {}, points: 0, knockedOut: false };
}

/** Gear bonuses count only if the member's base stats meet the item's needs. */
export function usableBonus(m: Member, item: ItemDef | undefined): Partial<Stats> {
  if (!item) return {};
  for (const s of STATS) if ((item.needs[s] ?? 0) > m.stats[s]) return {};
  return item.bonus;
}

/** What a member fights with: base stats plus usable gear. */
export function fightStats(m: Member): Stats {
  const out = { ...m.stats };
  for (const name of [m.gear.weapon, m.gear.armor, m.gear.shield]) {
    const bonus = usableBonus(m, name ? itemByName(name) : undefined);
    for (const s of STATS) out[s] = clamp(out[s] + (bonus[s] ?? 0), 0, CONFIG.statCap);
  }
  return out;
}

/** Add experience and level up as often as it earns. Returns how many levels were gained. */
export function gainXp(m: Member, amount: number): number {
  m.xp += amount;
  let gained = 0;
  while (m.level < CONFIG.maxLevel && m.xp >= CONFIG.xpToReach(m.level + 1)) {
    m.level++;
    m.points += CONFIG.pointsPerLevel;
    gained++;
  }
  return gained;
}

/** Points to raise a stat by 1 with the Training Hall at `hall` (never below 1). */
export const trainCost = (stat: Stat, hall: number) => Math.max(1, CONFIG.trainCost[stat] - hall);

/** Spend points on +1 of a stat. Returns false (and changes nothing) if it can't. */
export function trainStat(m: Member, stat: Stat, hall: number): boolean {
  const cost = trainCost(stat, hall);
  if (m.points < cost || m.stats[stat] >= CONFIG.statCap) return false;
  m.points -= cost;
  m.stats[stat]++;
  return true;
}

/** Points for one HP purchase and one SP purchase with the Training Hall at `hall` (never below 1). */
export const hpCost = (hall: number) => Math.max(1, CONFIG.hpBuy.cost - Math.floor(hall / 2));
export const spCost = (hall: number) => Math.max(1, CONFIG.spBuy.cost - Math.floor(hall / 2));

export function trainHp(m: Member, hall: number): boolean {
  const cost = hpCost(hall);
  if (m.points < cost) return false;
  m.points -= cost;
  m.maxHp += CONFIG.hpBuy.amount;
  m.hp += CONFIG.hpBuy.amount;
  return true;
}

export function trainSp(m: Member, hall: number): boolean {
  const cost = spCost(hall);
  if (m.points < cost) return false;
  m.points -= cost;
  m.maxSp += CONFIG.spBuy.amount;
  m.sp += CONFIG.spBuy.amount;
  return true;
}

/** The Church: gold to wake a knocked-out member. */
export const churchCost = (m: Member) => (m.level + 1) * CONFIG.churchPerLevel;

/** What waking this member costs the clan right now (nothing while free wake-ups are left today). */
export const wakeCost = (clan: Clan, m: Member) => ((clan.wakesToday ?? 0) < CONFIG.freeWakesPerDay ? 0 : churchCost(m));

export function wake(clan: Clan, m: Member): boolean {
  const cost = wakeCost(clan, m);
  if (!m.knockedOut || clan.gold < cost) return false;
  clan.gold -= cost;
  clan.wakesToday = (clan.wakesToday ?? 0) + 1;
  m.knockedOut = false;
  m.hp = Math.max(1, Math.ceil(m.maxHp / 2));
  return true;
}

/** Shop price including the village tax, rounded up. */
export const shopPrice = (item: ItemDef, tax: number = CONFIG.shopTax) => Math.ceil((item.price * (100 + tax)) / 100);

/** Cost to look at an item's real stats. */
export const examineCost = (item: ItemDef) => Math.ceil((item.price * CONFIG.examinePercent) / 100);

/** What the Smithy has on its shelves at a given level. */
export const inShop = (smithy: number) => ITEMS.filter((i) => i.shopLevel >= 6 - smithy);

export function buy(clan: Clan, m: Member, item: ItemDef): boolean {
  const price = shopPrice(item);
  if (clan.gold < price || !inShop(clan.village.smithy).includes(item)) return false;
  clan.gold -= price;
  m.gear[item.kind] = item.name;
  return true;
}

/** Overnight: everyone wakes up healed. */
export function dayReset(clan: Clan): void {
  clan.wakesToday = 0;
  for (const m of clan.members) {
    m.knockedOut = false;
    m.hp = m.maxHp;
    m.sp = m.maxSp;
  }
}

export type DepthHint = 'too easy' | 'just right' | 'tough' | 'too hard';

/** The hint shown beside a mine depth, from how far it is above the clan's average level. */
export function depthHint(depth: number, averageLevel: number): DepthHint {
  const gap = depth - averageLevel;
  const h = CONFIG.depthHint;
  return gap <= h.easyUpTo ? 'too easy' : gap <= h.justRightUpTo ? 'just right' : gap <= h.toughUpTo ? 'tough' : 'too hard';
}
