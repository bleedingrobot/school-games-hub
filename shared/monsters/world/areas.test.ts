import { describe, expect, it } from 'vitest';
import { AREA_LEVELS } from '../bands';
import type { ItemId } from '../engine';
import { FAMILIES, MONSTER_BOOK, speciesOf } from '../monsterBook';
import { makeMonster, maxHpOf } from '../rules';
import { TYPE_LABEL } from '../types';
import { WORLD_MAPS } from '../maps';
import { AREAS, BADGE_ORDER } from './areas';
import { checkWorld } from './checkWorld';
import { wildLevels, wildSpecies } from './encounters';
import { BADGES } from './mapLoader';
import { bookCounts, bookStatus, canHeal, moveToBox, moveToFront, moveToTeam, swapTeam, applyItem } from './menu';
import { addToBag, describeLoot, LOOT, REPEL_STEPS } from './rewards';
import type { GameMap, Thing, WorldState } from './types';
import { findPath, isBlocked } from './walking';
import { facingTile, finishBattle, interact, meet, newWorld, refreshBook, step, trainerBattle, type WorldOptions } from './world';

const opts: WorldOptions = { maps: WORLD_MAPS };
const team = () => [makeMonster('plusplash-1', 5), makeMonster('multipup-1', 5)];
const spot = (map: GameMap, name: string) => map.spots.find((s) => s.name === name)!;
function at(map: string, name: string, extra: Partial<WorldState> = {}): WorldState {
  const s = spot(WORLD_MAPS[map], name);
  return { ...newWorld(opts, team(), 7), map, x: s.x, y: s.y, facing: s.facing, ...extra };
}
const towerTop = (area: number) => WORLD_MAPS[AREAS[area - 1].towerTop].things.find((t) => t.kind === 'trainer')!;

