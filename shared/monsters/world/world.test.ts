import { describe, expect, it } from 'vitest';
import { AREA_LEVELS } from '../bands';
import { makeMonster, maxHpOf } from '../rules';
import { FAMILIES, speciesOf } from '../monsterBook';
import { RAW_MAPS, WORLD_MAPS } from '../maps';
import { checkWorld } from './checkWorld';
import { ENCOUNTERS, findSighting, wildLevels, wildSpecies } from './encounters';
import { BADGES, MapError, parseMap, type TiledMap } from './mapLoader';
import { Dice } from './rng';
import { DELTA, DIRS, type Dir, type GameMap, type WorldState } from './types';
import { cameraFor, findPath, findPathBeside, isBlocked, planTap } from './walking';
import { afterBattle, facingTile, interact, newWorld, placeAt, RESTING_TALK, step, trainerBattle, wildBattle, type WorldOptions } from './world';

const opts: WorldOptions = { maps: WORLD_MAPS };
const team = () => [makeMonster('plusplash-1', 5), makeMonster('multipup-1', 5)];
const bush = WORLD_MAPS['kauri-bush'];
const town = WORLD_MAPS['harbour-town'];
const spot = (map: GameMap, name: string) => map.spots.find((s) => s.name === name)!;

function at(map: string, name: string, extra: Partial<WorldState> = {}): WorldState {
  const s = spot(WORLD_MAPS[map], name);
  return { ...newWorld(opts, team(), 7), map, x: s.x, y: s.y, facing: s.facing, ...extra };
}
/** Walk a route of directions (no turning first), stopping at the first thing that takes over. */
function walk(state: WorldState, route: Dir[], o: WorldOptions = opts) {
  let s = state;
  for (const d of route) {
    const r = step(s, d, o);
    s = r.state;
    if (r.trigger || r.action === 'warp') return { state: s, last: r };
  }
  return { state: s, last: undefined };
}

describe('the maps', () => {
  it('all load, and the whole world checks out (every door leads somewhere, everything can be reached)', () => {
    expect(Object.keys(WORLD_MAPS)).toHaveLength(20); // the town, the healing centre, six areas, six towers of two rooms
    expect(checkWorld(WORLD_MAPS, { map: 'harbour-town', spot: 'start' })).toEqual([]);
  });

  it('are the right sizes (area 1 is about 25 x 20)', () => {
    expect([bush.width, bush.height]).toEqual([25, 20]);
    for (const m of Object.values(WORLD_MAPS)) {
      expect(m.ground).toHaveLength(m.width * m.height);
      expect(m.walls).toHaveLength(m.width * m.height);
      expect(m.grass).toHaveLength(m.width * m.height);
    }
  });

  it('every sign and person has text', () => {
    for (const m of Object.values(WORLD_MAPS)) {
      for (const t of m.things) {
        expect(t.pages.length, `${t.id} has text`).toBeGreaterThan(0);
        for (const p of t.pages) expect(p.trim().length).toBeGreaterThan(0);
        if (t.kind === 'trainer') expect(t.winPages!.length).toBeGreaterThan(0);
      }
    }
    const kinds = new Set(Object.values(WORLD_MAPS).flatMap((m) => m.things.map((t) => t.kind)));
    for (const k of ['sign', 'person', 'nurse', 'box', 'book', 'chest', 'trainer']) expect(kinds.has(k as never), k).toBe(true);
    for (const m of Object.values(WORLD_MAPS)) for (const g of m.gates) expect(g.pages.length, `${g.id} has text`).toBeGreaterThan(0);
  });

  it('every door leads to a real tile, and you can walk from the town to the bush and back', () => {
    for (const m of Object.values(WORLD_MAPS)) {
      for (const w of m.warps) {
        const to = WORLD_MAPS[w.to];
        expect(to, w.id).toBeTruthy();
        expect(isBlocked(to, w.toX, w.toY, BADGES), `${w.id} lands on a free tile`).toBe(false);
      }
    }
    // Walk north up the road from the start, through the exit, then straight back down through the bush's exit.
    let r = walk(at('harbour-town', 'start'), Array(15).fill('up'));
    expect(r.state.map).toBe('kauri-bush');
    expect([r.state.x, r.state.y]).toEqual([11, 18]);
    r = walk(r.state, ['down']);
    expect(r.state.map).toBe('harbour-town');
  });

  it('town has the healing centre, the teacher, the box and the book; the bush has people, a trainer and a closed path to area 2', () => {
    expect(town.things.some((t) => t.kind === 'person' && t.name === 'Teacher' && t.pages.length >= 3)).toBe(true);
    expect(town.things.filter((t) => t.kind === 'sign').length).toBeGreaterThanOrEqual(3);
    expect(town.warps.some((w) => w.to === 'healing-centre')).toBe(true);
    expect(bush.things.filter((t) => t.kind === 'person').length).toBeGreaterThanOrEqual(2);
    expect(bush.things.filter((t) => t.kind === 'person').length).toBeLessThanOrEqual(3);
    expect(bush.things.filter((t) => t.kind === 'trainer')).toHaveLength(1);
    const gate = bush.gates[0];
    expect(gate.badge).toBe('leaf');
    expect(isBlocked(bush, gate.x, gate.y)).toBe(true);
    expect(isBlocked(bush, gate.x, gate.y, ['leaf'])).toBe(false);
  });

  it('use only monsters from the book, and at area-1 levels they are all first forms', () => {
    expect(bush.wild.length).toBeGreaterThanOrEqual(5);
    for (const entry of bush.wild) {
      expect(FAMILIES[entry] ?? speciesOf(entry)).toBeTruthy();
      for (let level = AREA_LEVELS[0][0]; level <= AREA_LEVELS[0][1]; level++) expect(speciesOf(wildSpecies(entry, level)).stage).toBe(1);
    }
    expect(bush.area).toBe(1);
    expect(town.wild).toEqual([]);
    expect(town.isGrass.some(Boolean)).toBe(false);
  });
});

