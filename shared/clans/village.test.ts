import { describe, expect, it } from 'vitest';
import { applyAction, parseAction, type Action, type Context, type ServerState } from './actions';
import { CONFIG } from './config';
import { startingDrafts } from './create';
import { empireOf, newEmpire } from './empire';
import { buildingTotal, emptyLand, might } from './empire';
import { closeWeek, goalOf, raidNote, raidTargetList, voteOptions, weekOf, winner, VILLAGE_KINDS, villageCost, villageMax, type RaidTarget, type Sketch, type VillageView } from './village';
import type { Empire, Village } from './types';

const SEED = 123456;
const TODAY = 20_000;
const ctx = (over: Partial<Context> = {}): Context => ({ seed: SEED, today: TODAY, ...over });

function created(): ServerState {
  const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, ctx());
  if (!out.ok || !out.state) throw new Error('create failed');
  return out.state;
}
/** A clan that began a fortnight ago with an army of the given size. */
function veteran(footmen: number, vault = 1000): ServerState {
  const s = created();
  s.createdNzDay = TODAY - 14;
  s.day = 15;
  const e = empireOf(s.clan);
  e.troops = { footman: footmen, axeman: 0, knight: 0 };
  e.vault = vault;
  return s;
}
const target = (footmen = 40, vault = 800): RaidTarget => {
  const e: Empire = { ...newEmpire(), troops: { footman: footmen, axeman: 0, knight: 0 }, vault };
  return { id: 'blue-fox-1', name: 'Blue Fox', createdNzDay: TODAY - 14, empire: e };
};
const levels = (t = 0, s = 0, c = 0): Village => ({ trainingHall: t, smithy: s, church: c });
const village = (over: Partial<VillageView> = {}): VillageView => ({ name: 'Room 12', chest: 0, levels: levels(), week: weekOf(TODAY), votes: {}, myVote: null, clans: 5, ...over });
const raid = (s: ServerState, t: RaidTarget | null, over: Partial<Context> = {}, a: Partial<Extract<Action, { type: 'raidClass' }>> = {}) =>
  applyAction(s, { type: 'raidClass', target: t?.id ?? 'nobody', take: 'gold', plan: { rounds: 3, push: 'steady', loot: 10 }, ...a }, ctx({ self: 'red-1', raidsOn: true, target: t, ...over }));

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
    s.clan.village.church = 2;
    s.clan.members.forEach((m) => { m.knockedOut = true; m.hp = 0; });
    const out = applyAction(s, { type: 'wakeAll' }, ctx());
    expect(out.ok && out.state?.clan.gold).toBe(s.clan.gold - s.clan.members.slice(3).reduce((t, m) => t + (m.level + 1) * CONFIG.churchPerLevel, 0));
  });
});

describe('giving to the chest', () => {
  it('takes exactly that much from the purse and refuses more than there is', () => {
    const s = created();
    const out = applyAction(s, { type: 'chestGive', gold: 50 }, ctx({ village: village() }));
    expect(out.ok && out.state?.clan.gold).toBe(s.clan.gold - 50);
    expect(out.ok && out.result).toEqual({ type: 'chestGive', gold: 50 });
    const no = applyAction(s, { type: 'chestGive', gold: s.clan.gold + 1 }, ctx({ village: village() }));
    expect(no.ok).toBe(false);
    expect(s.clan.gold).toBe(CONFIG.startGold);
  });
  it('is refused once the village has built everything, and while a fight is open', () => {
    expect(applyAction(created(), { type: 'chestGive', gold: 5 }, ctx({ village: village({ levels: levels(5, 6, 3) }) })).ok).toBe(false);
    const s = created();
    s.fight = { depth: 0, boss: false, seed: 1, no: 1, settings: {} as never, rounds: [] };
    expect(applyAction(s, { type: 'chestGive', gold: 5 }, ctx({ village: village() })).ok).toBe(false);
  });
  it('does not touch the empire vault', () => {
    const s = veteran(10, 321);
    const out = applyAction(s, { type: 'chestGive', gold: 10 }, ctx({ village: village() }));
    expect(out.ok && empireOf(out.state!.clan).vault).toBe(321);
  });
});