describe('the six areas, in order', () => {
  it('the maps are all there: an area, a Tower hall and a Tower top for each', () => {
    for (const a of AREAS) {
      for (const id of [a.map, a.towerHall, a.towerTop]) expect(WORLD_MAPS[id], id).toBeTruthy();
      expect(WORLD_MAPS[a.map].area).toBe(a.area);
      expect([WORLD_MAPS[a.map].width, WORLD_MAPS[a.map].height]).toEqual([25, 20]);
    }
    expect(AREAS.map((a) => a.name)).toEqual(['Kauri Bush', 'Shell Beach', 'Fire Mountain', 'Snowy Peaks', 'Glowworm Caves', 'Harbour City']);
    expect(BADGE_ORDER).toEqual([...BADGES]);
  });

  it('with every badge the whole world checks out', () => {
    expect(checkWorld(WORLD_MAPS, { map: 'harbour-town', spot: 'start' })).toEqual([]);
    expect(checkWorld(WORLD_MAPS, { map: 'harbour-town', spot: 'start' }, BADGES)).toEqual([]);
  });

  it('the way on is closed without the badge and open with it: each badge opens exactly the next area', () => {
    const reachable = (badges: string[]) => {
      const problems = checkWorld(WORLD_MAPS, { map: 'harbour-town', spot: 'start' }, badges);
      const lost = new Set(problems.map((p) => /never get to "(.+)"/.exec(p)?.[1]).filter(Boolean));
      return Object.keys(WORLD_MAPS).filter((id) => !lost.has(id));
    };
    for (let k = 0; k <= 6; k++) {
      const got = reachable(BADGE_ORDER.slice(0, k));
      for (const a of AREAS) {
        const open = a.area <= k + 1;
        expect(got.includes(a.map), `${a.name} with ${k} badges`).toBe(open);
        expect(got.includes(a.towerHall), `${a.name} Tower with ${k} badges`).toBe(open);
        expect(got.includes(a.towerTop), `${a.name} Tower top with ${k} badges`).toBe(open);
      }
    }
  });

  it('a gate stops you without its badge, says which badge is missing, and lets you through with it', () => {
    for (const a of AREAS.slice(0, 5)) {
      const map = WORLD_MAPS[a.map];
      const gate = map.gates[0];
      expect(gate.badge).toBe(a.badge);
      const s = at(a.map, 'gate');
      expect([s.x, s.y + (s.facing === 'up' ? -1 : 0)]).toEqual([gate.x, gate.y]);
      expect(step(s, 'up', opts).action).toBe('bump');
      const talk = interact(s, opts).talk!;
      expect(talk.pages.join(' ')).toMatch(new RegExp(`${a.badge[0].toUpperCase()}${a.badge.slice(1)} badge`));
      const through = { ...s, badges: [a.badge] };
      const r1 = step(through, 'up', opts);
      expect(r1.action).toBe('move');
      const r2 = step(r1.state, 'up', opts);
      expect(r2.action).toBe('warp');
      expect(r2.state.map).toBe(AREAS[a.area].map);
      // And the way back works without a badge check getting in the way.
      expect(step({ ...r2.state, facing: 'down' }, 'down', opts).state.map).toBe(a.map);
    }
    expect(WORLD_MAPS['harbour-city'].gates).toHaveLength(0); // the last area has nothing after it
  });

  it('every area has 3 or 4 people, 1 or 2 trainers, signs, 2 chests, a healing spot and a Tower door', () => {
    for (const a of AREAS) {
      const m = WORLD_MAPS[a.map];
      const count = (k: string) => m.things.filter((t) => t.kind === k).length;
      expect(count('person'), `${a.name} people`).toBeGreaterThanOrEqual(3);
      expect(count('person'), `${a.name} people`).toBeLessThanOrEqual(4);
      expect(count('trainer'), `${a.name} trainers`).toBeGreaterThanOrEqual(1);
      expect(count('trainer'), `${a.name} trainers`).toBeLessThanOrEqual(2);
      expect(count('sign'), `${a.name} signs`).toBeGreaterThanOrEqual(3);
      expect(count('chest'), `${a.name} chests`).toBe(2);
      expect(count('nurse'), `${a.name} nurse`).toBe(1);
      expect(m.warps.some((w) => w.to === a.towerHall)).toBe(true);
      expect(m.isGrass.some(Boolean)).toBe(true);
      expect(m.far.some(Boolean) && m.far.some((f, i) => m.isGrass[i] && !f) && m.far.some((f, i) => m.isGrass[i] && f), `${a.name} has long grass in both halves`).toBe(true);
    }
  });

  it('every area has a "chest" spot that is a free tile facing a chest, and the other test-page spots are free tiles too', () => {
    for (const a of AREAS) {
      const m = WORLD_MAPS[a.map];
      const s = spot(m, 'chest');
      const [fx, fy] = facingTile(s);
      expect(m.things.find((t) => t.x === fx && t.y === fy)?.kind, `${a.name} chest spot`).toBe('chest');
      for (const name of ['entrance', 'chest', 'grass-edge', 'nurse', 'tower-door', 'trainer-approach']) {
        const p = spot(m, name);
        expect(isBlocked(m, p.x, p.y, BADGES), `${a.name} ${name}`).toBe(false);
      }
      expect(m.things.find((t) => t.kind === 'nurse' && (t.x === facingTile(spot(m, 'nurse'))[0]) && t.y === facingTile(spot(m, 'nurse'))[1]), `${a.name} nurse spot faces the nurse`).toBeTruthy();
      const g = facingTile(spot(m, 'grass-edge'));
      expect(m.isGrass[g[1] * m.width + g[0]], `${a.name} grass-edge faces long grass`).toBe(true);
    }
  });

  it('every sign, person, nurse, chest and trainer has text, a chest names real loot, a Tower trainer names a badge', () => {
    for (const m of Object.values(WORLD_MAPS)) {
      for (const t of m.things) {
        expect(t.pages.length, `${t.id} has text`).toBeGreaterThan(0);
        if (t.kind === 'chest') {
          expect(LOOT[t.loot!], `${t.id} loot`).toBeTruthy();
          expect(t.gid).toBeTruthy();
          expect(t.openGid).toBeTruthy();
        }
        if (t.kind === 'trainer') {
          expect(t.winPages!.length).toBeGreaterThan(0);
          expect(t.team!.length).toBeGreaterThanOrEqual(1);
          expect(t.team!.length).toBeLessThanOrEqual(3);
        }
      }
      for (const g of m.gates) expect(g.pages.length).toBeGreaterThan(0);
    }
    for (const a of AREAS) {
      const tower = towerTop(a.area);
      expect(tower.badge).toBe(a.badge);
      expect(tower.team).toHaveLength(3);
      expect(tower.loot).toBe('tower');
    }
  });

  it('each area leans on its own type (the three families of that type turn up most) and still shows other types', () => {
    for (const a of AREAS) {
      const wild = WORLD_MAPS[a.map].wild;
      const lean = wild.filter((e) => FAMILIES[e].type === a.type);
      expect(new Set(lean).size, `${a.name} lean families`).toBe(3);
      const counts = wild.reduce<Record<string, number>>((n, e) => ({ ...n, [e]: (n[e] ?? 0) + 1 }), {});
      for (const e of new Set(lean)) expect(counts[e]).toBeGreaterThan(1);
      expect(new Set(wild.map((e) => FAMILIES[e].type)).size, `${a.name} types`).toBeGreaterThanOrEqual(5);
      expect(lean.length / wild.length).toBeGreaterThanOrEqual(0.4);
    }
  });
});