describe('the loader tells you what is wrong', () => {
  const good = RAW_MAPS['kauri-bush'];
  const copy = (): TiledMap => structuredClone(good);
  const fails = (raw: TiledMap) => {
    try {
      parseMap('x', raw);
    } catch (e) {
      expect(e).toBeInstanceOf(MapError);
      return (e as MapError).problems.join(' | ');
    }
    return '';
  };

  it('wrong layer size', () => {
    const m = copy();
    m.layers[1].data!.pop();
    expect(fails(m)).toMatch(/layer "walls" has/);
  });
  it('a sign with no text', () => {
    const m = copy();
    const sign = m.layers[3].objects!.find((o) => o.type === 'sign')!;
    sign.properties = [];
    expect(fails(m)).toMatch(/has no text/);
  });
  it('a person standing in a wall, an unknown monster, an object outside the map, an unknown kind', () => {
    const m = copy();
    const p = m.layers[3].objects!.find((o) => o.type === 'person')!;
    m.layers[1].data![(p.y / 16) * m.width + p.x / 16] = 29;
    m.layers[3].objects!.push({ id: 99, name: 'far away', type: 'sign', x: 5000, y: 0, properties: [{ name: 'text', value: 'hi' }] });
    m.layers[3].objects!.push({ id: 98, name: 'odd', type: 'dragon', x: 16, y: 16 });
    m.properties!.find((q) => q.name === 'wild')!.value = 'nope-1';
    const why = fails(m);
    expect(why).toMatch(/standing on a wall/);
    expect(why).toMatch(/outside the map/);
    expect(why).toMatch(/not a kind of object/);
    expect(why).toMatch(/not in the monster book/);
  });
  it('a trainer with no team', () => {
    const m = copy();
    const t = m.layers[3].objects!.find((o) => o.type === 'trainer')!;
    t.properties = t.properties!.filter((q) => q.name !== 'team');
    expect(fails(m)).toMatch(/needs a team/);
  });
  it('a door to nowhere, or onto a wall', () => {
    const maps = { ...WORLD_MAPS, 'harbour-town': structuredClone(town) };
    maps['harbour-town'].warps[0] = { ...maps['harbour-town'].warps[0], to: 'atlantis' };
    expect(checkWorld(maps, { map: 'harbour-town', spot: 'start' }).join()).toMatch(/atlantis/);
    const walled = { ...WORLD_MAPS, 'kauri-bush': structuredClone(bush) };
    walled['kauri-bush'].blocked[18 * 25 + 11] = true;
    expect(checkWorld(walled, { map: 'harbour-town', spot: 'start' }).join()).toMatch(/blocked tile/);
  });
  it('something walled in, or the way blocked between the town and the bush', () => {
    const blocked = { ...WORLD_MAPS, 'harbour-town': structuredClone(town) };
    for (let x = 0; x < town.width; x++) blocked['harbour-town'].blocked[14 * town.width + x] = true; // a wall right across the town
    expect(checkWorld(blocked, { map: 'harbour-town', spot: 'start' }).length).toBeGreaterThan(0);
  });
});

