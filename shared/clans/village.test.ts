import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyAction, parseAction, type Action, type Context, type ServerState } from './actions';
import { CONFIG } from './config';
import { startingDrafts } from './create';
import { empireOf, newEmpire } from './empire';
import { levelTotal, might, safeGold } from './empire';
import { closeWeek, goalOf, raidNote, raidTargetList, voteOptions, weekOf, winner, VILLAGE_KINDS, villageCost, villageMax, type RaidTarget, type Sketch } from './village';
import type { Empire, Village } from './types';

// The class village (chest, vote, closeWeek) is no longer used by the game. Its functions stay because the SQL night job and the
// parity tests at the bottom of this file still read them; the actions that used them (chestGive, vote) are gone.

const SEED = 123456;
const TODAY = 20_000;
const ctx = (over: Partial<Context> = {}): Context => ({ seed: SEED, today: TODAY, ...over });

function created(): ServerState {
  const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, ctx());
  if (!out.ok || !out.state) throw new Error('create failed');
  return out.state;
}
/** A clan that began a fortnight ago with an army of the given size. */
function veteran(footmen: number, gold = 1000): ServerState {
  const s = created();
  s.createdNzDay = TODAY - 14;
  s.day = 15;
  const e = empireOf(s.clan);
  e.levels.barracks = 5;
  e.troops = { footman: footmen, axeman: 0, knight: 0 };
  s.clan.gold = gold;
  return s;
}
const target = (footmen = 40, gold = 800): RaidTarget & { empire: Empire } => {
  const e: Empire = { ...newEmpire(), troops: { footman: footmen, axeman: 0, knight: 0 } };
  return { id: 'blue-fox-1', name: 'Blue Fox', createdNzDay: TODAY - 14, empire: e, gold };
};
const levels = (t = 0, s = 0, c = 0): Village => ({ trainingHall: t, smithy: s, church: c });
const raid = (s: ServerState, t: RaidTarget | null, over: Partial<Context> = {}, a: Partial<Extract<Action, { type: 'raidClass' }>> = {}) =>
  applyAction(s, { type: 'raidClass', target: t?.id ?? 'nobody', take: 'gold', push: 'steady', ...a }, ctx({ self: 'red-1', raidsOn: true, target: t, ...over }));

describe('weeks and costs', () => {
  it('weeks start on Monday (1 Jan 1970 was a Thursday)', () => {
    expect(weekOf(3)).toBe(weekOf(0)); // Sunday 4 Jan 1970 is still the week of Thursday 1 Jan... (day 3 = Sunday)
    expect(weekOf(4)).toBe(weekOf(3) + 1); // Monday 5 Jan starts a new week
    expect(weekOf(10)).toBe(weekOf(4));
    expect(weekOf(11)).toBe(weekOf(4) + 1);
  });
  it('costs go up with each level and every building has a top level', () => {
    for (const k of VILLAGE_KINDS) {
      expect(villageMax(k)).toBeGreaterThan(0);
      expect(villageCost(k, 2)).toBeGreaterThan(villageCost(k, 1));
    }
    expect(voteOptions(levels())).toHaveLength(3);
    expect(voteOptions(levels(5, 0, 3)).map((o) => o.kind)).toEqual(['smithy']);
    expect(voteOptions(levels(5, 6, 3))).toEqual([]);
  });
});