describe('all 18 families, all 54 monsters', () => {
  /** Every species that can turn up in the wild or on a trainer's team, and where. */
  function meetings() {
    const where = new Map<string, Set<string>>();
    const add = (id: string, place: string) => where.set(id, (where.get(id) ?? new Set()).add(place));
    for (const m of Object.values(WORLD_MAPS)) {
      if (m.wild.length) {
        const [lo, hi] = AREA_LEVELS[m.area - 1];
        for (const e of m.wild) for (let level = lo; level <= hi; level++) add(wildSpecies(e, level), `wild:${m.id}`);
      }
      for (const t of m.things) for (const mon of t.team ?? []) add(mon.species, `trainer:${t.id}`);
    }
    return where;
  }

  it('every family can be met somewhere as a first form, and every one of the 54 can be met or is reached by growing', () => {
    const met = meetings();
    for (const family of Object.keys(FAMILIES)) expect(met.has(`${family}-1`), `${family} first form`).toBe(true);
    const reachable = new Set(met.keys());
    for (let again = true; again; ) {
      again = false;
      for (const id of [...reachable]) {
        const next = speciesOf(id).evolvesTo;
        if (next && !reachable.has(next)) {
          reachable.add(next);
          again = true;
        }
      }
    }
    expect([...MONSTER_BOOK].filter((s) => !reachable.has(s.id)).map((s) => s.id)).toEqual([]);
    expect(reachable.size).toBe(54);
  });

  it('forms match the levels: a wild family never shows a form its level has not reached', () => {
    for (const m of Object.values(WORLD_MAPS)) {
      if (!m.wild.length) continue;
      for (const far of [false, true]) {
        const [lo, hi] = wildLevels(m.area, far);
        for (let level = lo; level <= hi; level++) {
          for (const e of m.wild) {
            const sp = speciesOf(wildSpecies(e, level));
            const f = FAMILIES[e];
            expect(sp.stage, `${e} at ${level}`).toBe(level >= f.evolveAt[1] ? 3 : level >= f.evolveAt[0] ? 2 : 1);
          }
        }
      }
    }
  });

  it('nothing sits outside its area\'s level range: wild levels, trainers (up to the top + 2 for a Tower)', () => {
    for (const m of Object.values(WORLD_MAPS)) {
      if (m.area === 0) continue;
      const [lo, hi] = AREA_LEVELS[m.area - 1];
      for (const far of [false, true]) {
        const [a, b] = wildLevels(m.area, far);
        expect(a).toBeGreaterThanOrEqual(lo);
        expect(b).toBeLessThanOrEqual(hi);
      }
      for (const t of m.things.filter((x) => x.kind === 'trainer')) {
        for (const mon of t.team!) {
          expect(mon.level, `${t.id} ${mon.species}`).toBeGreaterThanOrEqual(lo);
          expect(mon.level, `${t.id} ${mon.species}`).toBeLessThanOrEqual(t.badge ? hi + 2 : hi);
          const sp = speciesOf(mon.species);
          const f = FAMILIES[sp.family];
          expect(sp.stage, `${t.id} ${mon.species}`).toBe(mon.level >= f.evolveAt[1] ? 3 : mon.level >= f.evolveAt[0] ? 2 : 1);
        }
        if (t.badge) expect(Math.max(...t.team!.map((x) => x.level))).toBe(hi + 2);
      }
    }
  });

  it('prints where each family lives (area names, first form to last)', () => {
    const met = meetings();
    const rows = Object.entries(FAMILIES).map(([family, f]) => {
      const places = (stage: number) => [...(met.get(`${family}-${stage}`) ?? [])].filter((p) => p.startsWith('wild:')).map((p) => AREAS.find((a) => a.map === p.slice(5))!.area).sort().join(',') || '-';
      return `${TYPE_LABEL[f.type]} ${f.names[0]}: ${[1, 2, 3].map((s) => `${f.names[s - 1]} areas ${places(s)}`).join(' | ')}`;
    });
    expect(rows).toHaveLength(18);
  });
});