describe('voting', () => {
  it('asks the server to keep the vote and changes nothing else', () => {
    const s = created();
    const out = applyAction(s, { type: 'vote', kind: 'smithy' }, ctx({ village: village() }));
    expect(out.ok && out.effects).toEqual({ vote: 'smithy' });
    expect(out.ok && out.changed).toBe(false);
    expect(out.ok && out.state?.clan).toEqual(s.clan);
  });
  it('refuses a finished building and a missing village; junk is not an action', () => {
    expect(applyAction(created(), { type: 'vote', kind: 'church' }, ctx({ village: village({ levels: levels(0, 0, 3) }) })).ok).toBe(false);
    expect(applyAction(created(), { type: 'vote', kind: 'church' }, ctx()).ok).toBe(false);
    expect(parseAction({ type: 'vote', kind: 'castle' })).toBeNull();
    expect(parseAction({ type: 'vote', kind: 'church' })).toEqual({ type: 'vote', kind: 'church' });
    expect(parseAction({ type: 'chestGive', gold: -3 })).toBeNull();
    expect(parseAction({ type: 'chestGive', gold: 2.5 })).toBeNull();
    expect(parseAction({ type: 'chestGive', gold: 1e9 })).toBeNull();
    expect(parseAction({ type: 'raidClass', target: 'x', take: 'oust', plan: { rounds: 3, push: 'steady', loot: 10 } })).toBeNull();
    expect(parseAction({ type: 'raidClass', target: '', take: 'gold', plan: { rounds: 3, push: 'steady', loot: 10 } })).toBeNull();
    expect(parseAction({ type: 'raidClass', target: 'x', take: 'land', plan: { rounds: 3, push: 'steady', loot: 10 } })).not.toBeNull();
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
    expect(applyAction(veteran(40), { type: 'raidClass', target: 'blue-fox-1', take: 'gold', plan: { rounds: 3, push: 'steady', loot: 10 } }, ctx({ self: 'red-1', target: target() })).ok).toBe(false);
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
  it('moves vault gold only between the two empires, never the purse, and never more than 10%', () => {
    let won = 0;
    for (let k = 1; k <= 120; k++) {
      const s = veteran(45, 500);
      s.seed = k * 7919;
      const t = target(40, 800);
      const before = { purse: s.clan.gold, vaults: empireOf(s.clan).vault + t.empire.vault };
      const out = raid(s, t);
      if (!out.ok || out.result.type !== 'raidClass') throw new Error('raid failed');
      const eff = out.effects!.raid!;
      expect(out.state!.clan.gold).toBe(before.purse);
      expect(empireOf(out.state!.clan).vault + eff.empire.vault).toBe(before.vaults);
      expect(out.result.gold).toBeLessThanOrEqual(80);
      expect(out.result.gold).toBe(800 - eff.empire.vault);
      expect(eff.empire.shieldUntil).toBe(TODAY + CONFIG.empire.raids.shieldDays);
      expect(eff.empire.createdDay).toBe(t.empire.createdDay);
      if (out.result.result.outcome === 'won') won++;
    }
    expect(won).toBeGreaterThan(5);
  });
  it('moves land only between the two empires', () => {
    let took = 0;
    for (let k = 1; k <= 120; k++) {
      const s = veteran(45);
      s.seed = k * 104729;
      const t = target(40);
      t.empire.wild = 10;
      const landBefore = emptyLand(empireOf(s.clan)) + emptyLand(t.empire);
      const out = raid(s, t, {}, { take: 'land' });
      if (!out.ok || out.result.type !== 'raidClass') throw new Error('raid failed');
      expect(emptyLand(empireOf(out.state!.clan)) + emptyLand(out.effects!.raid!.empire)).toBe(landBefore);
      took += out.result.land;
    }
    expect(took).toBeGreaterThan(0);
  });
  it('knocks down buildings only on the raided empire and never walls first', () => {
    let down = 0;
    for (let k = 1; k <= 120; k++) {
      const s = veteran(45);
      s.seed = k * 15485863;
      const t = target(40);
      t.empire.plots = [
        { width: 3, length: 3, building: 'barracks' }, { width: 3, length: 3, building: 'tower' }, { width: 3, length: 3, building: 'stables' },
        { width: 3, length: 3, building: 'walls' },
      ];
      const mine = buildingTotal(empireOf(s.clan));
      const out = raid(s, t, {}, { take: 'buildings' });
      if (!out.ok || out.result.type !== 'raidClass') throw new Error('raid failed');
      expect(buildingTotal(empireOf(out.state!.clan))).toBe(mine);
      expect(buildingTotal(out.effects!.raid!.empire)).toBe(4 - out.result.destroyed.length);
      expect(out.effects!.raid!.empire.plots.some((p) => p.building === 'walls')).toBe(true);
      down += out.result.destroyed.length;
    }
    expect(down).toBeGreaterThanOrEqual(0);
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
    for (const take of ['gold', 'land', 'buildings'] as const) {
      for (let k = 1; k <= 40; k++) {
        const s = veteran(45);
        s.seed = k * 31337;
        const names = s.clan.members.map((m) => m.name);
        const t = target(40);
        t.empire.plots = [{ width: 3, length: 3, building: 'barracks' }];
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
        expect(raidNote('Red Banner', { result: out.result.type === 'raidClass' ? out.result.result : (null as never), take, gold: 1, land: 1, destroyed: [] })).toMatch(/Red Banner/);
      }
    }
  });
});
