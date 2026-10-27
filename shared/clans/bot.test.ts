/**
 * The bot's round plan (it is also what the fight screen suggests): small hand-built fights where the
 * sensible order is clear.
 */
import { describe, expect, it } from 'vitest';
import { botOrders } from './bot';
import type { FightState, Fighter } from './fight';
import type { Stats } from './types';

const STATS: Stats = { strength: 20, dexterity: 15, agility: 10, wisdom: 10, armor: 0, charisma: 5 } as Stats;

function fighter(side: Fighter['side'], index: number, name: string, extra: Partial<Fighter> = {}, stats: Partial<Stats> = {}): Fighter {
  return {
    side, index, name, level: 8, hp: 40, maxHp: 40, sp: 0, maxSp: 0, stats: { ...STATS, ...stats }, spells: [], mods: [], tied: 0,
    guarding: false, difficulty: 3, ...extra,
  };
}

function fight(clan: Fighter[], enemies: Fighter[]): FightState {
  return { rng: 1, seed: 1, depth: 5, round: 0, clan, enemies, result: null, xp: clan.map(() => 0), gold: 0, followers: 0, log: [] };
}

const LIGHTNING = 15;
const FIREBALL = 8;
const WITHER = 12;
const LITTLE_HEAL = 1;
const HEAL = 2;

describe('the bot round plan', () => {
  it('swings at a 5 HP Scruffy Dog instead of spending Lightning Bolt on it', () => {
    const pip = fighter('clan', 0, 'Pip', { sp: 30, maxSp: 30, spells: [LIGHTNING] });
    const s = fight([pip], [fighter('enemy', 0, 'Scruffy Dog', { hp: 5, maxHp: 20 })]);
    expect(botOrders(s)).toEqual([{ action: 'attack', target: 0 }]);
  });

  it('still uses a big spell on an enemy that needs it', () => {
    const pip = fighter('clan', 0, 'Pip', { sp: 30, maxSp: 30, spells: [LIGHTNING] }, { strength: 8 });
    const s = fight([pip], [fighter('enemy', 0, 'Troll', { hp: 60, maxHp: 60 })]);
    expect(botOrders(s)).toEqual([{ action: 'spell', spell: LIGHTNING, target: 0 }]);
  });

  it("doesn't send a second member at an enemy the first will finish", () => {
    const fast = fighter('clan', 0, 'Ash', {}, { agility: 20 });
    const slow = fighter('clan', 1, 'Birch');
    const s = fight([fast, slow], [fighter('enemy', 0, 'Rat', { hp: 6, maxHp: 10 }), fighter('enemy', 1, 'Goblin', { hp: 30, maxHp: 30 })]);
    expect(botOrders(s)).toEqual([{ action: 'attack', target: 0 }, { action: 'attack', target: 1 }]);
  });

  it("two healers don't both heal the same member", () => {
    const elm = fighter('clan', 0, 'Elm', { sp: 30, maxSp: 30, spells: [LITTLE_HEAL] }, { agility: 20 });
    const oak = fighter('clan', 1, 'Oak', { sp: 30, maxSp: 30, spells: [LITTLE_HEAL] });
    const s = fight([elm, oak, fighter('clan', 2, 'Ash', { hp: 5 }), fighter('clan', 3, 'Fern', { hp: 10 })], [fighter('enemy', 0, 'Goblin')]);
    const [first, second] = botOrders(s);
    expect(first).toEqual({ action: 'spell', spell: LITTLE_HEAL, target: 2 });
    expect(second).toEqual({ action: 'spell', spell: LITTLE_HEAL, target: 3 });
  });

  it('heals someone badly hurt, with the smallest heal that covers most of the gap', () => {
    const healer = fighter('clan', 0, 'Elm', { sp: 30, maxSp: 30, spells: [LITTLE_HEAL, HEAL] });
    const scratched = fighter('clan', 1, 'Ash', { hp: 9, maxHp: 22 });
    const s = fight([healer, scratched], [fighter('enemy', 0, 'Goblin')]);
    expect(botOrders(s)[0]).toEqual({ action: 'spell', spell: LITTLE_HEAL, target: 1 });
    scratched.maxHp = 60;
    scratched.hp = 20;
    expect(botOrders(s)[0]).toEqual({ action: 'spell', spell: HEAL, target: 1 });
  });

  it('uses "hits every enemy" against three or more, but not against two', () => {
    const caster = () => fighter('clan', 0, 'Fern', { sp: 30, maxSp: 30, spells: [WITHER] }, { strength: 4, wisdom: 20 });
    const pack = (n: number) => Array.from({ length: n }, (_, i) => fighter('enemy', i, `Wolf ${i + 1}`, { hp: 20, maxHp: 20 }));
    expect(botOrders(fight([caster()], pack(3)))[0]).toMatchObject({ action: 'spell', spell: WITHER });
    expect(botOrders(fight([caster()], pack(2)))[0]).toMatchObject({ action: 'attack' });
  });

  it('a knocked-out member gets skip', () => {
    const s = fight([fighter('clan', 0, 'Ash', { hp: 0 }), fighter('clan', 1, 'Birch')], [fighter('enemy', 0, 'Goblin')]);
    expect(botOrders(s)).toEqual([{ action: 'skip' }, { action: 'attack', target: 0 }]);
  });

  it('the same fight always gives the same orders', () => {
    const make = () =>
      fight(
        [fighter('clan', 0, 'Ash'), fighter('clan', 1, 'Elm', { sp: 20, maxSp: 20, spells: [LITTLE_HEAL, FIREBALL] }), fighter('clan', 2, 'Fern', { hp: 9 })],
        [fighter('enemy', 0, 'Rat', { hp: 4 }), fighter('enemy', 1, 'Goblin'), fighter('enemy', 2, 'Troll', { hp: 70, maxHp: 70 })],
      );
    expect(botOrders(make())).toEqual(botOrders(make()));
  });
});