describe('Tower trainers and prizes', () => {
  it('a Tower trainer fights at the area\'s far-half bands with 3 monsters, and gives the badge the first time only', () => {
    for (const a of AREAS) {
      const t = towerTop(a.area);
      const s = at(a.towerTop, 'trainer-approach', { team: [makeMonster('plusplash-1', 5)] });
      const setup = trainerBattle(s, opts, t);
      expect(setup.foes).toHaveLength(3);
      expect(setup.far).toBe(true);
      expect(setup.area).toBe(a.area);
      const first = finishBattle(s, { outcome: 'won', team: s.team, box: [], bag: s.bag }, t);
      expect(first.prize.badge).toBe(a.badge);
      expect(first.state.badges).toEqual([a.badge]);
      expect(first.prize.loot).toEqual(LOOT.tower);
      expect(first.state.bag['super-potion']).toBe(1);
      expect(first.state.bag['great-ball']).toBe(2);
      // Win again (a fresh visit): no second badge, no second prize.
      const again = finishBattle({ ...first.state, beaten: [] }, { outcome: 'won', team: first.state.team, box: [], bag: first.state.bag }, t);
      expect(again.prize).toEqual({});
      expect(again.state.badges).toEqual([a.badge]);
      expect(again.state.bag).toEqual(first.state.bag);
      // Holding the badge, the trainer no longer challenges: just a chat.
      const chat = interact({ ...first.state, beaten: [], x: 5, y: 4, facing: 'up', map: a.towerTop }, opts);
      expect(chat.challenge).toBeUndefined();
      expect(chat.talk!.pages).toEqual(t.winPages);
    }
  });

  it('losing or running gives no badge', () => {
    const t = towerTop(1);
    const s = at('tower-1-top', 'trainer-approach');
    for (const outcome of ['lost', 'ran'] as const) {
      const r = finishBattle(s, { outcome, team: s.team, box: [], bag: s.bag }, t);
      expect(r.state.badges).toEqual([]);
      expect(r.prize).toEqual({});
    }
  });

  it('an ordinary trainer pays once, even when beaten again on a later visit', () => {
    const kiri = WORLD_MAPS['kauri-bush'].things.find((t) => t.id === 'kauri-bush:Ranger Kiri')!;
    const s = at('kauri-bush', 'trainer-approach');
    const one = finishBattle(s, { outcome: 'won', team: s.team, box: [], bag: { potion: 1, ball: 1 } }, kiri);
    expect(one.state.bag).toEqual({ potion: 2, ball: 3 });
    const two = finishBattle({ ...one.state, beaten: [] }, { outcome: 'won', team: s.team, box: [], bag: one.state.bag }, kiri);
    expect(two.state.bag).toEqual({ potion: 2, ball: 3 });
    expect(two.state.paid).toEqual([kiri.id]);
  });
});