describe('the weekly vote', () => {
  it('most votes wins, a tie goes to the cheaper one, nobody voting builds nothing', () => {
    expect(winner(levels(), { church: 3, smithy: 2 })?.kind).toBe('church');
    expect(winner(levels(), { smithy: 2, trainingHall: 2 })?.kind).toBe('smithy'); // 250 is cheaper than 300
    expect(winner(levels(), {})).toBeNull();
    // A building that is already finished cannot win.
    expect(winner(levels(5), { trainingHall: 9, church: 1 })?.kind).toBe('church');
  });
  it('builds the winner when the chest covers it and takes exactly its cost', () => {
    const cost = villageCost('church', 1);
    const done = closeWeek(levels(), cost + 25, { church: 4 });
    expect(done.levels.church).toBe(1);
    expect(done.chest).toBe(25);
    expect(done.news).toBe('The class built the Church (level 1)!');
  });
  it('builds nothing when the chest is short, and says by how much', () => {
    const done = closeWeek(levels(), 100, { church: 4 });
    expect(done.levels).toEqual(levels());
    expect(done.chest).toBe(100);
    expect(done.built).toBeNull();
    expect(done.news).toBe(`The class voted for the Church (level 1) but the chest was ${villageCost('church', 1) - 100} gold short.`);
  });
  it('says nothing when nobody voted', () => {
    expect(closeWeek(levels(), 500, {}).news).toBeNull();
  });
  it('never makes the chest negative or a level too high, in 5,000 random weeks', () => {
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
    let l = levels();
    for (let i = 0; i < 5000; i++) {
      const chest = rnd(3000);
      const votes = { trainingHall: rnd(4), smithy: rnd(4), church: rnd(4) };
      const done = closeWeek(l, chest, votes);
      expect(done.chest).toBeGreaterThanOrEqual(0);
      expect(done.chest).toBeLessThanOrEqual(chest);
      for (const k of VILLAGE_KINDS) expect(done.levels[k]).toBeLessThanOrEqual(villageMax(k));
      l = i % 40 === 39 ? levels() : done.levels;
    }
  });
  it('the class goal is the building in the lead, as a fraction of its cost', () => {
    const g = goalOf(levels(), 380, { church: 2 })!;
    expect(g.kind).toBe('church');
    expect(g.text).toBe(`Church level 1: 380 / ${villageCost('church', 1)} gold`);
    expect(g.percent).toBe(Math.floor((380 * 100) / villageCost('church', 1)));
    // Nobody voted: the cheapest. A full chest shows as full.
    expect(goalOf(levels(), 5000, {})!.kind).toBe('smithy');
    expect(goalOf(levels(), 5000, {})!.percent).toBe(100);
    expect(goalOf(levels(5, 6, 3), 5, {})).toBeNull();
  });
});

describe('the Church gives free wake-ups', () => {
  it('each level adds one free wake-up a day', () => {
    const s = created();
    empireOf(s.clan).levels.church = 2;
    s.clan.members.forEach((m) => { m.knockedOut = true; m.hp = 0; });
    const out = applyAction(s, { type: 'wakeAll' }, ctx());
    expect(out.ok && out.state?.clan.gold).toBe(s.clan.gold - s.clan.members.slice(3).reduce((t, m) => t + (m.level + 1) * CONFIG.churchPerLevel, 0));
  });
});

describe('the chest and the vote are gone from the actions', () => {
  it('a browser can no longer send them', () => {
    expect(parseAction({ type: 'vote', kind: 'church' })).toBeNull();
    expect(parseAction({ type: 'chestGive', gold: 50 })).toBeNull();
  });
  it('junk raids are not actions', () => {
    expect(parseAction({ type: 'raidClass', target: 'x', take: 'oust', push: 'steady' })).toBeNull();
    expect(parseAction({ type: 'raidClass', target: 'x', take: 'land', push: 'steady' })).toBeNull();
    expect(parseAction({ type: 'raidClass', target: '', take: 'gold', push: 'steady' })).toBeNull();
    expect(parseAction({ type: 'raidClass', target: 'x', take: 'gold', push: 'wild' })).toBeNull();
    expect(parseAction({ type: 'raidClass', target: 'x', take: 'gold', push: 'bold' })).toEqual({ type: 'raidClass', target: 'x', take: 'gold', push: 'bold' });
    expect(parseAction({ type: 'raidClass', target: 'x', take: 'buildings', push: 'careful' })).not.toBeNull();
  });
});

