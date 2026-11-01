import { describe, expect, it } from 'vitest';
import { GEAR_KINDS, refreshGear, rollMember, wear, wornTier } from './character';
import { CLASSES } from './gamedata';
import { CLASS_FOCUS, ITEMS, OLD_ITEM_TIERS, SMITHY_TIERS, TIER_PRICES, itemAt, itemLine, smithyFor, unlockedTier } from './items';
import { newClan } from './sim';
import type { GearStat, ItemDef } from './types';

const dice = (seed = 1) => ({ rng: seed });
const total = (i: ItemDef) => Object.values(i.bonus).reduce((t, v) => t + (v ?? 0), 0);
/** The stat an item gives most of (its main stat). */
const main = (i: ItemDef) => (Object.entries(i.bonus) as [GearStat, number][]).sort((a, b) => b[1] - a[1])[0][0];

describe('the class lines', () => {
  it('give every class 7 weapons, 6 armours and 6 off-hand items, tier 1 upwards, with names used once', () => {
    for (const c of CLASSES) {
      expect(itemLine(c.name, 'weapon').map((i) => i.tier), c.name).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(itemLine(c.name, 'armor').map((i) => i.tier), c.name).toEqual([1, 2, 3, 4, 5, 6]);
      expect(itemLine(c.name, 'shield').map((i) => i.tier), c.name).toEqual([1, 2, 3, 4, 5, 6]);
    }
    expect(new Set(ITEMS.map((i) => i.name)).size).toBe(ITEMS.length);
  });

  it('only add (no minuses), and each tier is at least as good in every stat and better overall than the one before', () => {
    for (const c of CLASSES) for (const kind of GEAR_KINDS) {
      const line = itemLine(c.name, kind);
      for (const i of line) for (const v of Object.values(i.bonus)) expect(v, i.name).toBeGreaterThan(0);
      for (let t = 1; t < line.length; t++) {
        const [was, now] = [line[t - 1], line[t]];
        for (const s of Object.keys(was.bonus) as GearStat[]) expect(now.bonus[s] ?? 0, `${now.name} ${s}`).toBeGreaterThanOrEqual(was.bonus[s]!);
        expect(total(now), now.name).toBeGreaterThan(total(was));
      }
    }
  });

  it('cost more each tier, in round tens (so 10% off is whole), and tier 1 is free', () => {
    for (const kind of GEAR_KINDS) {
      const prices = TIER_PRICES[kind];
      expect(prices[0]).toBe(0);
      for (let t = 1; t < prices.length; t++) {
        expect(prices[t]).toBeGreaterThan(prices[t - 1]);
        expect(prices[t] % 10).toBe(0);
      }
    }
    for (const i of ITEMS) expect(i.price).toBe(TIER_PRICES[i.kind][i.tier - 1]);
  });

  it('give each class its recommended (R) stats (a weapon mostly one; armour and shields armour or one), and every one of them somewhere', () => {
    for (const c of CLASSES) {
      const focus = CLASS_FOCUS[c.name];
      expect(focus, c.name).toBeDefined();
      const given = new Set<GearStat>();
      for (const kind of GEAR_KINDS) {
        for (const i of itemLine(c.name, kind)) {
          expect(Object.keys(i.bonus).some((s) => focus.includes(s as GearStat)), `${i.name} gives an (R) stat`).toBe(true);
          expect(kind === 'weapon' ? focus : [...focus, 'armor'], `${i.name} gives mostly ${main(i)}`).toContain(main(i));
          for (const s of Object.keys(i.bonus) as GearStat[]) given.add(s);
        }
      }
      for (const s of focus) expect([...given], `${c.name} ${s}`).toContain(s);
    }
  });

  it('keep the top weapon a step up, not a game breaker', () => {
    for (const c of CLASSES) {
      const [six, top] = [itemAt(c.name, 'weapon', 6)!, itemAt(c.name, 'weapon', 7)!];
      expect(top.bonus[main(six)]! - six.bonus[main(six)]!, c.name).toBeLessThanOrEqual(5);
    }
  });
});

describe('the Smithy', () => {
  it('sells tier 2 from the start, one more tier a level, and the top weapon only when fully built', () => {
    expect(unlockedTier(0)).toBe(2);
    expect(SMITHY_TIERS).toHaveLength(7);
    for (let l = 1; l < SMITHY_TIERS.length; l++) expect(unlockedTier(l)).toBeGreaterThanOrEqual(unlockedTier(l - 1));
    expect(smithyFor(7)).toBe(6);
    expect(smithyFor(2)).toBe(0);
    expect(smithyFor(3)).toBe(1);
  });
});

describe('wearing gear', () => {
  it('starts every new member in tier 1 of their own line', () => {
    for (const c of CLASSES) {
      const m = rollMember(dice(), 'A', 'Human', c.name);
      for (const kind of GEAR_KINDS) expect(m.gear[kind]).toBe(itemAt(c.name, kind, 1)!.name);
    }
  });

  it('adds an item\'s HP and SP to the member\'s max, and swaps them out with the item', () => {
    const m = rollMember(dice(), 'A', 'Dwarf', 'Barbarian');
    const [hp, maxHp] = [m.hp, m.maxHp];
    const armour = itemAt('Barbarian', 'armor', 4)!;
    wear(m, armour);
    expect(m.maxHp).toBe(maxHp + armour.bonus.hp!);
    expect(m.hp).toBe(hp + armour.bonus.hp!);
    wear(m, itemAt('Barbarian', 'armor', 1)!);
    expect(m.maxHp).toBe(maxHp);
  });
});

describe('refreshGear', () => {
  it('swaps a save\'s old items for the same slot of the member\'s line, at the tier the old price was worth, once', () => {
    const clan = newClan('balanced', 1);
    delete clan.gearVersion;
    const [a, b] = clan.members;
    a.gear = { weapon: 'Sky Sword', armor: 'Leather Armor' };
    b.gear = { weapon: 'Dagger', shield: "Hero's Shield" };
    const maxHp = a.maxHp;
    expect(refreshGear(clan)).toBe(true);
    expect(clan.gearVersion).toBe(2);
    expect(a.gear).toEqual({ weapon: itemAt(a.cls, 'weapon', OLD_ITEM_TIERS['Sky Sword'])!.name, armor: itemAt(a.cls, 'armor', 2)!.name, shield: itemAt(a.cls, 'shield', 1)!.name });
    expect(a.maxHp).toBe(maxHp + GEAR_KINDS.reduce((t, k) => t + (itemAt(a.cls, k, wornTier(a, k))!.bonus.hp ?? 0), 0));
    expect(wornTier(b, 'weapon')).toBe(2);
    expect(wornTier(b, 'armor')).toBe(1);
    expect(wornTier(b, 'shield')).toBe(5);
    const again = structuredClone(clan);
    expect(refreshGear(again)).toBe(false);
    expect(again).toEqual(clan);
  });

  it('moves a member who changed class onto their new line at the same tier', () => {
    const clan = newClan('balanced', 1);
    const m = clan.members[0];
    wear(m, itemAt(m.cls, 'weapon', 3)!);
    const other = CLASSES.find((c) => c.name !== m.cls)!.name;
    m.cls = other;
    expect(refreshGear(clan)).toBe(true);
    expect(m.gear.weapon).toBe(itemAt(other, 'weapon', 3)!.name);
    expect(wornTier(m, 'armor')).toBe(1);
  });
});