describe('chests', () => {
  const chest = (): Thing => WORLD_MAPS['kauri-bush'].things.find((t) => t.id === 'kauri-bush:Chest in the bush')!;
  it('open once: the items come into the bag, and the second time it is empty', () => {
    const c = chest();
    const s = at('kauri-bush', 'entrance', { x: c.x, y: c.y - 1, facing: 'down', bag: { potion: 1 } });
    const first = interact(s, opts);
    expect(first.cue).toBe('chest');
    expect(first.talk!.pages.at(-1)).toBe(`You found ${describeLoot(LOOT[c.loot!])}!`);
    expect(first.state.bag).toEqual(addToBag({ potion: 1 }, LOOT[c.loot!]));
    expect(first.state.chests).toEqual([c.id]);
    const second = interact(first.state, opts);
    expect(second.cue).toBeUndefined();
    expect(second.talk!.pages).toEqual(['The chest is empty now.']);
    expect(second.state.bag).toEqual(first.state.bag);
    expect(second.state.chests).toEqual([c.id]);
    expect(s.bag).toEqual({ potion: 1 }); // the old state is untouched
  });

  it('every chest is on a free tile you can stand next to, and the loot is small', () => {
    for (const m of Object.values(WORLD_MAPS)) {
      for (const t of m.things.filter((x) => x.kind === 'chest')) {
        const total = Object.values(LOOT[t.loot!]).reduce((a, b) => a + (b ?? 0), 0);
        expect(total).toBeLessThanOrEqual(5);
        expect(m.walls[t.y * m.width + t.x]).toBe(0);
      }
    }
    for (const [name, bundle] of Object.entries(LOOT)) for (const n of Object.values(bundle)) expect(n, name).toBeLessThanOrEqual(4);
  });

  it('there is an item list in the words people read: "2 potions and 3 balls"', () => {
    expect(describeLoot({ potion: 2, ball: 3 })).toBe('2 potions and 3 balls');
    expect(describeLoot({ 'super-potion': 1 })).toBe('1 super potion');
    expect(describeLoot({ repel: 2 })).toBe('2 Repels');
    expect(describeLoot({ potion: 1, ball: 2, repel: 1 })).toBe('1 potion, 2 balls and 1 Repel');
  });
});

describe('Repel', () => {
  it('uses one from the bag and stops wild battles for 50 steps in long grass', () => {
    const s = at('kauri-bush', 'entrance', { x: 3, y: 5, grassSteps: 1, bag: { repel: 2 } });
    const used = applyItem(s, 'repel');
    expect(used.ok).toBe(true);
    if (!used.ok) return;
    expect(used.state.repel).toBe(REPEL_STEPS);
    expect(used.state.bag.repel).toBe(1);
    expect(applyItem(used.state, 'repel').ok).toBe(false); // still working
    let cur = used.state;
    for (let i = 0; i < REPEL_STEPS; i++) {
      const r = step(cur, i % 16 < 8 ? 'right' : 'left', opts);
      cur = r.state;
      expect(r.trigger, `step ${i + 1}`).toBeUndefined();
    }
    expect(cur.repel).toBe(0);
    // The 51st step in the grass: the battle that was waiting starts.
    expect(step(cur, 'right', opts).trigger?.kind).toBe('wild');
    // Walking on the road doesn't use it up.
    const road = { ...used.state, ...spot(WORLD_MAPS['kauri-bush'], 'entrance') };
    expect(step(road, 'up', opts).state.repel).toBe(REPEL_STEPS);
  });

  it('is refused when you have none', () => {
    const s = at('kauri-bush', 'entrance', { bag: {} });
    expect(applyItem(s, 'repel')).toMatchObject({ ok: false });
  });
});

