/**
 * A sensible, not clever, player. Used by the simulator to see how fast a clan grows and how
 * often fights are won, and for the round plan the fight screen suggests. It plans each member in
 * the order they act, keeping a running guess of the damage already planned on each enemy, so it
 * heals first, swings when a swing will do, spreads its hits and saves its skill points for
 * spells that beat a swing.
 *
 * Tried and left out (the simulator lost too many fights with them): keeping SP back for a heal,
 * casting at the enemy with most HP left, and asking a spell to beat a swing by half again.
 * Guard and tie-up spells are left out too, as a later idea.
 */
import { buy, inShop, shopPrice, trainHp, trainSp, trainStat, usableBonus, wake } from './character';
import { CONFIG } from './config';
import { levelOf } from './empire';
import { canCast, type FightState, type Fighter, type Order } from './fight';
import { SPELLS, type SpellDef } from './spells';
import type { Clan, ItemDef, Member, Stat } from './types';

/** Heal anyone under this share of their HP. */
const HURT = 0.45;
/** A swing at least this likely to hit, for enough damage, will finish an enemy. */
const LIKELY = 0.7;
/** A spell has to do this many times a swing's damage to be worth its SP. */
const SPELL_MARGIN = 1.2;

// The engine's own sums (fight.ts), without the dice.
const stat = (f: Fighter, st: Stat) => Math.max(0, Math.min(CONFIG.statCap, f.mods.reduce((v, m) => v + m.amount, f.stats[st])));
const alive = (f: Fighter) => f.hp > 0;

/** Chance a swing hits: dexterity + 2 + two dice of 0-3 against agility + one die of 0-3. */
function hitChance(who: Fighter, target: Fighter): number {
  let hits = 0;
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) if (stat(who, 'dexterity') + a + b + 2 >= stat(target, 'agility') + c) hits++;
  return hits / 64;
}

/** A swing's damage when it hits, from the middle of the 80-119% roll. */
const swingDamage = (who: Fighter, target: Fighter) => Math.max(1, Math.floor(stat(who, 'strength') / 2) - stat(target, 'armor'));

/** A damage spell's usual damage (the roll is 50-109%, so about 80%). */
const spellDamage = (who: Fighter, sp: SpellDef) => Math.max(1, Math.floor((sp.value + Math.floor((Math.min(who.level, 10) + stat(who, 'wisdom')) / 3)) * 0.8));

/** A heal's usual amount (the roll is 50-99%, so about 75%). */
const healAmount = (who: Fighter, sp: SpellDef) => Math.floor((sp.value + Math.floor(Math.min(who.level, 10) / 2)) * 0.75);

const castable = (who: Fighter, kind: SpellDef['kind']) => who.spells.map((id) => SPELLS[id]).filter((sp) => sp && sp.kind === kind && canCast(who, sp.id));

interface Plan {
  /** Damage already planned on each enemy this round. */
  planned: number[];
  /** Clan members someone is already healing. */
  healed: Set<number>;
}

export function botOrders(s: FightState): Order[] {
  const orders: Order[] = s.clan.map(() => ({ action: 'skip' }));
  const plan: Plan = { planned: s.enemies.map(() => 0), healed: new Set() };
  // Fastest first, as playRound sorts them (without its small dice).
  const speed = (f: Fighter) => stat(f, 'agility') + Math.floor((f.hp * 10) / f.maxHp);
  const turns = s.clan.filter(alive).sort((a, b) => speed(b) - speed(a) || a.index - b.index);
  for (const who of turns) orders[who.index] = chooseOrder(s, who, plan);
  return orders;
}

function chooseOrder(s: FightState, who: Fighter, plan: Plan): Order {
  const enemies = s.enemies.filter(alive);
  if (!enemies.length) return { action: 'skip' };
  const left = (e: Fighter) => e.hp - plan.planned[e.index];

  // 1. Heal someone badly hurt (one heal each), with the smallest heal that covers most of the gap.
  const hurt = s.clan.filter((f) => alive(f) && f.hp < f.maxHp * HURT && !plan.healed.has(f.index)).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  const heals = castable(who, 'heal').sort((a, b) => a.value - b.value);
  if (hurt && heals.length) {
    const gap = hurt.maxHp - hurt.hp;
    const heal = heals.find((sp) => healAmount(who, sp) >= gap * 0.75) ?? heals[heals.length - 1];
    plan.healed.add(hurt.index);
    return { action: 'spell', spell: heal.id, target: hurt.index };
  }

  // 2. Spread: the weakest enemy the plan hasn't already finished (or, if every one is, the least sure).
  const open = enemies.filter((e) => left(e) > 0).sort((a, b) => left(a) - left(b) || a.index - b.index);
  const target = open[0] ?? [...enemies].sort((a, b) => left(b) - left(a) || a.index - b.index)[0];
  const chance = hitChance(who, target);
  const swing = (): Order => {
    plan.planned[target.index] += chance * swingDamage(who, target);
    return { action: 'attack', target: target.index };
  };

  // 3. No overkill: if a swing will probably finish it, swing.
  if (!open.length || (chance >= LIKELY && swingDamage(who, target) >= left(target))) return swing();

  // 4. A damage spell only when it beats the swing: on this enemy, or on every enemy when three or
  // more are standing. The cheapest one that finishes the job, else the cheapest of the strongest.
  const swingWorth = chance * Math.min(swingDamage(who, target), left(target));
  const options = castable(who, 'damage')
    .filter((sp) => !sp.all || enemies.length >= 3)
    .map((sp) => {
      const hits = sp.all ? open : [target];
      const worth = hits.reduce((t, e) => t + Math.min(spellDamage(who, sp), left(e)), 0);
      return { sp, hits, worth, finishes: hits.every((e) => spellDamage(who, sp) >= left(e)) };
    })
    .filter((o) => o.worth >= swingWorth * SPELL_MARGIN);
  const best = Math.max(0, ...options.map((o) => o.worth));
  const pick = options.filter((o) => o.finishes || o.worth >= best * 0.9).sort((a, b) => a.sp.sp - b.sp.sp || b.worth - a.worth)[0];
  if (!pick) return swing();
  for (const e of pick.hits) plan.planned[e.index] += spellDamage(who, pick.sp);
  return { action: 'spell', spell: pick.sp.id, target: pick.hits[0].index };
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
      const best = inShop(levelOf(clan, 'smithy'))
        .filter((i) => i.kind === kind && shopPrice(i) <= clan.gold && worth(m, i) > mine)
        .sort((a, b) => worth(m, b) - worth(m, a) || a.price - b.price)[0];
      if (best) buy(clan, m, best);
    }
  }
}

/** The between-fights chores: wake the knocked out (cheapest first), spend points, shop. */
export function botChores(clan: Clan): void {
  for (const m of [...clan.members].filter((x) => x.knockedOut).sort((a, b) => b.level - a.level)) wake(clan, m);
  for (const m of clan.members) botTrain(m, levelOf(clan, 'trainingHall'));
  botShop(clan);
}

export const averageLevel = (clan: Clan) => clan.members.reduce((t, m) => t + m.level, 0) / clan.members.length;