describe('who can be raided', () => {
  const sketch = (id: string, over: Partial<Sketch> = {}): Sketch => ({ id, name: id, createdNzDay: TODAY - 14, shieldUntil: 0, troops: { footman: 40, axeman: 0, knight: 0 }, ...over });
  it('puts the allowed clans first, with a kind reason for the rest', () => {
    const list = raidTargetList(veteran(40), TODAY, 'red-1', true, [
      sketch('shielded', { shieldUntil: TODAY }), sketch('fair'), sketch('tiny', { troops: { footman: 5, axeman: 0, knight: 0 } }), sketch('new', { createdNzDay: TODAY - 1 }),
    ]);
    expect(list[0]).toMatchObject({ id: 'fair', allowed: true, say: '' });
    expect(list.slice(1).every((t) => !t.allowed && t.say.length > 0)).toBe(true);
    expect(list.find((t) => t.id === 'shielded')?.say).toMatch(/shield/);
    expect(list.find((t) => t.id === 'tiny')?.say).toMatch(/fair match/);
    expect(list.find((t) => t.id === 'new')?.say).toMatch(/protected/);
  });
  it('shows nothing about a clan but its name and whether it is allowed', () => {
    const list = raidTargetList(veteran(40), TODAY, 'red-1', true, [sketch('fair')]);
    expect(Object.keys(list[0]).sort()).toEqual(['allowed', 'id', 'name', 'say']);
  });
  it('is all refused while the teacher has raids off', () => {
    const list = raidTargetList(veteran(40), TODAY, 'red-1', false, [sketch('fair')]);
    expect(list[0].allowed).toBe(false);
    expect(list[0].say).toMatch(/teacher/);
  });
});

