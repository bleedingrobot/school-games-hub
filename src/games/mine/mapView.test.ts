import { describe, expect, it } from 'vitest';
import { flyLevel } from '../../../shared/mine/bot';
import { makeWorld } from '../../../shared/mine/engine';
import { floorOf, mapPicture } from './mapView';
import { PRACTICE_RECIPE } from './levels';
import { MineSession } from './session';
import { RECIPES } from '../../../shared/mine/level';

describe('the map', () => {
  it('shows only the room you start in, and the rooms next to it as question marks', () => {
    const session = new MineSession(RECIPES[2], { steady: true });
    const pic = mapPicture(session.world, session.state, session.visited, null);
    expect(pic.rooms).toHaveLength(1);
    expect(pic.rooms[0].here).toBe(true);
    expect(pic.rooms[0].start).toBe(true);
    expect(pic.unseen.length).toBeGreaterThan(0);
    expect(pic.links.every((l) => !l.walked)).toBe(true);
  });

  it('grows as rooms are visited, and marks the reactor and doors', () => {
    const session = new MineSession(PRACTICE_RECIPE, { steady: true });
    const bot = flyLevel(makeWorld(session.world.level, { steady: true }));
    for (const [code, n] of bot.runs) for (let i = 0; i < n; i++) session.step(code);
    const pic = mapPicture(session.world, session.state, session.visited, null);
    expect(pic.rooms.length).toBe(session.visited.size);
    expect(pic.rooms.some((r) => r.reactor)).toBe(true);
    expect(pic.rooms.some((r) => r.doors.includes('blue'))).toBe(true);
    expect(pic.links.some((l) => l.walked)).toBe(true);
    for (const r of pic.rooms) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x).toBeLessThanOrEqual(pic.width);
      expect(r.y).toBeLessThanOrEqual(pic.height);
    }
  });

  it('can show one floor at a time, and knows which floor the ship is on', () => {
    const session = new MineSession(RECIPES[1], { steady: true });
    const bot = flyLevel(makeWorld(session.world.level, { steady: true }));
    for (const [code, n] of bot.runs) for (let i = 0; i < n; i++) session.step(code);
    const all = mapPicture(session.world, session.state, session.visited, null);
    const f0 = mapPicture(session.world, session.state, session.visited, 0);
    const f1 = mapPicture(session.world, session.state, session.visited, 1);
    expect(f0.rooms.length + f1.rooms.length).toBe(all.rooms.length);
    expect(f0.rooms.every((r) => r.floor === 0)).toBe(true);
    expect(floorOf(session.world, session.state)).toBeGreaterThanOrEqual(0);
    expect(all.floors).toBe(2);
  });
});
