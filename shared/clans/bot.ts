/**
 * A sensible, not clever, player. Used by the simulator to see how fast a clan grows and how
 * often fights are won, and later for computer clans. It focuses fire, heals the weakest, and
 * casts a damage spell when that beats a swing.
 */
import { buy, inShop, shopPrice, trainHp, trainSp, trainStat, usableBonus, wake } from './character';
import { canCast, type FightState, type Fighter, type Order } from './fight';
import { SPELLS } from './spells';
import type { Clan, ItemDef, Member, Stat } from './types';

export function botOrders(s: FightState): Order[] {
  const orders: Order[] = [];
  const liveEnemies = s.enemies.filter((f) => f.hp > 0);
  const weakest = [...liveEnemies].sort((a, b) => a.hp - b.hp)[0];
  for (const who of s.clan) {
    if (who.hp <= 0) {
      orders.push({ action: 'skip' });
      continue;
    }
    orders.push(chooseOrder(s, who, weakest));
  }
  return orders;
}

function chooseOrder(s: FightState, who: Fighter, weakest: Fighter | undefined): Order {
  if (!weakest) return { action: 'skip' };
  // Heal someone badly hurt.
  const hurtAlly = s.clan.filter((f) => f.hp > 0 && f.hp < f.maxHp * 0.45).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  if (hurtAlly) {
    const heal = who.spells.map((id) => SPELLS[id]).filter((sp) => sp && sp.kind === 'heal' && canCast(who, sp.id)).sort((a, b) => b.value - a.value)[0];
    if (heal) return { action: 'spell', spell: heal.id, target: hurtAlly.index };
  }
  // A damage spell, if it is likely to beat a swing.
  const swing = Math.floor(who.stats.strength / 2);
  const attacks = who.spells
    .map((id) => SPELLS[id])
    .filter((sp) => sp && sp.kind === 'damage' && canCast(who, sp.id))
    .map((sp) => ({ sp, power: (sp.value + Math.floor((Math.min(who.level, 10) + who.stats.wisdom) / 3)) * 0.8 * (sp.all ? s.enemies.filter((e) => e.hp > 0).length : 1) }))
    .sort((a, b) => b.power - a.power)[0];
  if (attacks && attacks.power > swing * 1.2) return { action: 'spell', spell: attacks.sp.id, target: weakest.index };
  return { action: 'attack', target: weakest.index };
}

const MARTIAL: [Stat, number][] = [['strength', 3], ['dexterity', 2], ['agility', 2]];
const CASTER: [Stat, number][] = [['wisdom', 3], ['agility', 1], ['dexterity', 1]];

/** Spend a member's training points: a rough mix, strength-first for fighters, wisdom-first for casters. */
export function botTrain(m: Member, hall: number): void {
  const caster = m.stats.wisdom > m.stats.strength || m.maxSp > 14;
  const plan = caster ? CASTER : MARTIAL;
  const wheel: ('hp' | 'sp' | Stat)[] = [];
  for (const [st, n] of plan) for (let i = 0; i < n; i++) wheel.push(st);
  wheel.push('hp', 'hp', 'armor');
  if (caster) wheel.push('sp', 'sp');
  let i = 0;
  let stuck = 0;
  while (stuck < wheel.length) {
    const pick = wheel[i++ % wheel.length];
    const ok = pick === 'hp' ? trainHp(m, hall) : pick === 'sp' ? trainSp(m, hall) : trainStat(m, pick, hall);
    stuck = ok ? 0 : stuck + 1;
  }
}

/** How good an item is for a member right now (0 if its bonuses won't count). */
function worth(m: Member, item: ItemDef): number {
  const bonus = usableBonus(m, item);
  let total = 0;
  for (const [st, v] of Object.entries(bonus)) total += (st === 'strength' || st === 'armor' ? 2 : 1) * (v as number);
  return total;
}

/** Buy the best upgrade each member can afford, cheapest members' needs first. */
export function botShop(clan: Clan): void {
  for (const m of clan.members) {
    for (const kind of ['weapon', 'armor', 'shield'] as const) {
      const have = m.gear[kind] ? inShop(6).find((i) => i.name === m.gear[kind]) : undefined;
      const mine = have ? worth(m, have) : 0;
      const best = inShop(clan.village.smithy)
        .filter((i) => i.kind === kind && shopPrice(i) <= clan.gold && worth(m, i) > mine)
        .sort((a, b) => worth(m, b) - worth(m, a) || a.price - b.price)[0];
      if (best) buy(clan, m, best);
    }
  }
}

/** The between-fights chores: wake the knocked out (cheapest first), spend points, shop. */
export function botChores(clan: Clan): void {
  for (const m of [...clan.members].filter((x) => x.knockedOut).sort((a, b) => a.level - b.level)) wake(clan, m);
  for (const m of clan.members) botTrain(m, clan.village.trainingHall);
  botShop(clan);
}

export const averageLevel = (clan: Clan) => clan.members.reduce((t, m) => t + m.level, 0) / clan.members.length;