describe('the map menu: team, box, bag', () => {
  const six = () => ['digibud', 'plusplash', 'factorch', 'divvy', 'fractopus', 'pebblepoint'].map((f) => makeMonster(`${f}-1`, 6));

  it('swaps the order of the team', () => {
    const s = at('kauri-bush', 'entrance', { team: six() });
    const r = swapTeam(s, 0, 3);
    expect(r.ok && r.state.team.map((m) => m.species)).toEqual(['divvy-1', 'plusplash-1', 'factorch-1', 'digibud-1', 'fractopus-1', 'pebblepoint-1']);
    expect(swapTeam(s, 1, 1).ok).toBe(false);
    expect(swapTeam(s, 0, 9).ok).toBe(false);
    expect(s.team[0].species).toBe('digibud-1');
  });

  it('moves one monster to the front, the rest keeping their order', () => {
    const s = at('kauri-bush', 'entrance', { team: six() });
    const r = moveToFront(s, 3);
    expect(r.ok && r.state.team.map((m) => m.species)).toEqual(['divvy-1', 'digibud-1', 'plusplash-1', 'factorch-1', 'fractopus-1', 'pebblepoint-1']);
    expect(moveToFront(s, 0).ok).toBe(false);
    expect(moveToFront(s, 9).ok).toBe(false);
    expect(s.team[0].species).toBe('digibud-1');
  });

  it('keeps the team at 1 to 6 when moving monsters between the team and the box', () => {
    let s = at('kauri-bush', 'entrance', { team: six(), box: [makeMonster('coinrock-1', 4)] });
    expect(moveToTeam(s, 0).ok).toBe(false); // already six
    for (let i = 0; i < 5; i++) {
      const r = moveToBox(s, 0);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.state;
      expect(s.team.length + s.box.length).toBe(7);
    }
    expect(s.team).toHaveLength(1);
    expect(s.box).toHaveLength(6);
    expect(moveToBox(s, 0)).toMatchObject({ ok: false }); // never empty
    const back = moveToTeam(s, 0);
    expect(back.ok && back.state.team).toHaveLength(2);
    expect(back.ok && back.state.box).toHaveLength(5);
    expect(moveToTeam(s, 99).ok).toBe(false);
    expect(moveToBox(s, 99).ok).toBe(false);
  });

  it('uses a potion on a hurt monster, but not on a healthy or a tired one, and never a ball', () => {
    const hurt = { ...makeMonster('divvy-1', 20) }; // a lot of health to heal
    hurt.hp = 10;
    const tired = { ...makeMonster('divvy-1', 6), hp: 0 };
    const fine = makeMonster('digibud-1', 6);
    const s = at('kauri-bush', 'entrance', { team: [hurt, tired, fine], bag: { potion: 1, 'super-potion': 1, ball: 3 } });
    expect(canHeal(s, 0)).toBeNull();
    expect(canHeal(s, 1)).toMatch(/Tired/);
    expect(canHeal(s, 2)).toMatch(/full/);
    const r = applyItem(s, 'potion', 0);
    expect(r.ok && r.state.team[0].hp).toBe(50); // +40
    expect(r.ok && r.state.bag.potion).toBe(0);
    expect(applyItem(s, 'potion', 1).ok).toBe(false);
    expect(applyItem(s, 'potion', 2).ok).toBe(false);
    expect(applyItem(s, 'ball', 0).ok).toBe(false);
    const big = applyItem(s, 'super-potion', 0);
    expect(big.ok && big.state.team[0].hp).toBe(maxHpOf(hurt));
    const none = at('kauri-bush', 'entrance', { team: [hurt], bag: {} });
    expect(applyItem(none, 'potion', 0).ok).toBe(false);
  });
});