describe('walking', () => {
  it('a press that is not the way you face only turns you; the next press steps', () => {
    const s = at('harbour-town', 'start'); // facing up
    const r1 = step(s, 'left', opts, { turnFirst: true });
    expect(r1.action).toBe('turn');
    expect([r1.state.x, r1.state.y, r1.state.facing]).toEqual([s.x, s.y, 'left']);
    const r2 = step(r1.state, 'left', opts, { turnFirst: true });
    expect(r2.action).toBe('move');
    expect(r2.state.x).toBe(s.x - 1);
    expect(r2.state.steps).toBe(1);
  });

  it('trees, water, houses, people and signs block; roads and grass do not', () => {
    const s = at('harbour-town', 'start', { x: 2, y: 13 }); // the book is at (2,14)
    expect(step(s, 'down', opts).action).toBe('bump');
    expect(step(s, 'down', opts).state.facing).toBe('down');
    expect(step(s, 'down', opts).state.y).toBe(13);
    expect(isBlocked(town, 17, 15)).toBe(true); // pond
    expect(isBlocked(town, 6, 6)).toBe(true); // the healing centre's roof
    expect(isBlocked(town, 13, 15)).toBe(true); // the teacher
    expect(isBlocked(town, 11, 8)).toBe(false); // the road
    expect(isBlocked(town, -1, 5)).toBe(true);
    expect(step(at('harbour-town', 'start', { x: 11, y: 14 }), 'up', opts).action).toBe('move');
  });

  it('the exits, and the way into the healing centre, can be walked onto', () => {
    expect(isBlocked(town, 6, 8)).toBe(false);
    const r = step(at('harbour-town', 'start', { x: 6, y: 9, facing: 'up' }), 'up', opts);
    expect(r.action).toBe('warp');
    expect(r.state.map).toBe('healing-centre');
    expect(r.state.facing).toBe('up');
  });

  it('finds the shortest way to a tapped tile', () => {
    const s = at('harbour-town', 'start'); // (11,15)
    const path = findPath(town, s, { x: 11, y: 10 })!;
    expect(path).toEqual(Array(5).fill('up'));
    // Around the pond, not through it.
    const around = findPath(town, { x: 16, y: 14 }, { x: 21, y: 16 });
    expect(around).toBeTruthy();
    let p = { x: 16, y: 14 };
    for (const d of around!) {
      p = { x: p.x + DELTA[d][0], y: p.y + DELTA[d][1] };
      expect(isBlocked(town, p.x, p.y)).toBe(false);
    }
    expect(p).toEqual({ x: 21, y: 16 });
    // Never through a door or exit on the way, so no accidental trip out of the map.
    const via = findPath(town, { x: 10, y: 5 }, { x: 13, y: 5 })!;
    expect(via.length).toBe(3);
    expect(findPath(town, s, { x: 17, y: 15 })).toBeNull(); // water
    expect(findPath(town, s, { x: 99, y: 99 })).toBeNull();
    expect(findPath(town, s, { x: s.x, y: s.y })).toEqual([]);
  });

  it('a tap on a person walks up beside them and faces them; a tap on a wall does nothing', () => {
    const s = at('harbour-town', 'start');
    const plan = planTap(town, s, 13, 15);
    expect(plan.kind).toBe('talk');
    if (plan.kind === 'talk') {
      expect(plan.path).toEqual(['right']);
      expect(plan.face).toBe('right');
      expect('name' in plan.thing && plan.thing.name).toBe('Teacher');
    }
    expect(planTap(town, s, 17, 15).kind).toBe('none');
    expect(planTap(town, s, 11, 10).kind).toBe('walk');
    expect(planTap(town, s, s.x, s.y).kind).toBe('none');
    const beside = findPathBeside(town, { x: 13, y: 14 }, { x: 13, y: 15 })!;
    expect(beside.path).toEqual([]);
    expect(beside.face).toBe('down');
  });

  it('the camera follows you and stops at the map edges', () => {
    // A view of 10 x 8 tiles on a 25 x 20 map.
    expect(cameraFor(12, 10, 10, 8, 25, 20)).toEqual({ x: 7.5, y: 6.5 });
    expect(cameraFor(0, 0, 10, 8, 25, 20)).toEqual({ x: 0, y: 0 });
    expect(cameraFor(24, 19, 10, 8, 25, 20)).toEqual({ x: 15, y: 12 });
    // Between tiles it slides.
    expect(cameraFor(12.5, 10, 10, 8, 25, 20).x).toBeCloseTo(8, 5);
    // A small map sits in the middle.
    expect(cameraFor(3, 3, 12, 9, 10, 7)).toEqual({ x: -1, y: -1 });
  });
});