describe('a raid on a classmate', () => {
  it('is refused while the teacher has raids off (the default)', () => {
    const out = raid(veteran(40), target(), { raidsOn: false });
    expect(out.ok).toBe(false);
    expect(!out.ok && out.why).toBe('off');
    expect(applyAction(veteran(40), { type: 'raidClass', target: 'blue-fox-1', take: 'gold', push: 'steady' }, ctx({ self: 'red-1', target: target() })).ok).toBe(false);
  });
  it.each([
    ['a clan that is not in the village', () => raid(veteran(40), null), 'target'],
    ['yourself', () => raid(veteran(40), { ...target(), id: 'red-1' }), 'self'],
    ['a new attacker', () => { const s = veteran(40); s.createdNzDay = TODAY - 1; return raid(s, target()); }, 'new-attacker'],
    ['a brand new defender', () => raid(veteran(40), { ...target(), createdNzDay: TODAY - 1 }), 'new-defender'],
    ['an attacker with no troops', () => raid(veteran(0), target()), 'army'],
    ['a defender far too strong', () => raid(veteran(10), target(100)), 'unfair'],
    ['a defender far too small', () => raid(veteran(100), target(10)), 'unfair'],
    ['a shielded defender', () => { const t = target(); t.empire.shieldUntil = TODAY; return raid(veteran(40), t); }, 'shield'],
  ])('refuses %s', (_name, go, why) => {
    const out = go();
    expect(out.ok).toBe(false);
    expect(!out.ok && out.why).toBe(why);
  });
  it('refuses a second raid the same day, and the same clan twice', () => {
    const first = raid(veteran(40), target());
    expect(first.ok).toBe(true);
    const again = raid(first.ok ? first.state! : veteran(40), { ...target(), id: 'green-owl-2' });
    expect(!again.ok && again.why).toBe('limit');
    // Tomorrow the limit is back, but the shield on the first defender holds for the day it was set.
    const s = first.ok ? first.state! : veteran(40);
    const next = applyAction(s, { type: 'load' }, ctx({ today: TODAY + 1 }));
    const second = raid(next.ok ? next.state! : s, target(), { today: TODAY + 1 });
    expect(second.ok).toBe(true);
  });
  it('is refused while a fight is open', () => {
    const s = veteran(40);
    s.fight = { depth: 0, boss: false, seed: 1, no: 1, settings: {} as never, rounds: [] };
    expect(raid(s, target()).ok).toBe(false);
  });
  it('moves gold only between the two purses, and never more than 10% of what is above the strongroom', () => {
    let won = 0;
    for (let k = 1; k <= 120; k++) {
      const s = veteran(45, 500);
      s.seed = k * 7919;
      const t = target(40, 805);
      t.empire.levels.strongroom = 1;
      const before = s.clan.gold + t.gold;
      const out = raid(s, t);
      if (!out.ok || out.result.type !== 'raidClass') throw new Error('raid failed');
      const eff = out.effects!.raid!;
      expect(out.state!.clan.gold + eff.gold).toBe(before);
      expect(out.result.gold).toBeLessThanOrEqual(Math.ceil((805 - safeGold(t.empire)) / 10));
      expect(out.result.gold).toBe(805 - eff.gold);
      expect(eff.empire.shieldUntil).toBe(TODAY + CONFIG.empire.raids.shieldDays);
      expect(eff.empire.createdDay).toBe(t.empire.createdDay);
      if (out.result.result.outcome === 'won') {
        won++;
        expect(out.result.gold).toBe(Math.ceil((805 - 200) / 10));
      } else expect(out.result.gold).toBe(0);
    }
    expect(won).toBeGreaterThan(5);
  });
  it('knocks levels off buildings only on the raided clan, never the walls or the strongroom', () => {
    let down = 0;
    for (let k = 1; k <= 120; k++) {
      const s = veteran(45);
      s.seed = k * 15485863;
      const t = target(40);
      Object.assign(t.empire.levels, { barracks: 4, tower: 3, smithy: 3, forge: 3, trainingHall: 3, walls: 0, strongroom: 2 });
      const mine = levelTotal(empireOf(s.clan));
      const out = raid(s, t, {}, { take: 'buildings' });
      if (!out.ok || out.result.type !== 'raidClass') throw new Error('raid failed');
      expect(levelTotal(empireOf(out.state!.clan))).toBe(mine);
      expect(levelTotal(out.effects!.raid!.empire)).toBe(18 - out.result.destroyed.length);
      expect(out.effects!.raid!.empire.levels.strongroom).toBe(2);
      expect(out.effects!.raid!.empire.levels.walls).toBe(0);
      expect(out.effects!.raid!.gold).toBe(t.gold);
      down += out.result.destroyed.length;
    }
    expect(down).toBeGreaterThan(0);
  });
  it('converts an old-shape defender first (vault into purse, group village levels) and hands the new save back', () => {
    const s = veteran(45);
    const t = target(40, 500);
    const old = { vault: 300, wild: 3, claimed: 0, plots: [{ width: 3, length: 5, building: 'barracks' as const }], troops: { footman: 40, axeman: 0, knight: 0 }, draftPercent: 5, day: 3, createdDay: 1, energyUsed: 0, raidsToday: 0, kingdomRaidsToday: 0, shieldUntil: 0, raidedToday: [] };
    const out = raid(s, { ...t, empire: old as never, village: { trainingHall: 2, smithy: 1, church: 0 } });
    if (!out.ok) throw new Error(out.say);
    const eff = out.effects!.raid!;
    expect(eff.empire.version).toBe(2);
    expect(eff.empire.levels).toMatchObject({ barracks: 1, trainingHall: 2, smithy: 1 });
    expect(eff.gold + (out.result.type === 'raidClass' ? out.result.gold : 0)).toBe(800);
    expect(eff.empire.createdDay).toBe(1);
  });
  it('does not change the saved state it was given, and the seed counter moves on', () => {
    const s = veteran(40);
    const copy = structuredClone(s);
    const t = target();
    const tCopy = structuredClone(t);
    const out = raid(s, t);
    expect(s).toEqual(copy);
    expect(t).toEqual(tCopy);
    expect(out.ok && out.state!.raidNo).toBe(s.raidNo + 1);
    expect(out.ok && empireOf(out.state!.clan).raidsToday).toBe(1);
    expect(out.ok && empireOf(out.state!.clan).raidedToday).toEqual(['blue-fox-1']);
  });
  it('gives the same result for the same seed, so a raid cannot be re-rolled', () => {
    const a = raid(veteran(40), target());
    const b = raid(veteran(40), target());
    expect(a.ok && a.result).toEqual(b.ok && b.result);
  });
  it('leaves the troops that did not come home gone on both sides', () => {
    const s = veteran(45);
    const t = target(40);
    const out = raid(s, t);
    expect(out.ok && might(empireOf(out.state!.clan).troops)).toBeLessThanOrEqual(45);
    expect(out.ok && might(out.effects!.raid!.empire.troops)).toBeLessThanOrEqual(40);
  });
});