describe('the monster book', () => {
  it('starts with your team owned, shows what you meet as seen, and everything else unknown', () => {
    const s = newWorld(opts, [makeMonster('plusplash-1', 5), makeMonster('multipup-1', 5)], 3);
    expect(s.owned).toEqual(['multipup-1', 'plusplash-1']);
    expect(s.seen).toEqual(['multipup-1', 'plusplash-1']);
    expect(bookStatus(s, 'plusplash-1')).toBe('owned');
    expect(bookStatus(s, 'divvy-1')).toBe('unknown');
    const met = meet(s, [makeMonster('divvy-1', 3), makeMonster('divvy-1', 4), makeMonster('digibud-1', 3)]);
    expect(met.seen).toEqual(['digibud-1', 'divvy-1', 'multipup-1', 'plusplash-1']);
    expect(met.owned).toEqual(s.owned);
    expect(bookStatus(met, 'divvy-1')).toBe('seen');
    expect(bookCounts(met)).toEqual({ owned: 2, seen: 4, total: 54 });
    expect(meet(met, [makeMonster('divvy-1', 3)])).toBe(met); // nothing new: same state back
    expect(s.seen).toHaveLength(2);
  });

  it('catching one makes it owned, and a grown monster brings its earlier forms with it', () => {
    const s = newWorld(opts, team(), 3);
    const r = finishBattle(s, { outcome: 'caught', team: [...s.team, makeMonster('divvy-1', 4)], box: [makeMonster('sharebear-2', 20)], bag: s.bag });
    expect(bookStatus(r.state, 'divvy-1')).toBe('owned');
    expect(bookStatus(r.state, 'sharebear-2')).toBe('owned');
    expect(bookStatus(r.state, 'sharebear-1')).toBe('owned'); // it grew from this
    expect(bookStatus(r.state, 'sharebear-3')).toBe('unknown');
    const grown = refreshBook({ ...s, team: [makeMonster('fractopus-3', 40)] });
    expect(grown.owned).toEqual(expect.arrayContaining(['fractopus-1', 'fractopus-2', 'fractopus-3']));
    expect(grown.owned).toEqual([...grown.owned].sort());
  });
});

describe('the new state is plain data', () => {
  it('JSON round-trips with badges, book, chests and paid trainers filled in, and keeps sets as sorted arrays', () => {
    const s = at('kauri-bush', 'entrance');
    const full: WorldState = {
      ...s, badges: ['leaf', 'water'], seen: ['digibud-1', 'divvy-1'], owned: ['digibud-1'], chests: ['kauri-bush:Chest in the bush'], paid: ['kauri-bush:Ranger Kiri'], repel: 12,
      bag: { potion: 2, 'super-potion': 1, ball: 3, 'great-ball': 1, repel: 1 } as Partial<Record<ItemId, number>>,
    };
    expect(JSON.parse(JSON.stringify(full))).toEqual(full);
    const fresh = newWorld(opts, team(), 11);
    expect(fresh.badges).toEqual([]);
    expect(fresh.chests).toEqual([]);
    expect(fresh.paid).toEqual([]);
    expect(fresh.seen).toEqual([...fresh.seen].sort());
    expect(fresh.owned).toEqual([...fresh.owned].sort());
    // A step never changes the state it was given.
    const before = JSON.stringify(full);
    step(full, 'up', opts);
    expect(JSON.stringify(full)).toBe(before);
  });
});

describe('walking the whole route', () => {
  it('you can walk from the start to every Tower trainer, and to each next area, once you hold the badge', () => {
    let badges: string[] = [];
    for (const a of AREAS) {
      const m = WORLD_MAPS[a.map];
      const entrance = spot(m, 'entrance');
      const door = m.warps.find((w) => w.to === a.towerHall)!;
      const path = findPath(m, entrance, { x: door.x, y: door.y }, badges);
      expect(path, `${a.name}: entrance to the Tower door`).toBeTruthy();
      if (m.gates[0]) {
        const closed = findPath(m, entrance, { x: m.gates[0].x, y: m.gates[0].y }, badges);
        expect(closed, `${a.name}: gate is shut without the badge`).toBeNull();
        badges = [...badges, a.badge];
        expect(findPath(m, entrance, { x: m.gates[0].x, y: m.gates[0].y }, badges), `${a.name}: gate opens with the badge`).toBeTruthy();
        expect(isBlocked(m, m.gates[0].x, m.gates[0].y, badges)).toBe(false);
      }
    }
  });
});

describe('paths that look open are open', () => {
  it('Kauri Bush: you can walk the whole way along the path east of the town trail (a tall tree used to shut it)', () => {
    const map = WORLD_MAPS['kauri-bush'];
    for (const y of [11, 12]) {
      for (let x = 11; x <= 19; x++) {
        expect(isBlocked(map, x, y, []), `tile ${x},${y} on the path`).toBe(false);
      }
    }
  });
});