describe('wild battles in the long grass', () => {
  const onGrass = (): WorldState => {
    const i = bush.isGrass.findIndex((g, k) => g && !bush.blocked[k]);
    return at('kauri-bush', 'entrance', { x: i % bush.width, y: Math.floor(i / bush.width) });
  };

  it('start after 12 to 20 steps in the grass, every time, over many seeded walks', () => {
    // A big open patch of grass: walk back and forth in it.
    const gaps: number[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      let s: WorldState = { ...at('kauri-bush', 'entrance', { x: 3, y: 5 }), seed: new Dice(seed).seed };
      s = { ...s, grassSteps: new Dice(seed).int(12, 20) };
      let since = 0;
      for (let i = 0; i < 200; i++) {
        const r = step(s, i % 16 < 8 ? 'right' : 'left', opts);
        s = r.state;
        if (r.action !== 'move') continue;
        since += 1;
        if (r.trigger?.kind === 'wild') {
          gaps.push(since);
          since = 0;
        }
      }
    }
    expect(gaps.length).toBeGreaterThan(300);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(ENCOUNTERS.steps.min);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(ENCOUNTERS.steps.max);
    expect(new Set(gaps).size).toBeGreaterThan(5); // not always the same number
  });

  it('the same seed gives the same walk', () => {
    const run = (seed: number) => {
      let s: WorldState = { ...at('kauri-bush', 'entrance', { x: 3, y: 5 }), seed };
      const out: string[] = [];
      for (let i = 0; i < 120; i++) {
        const r = step(s, i % 16 < 8 ? 'right' : 'left', opts);
        s = r.state;
        if (r.trigger?.kind === 'wild') out.push(`${r.trigger.foe.species}@${r.trigger.foe.level}`);
      }
      return out;
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });

  it('never start on the road or off the grass', () => {
    let s = at('kauri-bush', 'entrance', { x: 11, y: 18, grassSteps: 1 });
    for (let i = 0; i < 30; i++) {
      const r = step(s, i % 2 ? 'up' : 'down', opts);
      s = r.state;
      expect(r.trigger).toBeUndefined();
    }
    expect(s.grassSteps).toBe(1); // the road doesn't count
    expect(onGrass().grassSteps).toBeGreaterThan(0);
  });

  it('the wild monster is one of the area, at a level in the near or far range', () => {
    expect(wildLevels(1, false)).toEqual([2, 4]);
    expect(wildLevels(1, true)).toEqual([4, 6]);
    expect(wildLevels(1, false)[0]).toBe(AREA_LEVELS[0][0]);
    expect(wildLevels(1, true)[1]).toBe(AREA_LEVELS[0][1]);
    const seen = new Set<string>();
    for (const [x, y, far] of [[3, 12, false], [3, 4, true]] as const) {
      expect(bush.far[y * bush.width + x]).toBe(far);
      for (let seed = 1; seed <= 80; seed++) {
        const s = { ...at('kauri-bush', 'entrance', { x: x - 1, y, grassSteps: 1, seed }) };
        const r = step(s, 'right', opts);
        expect(r.trigger?.kind).toBe('wild');
        if (r.trigger?.kind !== 'wild') continue;
        const foe = r.trigger.foe;
        seen.add(foe.species);
        expect(bush.wild.map((e) => wildSpecies(e, foe.level))).toContain(foe.species);
        const [lo, hi] = wildLevels(1, far);
        expect(r.trigger.foe.level).toBeGreaterThanOrEqual(lo);
        expect(r.trigger.foe.level).toBeLessThanOrEqual(hi);
        expect(r.trigger.far).toBe(far);
        expect(r.trigger.area).toBe(1);
        expect(r.trigger.foe.hp).toBe(maxHpOf(r.trigger.foe));
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it('"More battles" makes it every 2 to 3 steps, and Repel (later) switches it off', () => {
    const fast: WorldOptions = { maps: WORLD_MAPS, fast: true };
    let s: WorldState = { ...at('kauri-bush', 'entrance', { x: 3, y: 5 }), grassSteps: 19 };
    let since = 0;
    const gaps: number[] = [];
    for (let i = 0; i < 100; i++) {
      const r = step(s, i % 16 < 8 ? 'right' : 'left', fast);
      s = r.state;
      since += 1;
      if (r.trigger?.kind === 'wild') { gaps.push(since); since = 0; }
    }
    expect(gaps[0]).toBeLessThanOrEqual(3);
    for (const g of gaps) { expect(g).toBeGreaterThanOrEqual(2); expect(g).toBeLessThanOrEqual(3); }
    let r: WorldState = { ...at('kauri-bush', 'entrance', { x: 3, y: 5 }), grassSteps: 1, repel: 5 };
    for (let i = 0; i < 5; i++) { const o = step(r, i % 2 ? 'left' : 'right', opts); r = o.state; expect(o.trigger).toBeUndefined(); }
    expect(r.repel).toBe(0);
  });
});

describe('trainers', () => {
  const kiri = bush.things.find((t) => t.kind === 'trainer')!;

  it('see you in line, a few tiles ahead, and not from the side or round a corner', () => {
    expect(kiri.facing).toBe('right');
    const sees = (x: number, y: number, beaten: string[] = []) => findSighting(bush, { x, y, beaten });
    expect(sees(kiri.x + 2, kiri.y)?.trainer.id).toBe(kiri.id);
    expect(sees(kiri.x + 2, kiri.y)?.path).toEqual([[kiri.x + 1, kiri.y]]);
    expect(sees(kiri.x + 1, kiri.y)?.path).toEqual([]);
    expect(sees(kiri.x + 5, kiri.y)).toBeNull(); // too far
    expect(sees(kiri.x - 2, kiri.y)).toBeNull(); // behind them
    expect(sees(kiri.x + 2, kiri.y + 1)).toBeNull(); // not in line
    expect(sees(kiri.x + 2, kiri.y, [kiri.id])).toBeNull(); // already beaten
  });

  it('challenge you when you walk past, and fight once per visit', () => {
    const s = at('kauri-bush', 'trainer-approach'); // (18,10) facing up
    const r = step(s, 'up', opts);
    expect(r.action).toBe('move');
    expect(r.trigger?.kind).toBe('trainer');
    if (r.trigger?.kind !== 'trainer') return;
    expect(r.trigger.sighting.trainer.id).toBe(kiri.id);
    expect(r.trigger.sighting.path).toEqual([[17, 9]]);
    const setup = trainerBattle(r.state, opts, kiri);
    expect(setup.kind).toBe('trainer');
    expect(setup.far).toBe(true);
    expect(setup.area).toBe(1);
    expect(setup.foes.map((f) => [f.species, f.level])).toEqual([['digibud-1', 4], ['plusplash-1', 4]]);

    // Win: they don't challenge again while you are still here.
    const won = afterBattle(r.state, { outcome: 'won', team: r.state.team, box: [], bag: r.state.bag }, kiri);
    expect(won.beaten).toEqual([kiri.id]);
    expect(step({ ...won, y: 10 }, 'up', opts).trigger).toBeUndefined();
    // Chatting afterwards gives the "you won" line, not another battle.
    const chat = interact({ ...won, x: 17, y: 9, facing: 'left' }, opts);
    expect(chat.talk!.pages).toEqual(kiri.winPages);
    expect(chat.challenge).toBeUndefined();
    // Leave the bush and come back: a new visit, they challenge you again.
    const out = walk({ ...won, x: 11, y: 18, facing: 'down' }, ['down']);
    expect(out.state.map).toBe('harbour-town');
    expect(out.state.beaten).toEqual([]);
    expect(step(at('kauri-bush', 'trainer-approach', { beaten: out.state.beaten }), 'up', opts).trigger?.kind).toBe('trainer');
  });

  it('talking to one who has not met you yet starts the same challenge', () => {
    const r = interact({ ...at('kauri-bush', 'entrance'), x: 15, y: 9, facing: 'right' }, opts);
    expect(r.challenge?.id).toBe(kiri.id);
    expect(r.talk!.speaker).toBe('Ranger Kiri');
  });

  it('a trainer cannot see through a tree', () => {
    const m = structuredClone(bush);
    m.blocked[kiri.y * m.width + kiri.x + 1] = true;
    expect(findSighting(m, { x: kiri.x + 2, y: kiri.y, beaten: [] })).toBeNull();
  });

  it('losing to a trainer sends you to the healing centre, and you can try again', () => {
    const s = at('kauri-bush', 'trainer-approach');
    const hurt = { ...s, team: s.team.map((m) => ({ ...m, hp: 0 })) };
    const lost = afterBattle(hurt, { outcome: 'lost', team: hurt.team, box: [], bag: hurt.bag }, kiri);
    expect(lost.map).toBe('healing-centre');
    expect(lost.beaten).toEqual([]);
    expect(lost.team.every((m) => m.hp === maxHpOf(m))).toBe(true);
  });
});

describe('talking, healing and coming back from battle', () => {
  it('signs and people give their text; box and book say how it is', () => {
    const sign = interact({ ...at('harbour-town', 'start'), x: 9, y: 15, facing: 'up' }, opts);
    expect(sign.talk!.pages[0]).toMatch(/Welcome to Harbour Town/);
    expect(sign.talk!.speaker).toBeUndefined();
    const teacher = interact({ ...at('harbour-town', 'start'), x: 12, y: 15, facing: 'right' }, opts);
    expect(teacher.talk!.speaker).toBe('Teacher');
    expect(teacher.talk!.pages.length).toBeGreaterThanOrEqual(4);
    const box = interact({ ...at('harbour-town', 'start'), x: 3, y: 13, facing: 'down', box: [makeMonster('divvy-1', 3)] }, opts);
    expect(box.talk!.pages.join(' ')).toMatch(/holds 1 monsters/);
    expect(interact({ ...at('harbour-town', 'start'), x: 11, y: 8, facing: 'up' }, opts).talk).toBeUndefined();
    expect(facingTile({ x: 5, y: 5, facing: 'left' })).toEqual([4, 5]);
  });

  it('the nurse heals your team and this becomes the place you wake up', () => {
    const wake = spot(WORLD_MAPS['healing-centre'], 'wake');
    const tired = team().map((m) => ({ ...m, hp: 1 }));
    const s = at('healing-centre', 'wake', { team: tired });
    expect(s.heal.map).toBe('healing-centre'); // before ever seeing the nurse
    const r = interact(s, opts);
    expect(r.talk!.speaker).toBe('Nurse Joy');
    expect(r.state.team.every((m) => m.hp === maxHpOf(m))).toBe(true);
    expect(s.team.every((m) => m.hp === 1)).toBe(true); // the old state is untouched
    expect(r.state.heal).toMatchObject({ map: 'healing-centre', x: wake.x, y: wake.y });
  });

  it('after losing a wild battle you wake up at the last healing spot with everything kept', () => {
    const s = at('kauri-bush', 'entrance', { bag: { potion: 2, ball: 3 }, box: [makeMonster('divvy-1', 3)] });
    const lost = afterBattle(s, { outcome: 'lost', team: s.team.map((m) => ({ ...m, hp: 0 })), box: s.box, bag: s.bag });
    expect([lost.map, lost.x, lost.y, lost.facing]).toEqual(['healing-centre', 4, 3, 'up']);
    expect(lost.team).toHaveLength(2);
    expect(lost.team.every((m) => m.hp === maxHpOf(m))).toBe(true);
    expect(lost.bag).toEqual({ potion: 2, ball: 3 });
    expect(lost.box).toHaveLength(1);
    // Heal at a new place and you wake there instead.
    const healed = interact({ ...at('healing-centre', 'wake'), x: 4, y: 3, facing: 'up' }, opts).state;
    expect(afterBattle({ ...healed, map: 'kauri-bush' }, { outcome: 'lost', team: healed.team, box: [], bag: {} }).map).toBe('healing-centre');
  });

  it('a win, a catch or a run keeps the team, box and bag the battle ended with', () => {
    const s = at('kauri-bush', 'entrance');
    const caught = makeMonster('divvy-1', 3);
    for (const outcome of ['won', 'caught', 'ran'] as const) {
      const r = afterBattle(s, { outcome, team: [...s.team, caught], box: [], bag: { potion: 4, ball: 9 } });
      expect(r.map).toBe('kauri-bush');
      expect(r.team).toHaveLength(3);
      expect(r.bag).toEqual({ potion: 4, ball: 9 });
    }
    const full = afterBattle(s, { outcome: 'caught', team: s.team, box: [caught], bag: s.bag });
    expect(full.box).toEqual([caught]);
  });

  it('a wild battle is set up from the world state', () => {
    const r = step({ ...at('kauri-bush', 'entrance', { x: 3, y: 12, grassSteps: 1 }) }, 'right', opts);
    expect(r.trigger?.kind).toBe('wild');
    if (r.trigger?.kind !== 'wild') return;
    const setup = wildBattle(r.state, r.trigger);
    expect(setup).toMatchObject({ kind: 'wild', area: 1, far: false });
    expect(setup.team).toEqual(r.state.team);
    expect(setup.foes).toHaveLength(1);
  });
});

describe('the game state is plain data', () => {
  it('survives a JSON round trip unchanged, and moving never changes the old one', () => {
    const s = newWorld(opts, team(), 99);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    expect([s.map, s.x, s.y]).toEqual(['harbour-town', 11, 15]);
    expect(s.bag).toEqual({ potion: 5, ball: 10 });
    expect(s.team).toHaveLength(2);
    const before = JSON.stringify(s);
    const r = step(s, 'up', opts);
    expect(JSON.stringify(s)).toBe(before);
    expect(r.state).not.toBe(s);
    const moved = placeAt(r.state, 'kauri-bush', 3, 4, 'left');
    expect(JSON.parse(JSON.stringify(moved))).toEqual(moved);
    expect(Object.keys(s).sort()).toEqual(['badges', 'bag', 'beaten', 'box', 'chests', 'facing', 'grassSteps', 'heal', 'map', 'owned', 'paid', 'repel', 'seed', 'seen', 'steps', 'team', 'version', 'x', 'y']);
  });

  it('DIRS covers all four ways', () => {
    expect(DIRS).toHaveLength(4);
  });
});

describe('resting once the day’s battles are used up', () => {
  const resting: WorldOptions = { ...opts, resting: true };
  const kiri = bush.things.find((t) => t.kind === 'trainer')!;
  const back: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

  it('no wild battles in the long grass, however far you walk', () => {
    let s: WorldState = { ...at('kauri-bush', 'entrance', { x: 3, y: 5 }), grassSteps: 1 };
    for (let i = 0; i < 300; i++) {
      const r = step(s, i % 16 < 8 ? 'right' : 'left', resting);
      expect(r.trigger).toBeUndefined();
      s = r.state;
    }
    // The grass picks up where it left off once the limit is gone (tomorrow).
    expect(walk(s, Array<Dir>(40).fill('right').map((d, i) => (i % 16 < 8 ? d : 'left'))).last?.trigger?.kind).toBe('wild');
  });

  it('trainers don’t challenge you, and talking to one is only a chat', () => {
    expect(step(at('kauri-bush', 'trainer-approach'), 'up', resting).trigger).toBeUndefined();
    const chat = interact({ ...at('kauri-bush', 'entrance'), x: 15, y: 9, facing: 'right' }, resting);
    expect(chat.challenge).toBeUndefined();
    expect(chat.talk!.pages).toEqual([RESTING_TALK]);
    expect(kiri.badge).toBeUndefined();
  });

  it('Tower trainers still battle, so a badge is never held back', () => {
    const top = WORLD_MAPS['tower-1-top'];
    const boss = top.things.find((t) => t.kind === 'trainer' && t.badge)!;
    const [dx, dy] = DELTA[boss.facing];
    const s: WorldState = { ...newWorld(opts, team(), 7), map: top.id, x: boss.x + dx, y: boss.y + dy, facing: back[boss.facing] };
    expect(interact(s, resting).challenge?.id).toBe(boss.id);
  });
});