describe('the news can never name a pupil', () => {
  it('uses the raiders clan name and nothing else, for every kind of raid', () => {
    for (const take of ['gold', 'buildings'] as const) {
      for (let k = 1; k <= 40; k++) {
        const s = veteran(45);
        s.seed = k * 31337;
        const names = s.clan.members.map((m) => m.name);
        const t = target(40);
        t.empire.levels.barracks = 3;
        const out = raid(s, t, {}, { take });
        if (!out.ok) throw new Error('raid failed');
        const { news, note } = out.effects!.raid!;
        for (const line of [news, note]) {
          expect(line).toMatch(/^A raider from the Red Banner clan /);
          for (const n of names) expect(line).not.toContain(n);
          expect(line).not.toContain('red-1');
          expect(line).not.toContain('blue-fox-1');
          expect(line.length).toBeLessThanOrEqual(200);
        }
        expect(raidNote('Red Banner', { result: out.result.type === 'raidClass' ? out.result.result : (null as never), take, gold: 1, destroyed: [] })).toMatch(/Red Banner/);
      }
    }
  });
});

describe('the database keeps the same numbers', () => {
  const sql = readFileSync(resolve('supabase/migrations/20261018002000_clans_village.sql'), 'utf8');
  it('costs and top levels in SQL are the same as in the game\'s settings', () => {
    const costs = /when 'trainingHall' then (\d+) when 'smithy' then (\d+) when 'church' then (\d+) end/.exec(sql);
    expect(costs?.slice(1).map(Number)).toEqual([CONFIG.village.trainingHall.base, CONFIG.village.smithy.base, CONFIG.village.church.base]);
    const max = /as \$\$ select case kind when 'trainingHall' then (\d+) when 'smithy' then (\d+) when 'church' then (\d+) end/.exec(sql);
    expect(max?.slice(1).map(Number)).toEqual([CONFIG.village.trainingHall.max, CONFIG.village.smithy.max, CONFIG.village.church.max]);
    expect(CONFIG.village.order).toEqual(['trainingHall', 'smithy', 'church']);
    // The tie-break order the SQL uses.
    expect(sql).toContain("case t.kind when 'trainingHall' then 1 when 'smithy' then 2 else 3 end");
  });
  it('the week and the top levels checked in the villages table match too', () => {
    expect(sql).toContain('floor((coalesce(nz_day, public.clan_nz_day()) + 3) / 7.0)');
    expect(sql).toContain("(levels ->> 'trainingHall')::integer between 0 and 5");
    expect(sql).toContain("(levels ->> 'smithy')::integer between 0 and 6");
    expect(sql).toContain("(levels ->> 'church')::integer between 0 and 3");
  });
  it('the vote closes the same way as closeWeek: a tie goes to the cheaper building', () => {
    expect(winner(levels(), { trainingHall: 2, smithy: 2, church: 2 })?.kind).toBe('smithy');
    expect(winner(levels(0, 3, 0), { trainingHall: 2, smithy: 2, church: 2 })?.kind).toBe('trainingHall');
  });
});
