import { describe, expect, it } from 'vitest';
import { flyLevel } from '../../../shared/mine/bot';
import { makeWorld, newRun } from '../../../shared/mine/engine';
import { makeLevel, RECIPES } from '../../../shared/mine/level';
import { nextGoal, routeRooms } from './guide';
import { MineSession } from './session';

describe('the next-goal arrow', () => {
  it('sends you for the first key before the first locked door', () => {
    const w = makeWorld(makeLevel(RECIPES[0]));
    const s = newRun(w);
    const g = nextGoal(w, s);
    expect(g.label).toBe('blue key');
  });

  it('heads for the next room on the way, not straight through the rock', () => {
    const w = makeWorld(makeLevel(RECIPES[2]));
    const s = newRun(w);
    const g = nextGoal(w, s);
    const key = w.level.keys.find((k) => k.colour === 'blue')!;
    const path = routeRooms(w.level, s, s.lastRoom, [key.room])!;
    if (path.length) {
      expect(g.final).toBe(false);
      const room = w.level.rooms[path[0]];
      expect([g.x, g.y, g.z]).toEqual([room.cx + 0.5, room.cy + 0.5, room.cz + 0.5]);
    } else {
      expect(g.final).toBe(true);
    }
  });

  it('goes door, reactor, exit as the run goes on, and always gives a goal until the end', () => {
    for (const recipe of RECIPES) {
      const session = new MineSession(recipe, { steady: true });
      const bot = flyLevel(makeWorld(session.world.level, { steady: true }));
      const labels: string[] = [];
      let every = 0;
      for (const [code, n] of bot.runs) {
        for (let i = 0; i < n; i++) {
          session.step(code);
          if (every++ % 25 === 0 && session.running) {
            const g = nextGoal(session.world, session.state);
            expect(Number.isFinite(g.x + g.y + g.z)).toBe(true);
            if (labels[labels.length - 1] !== g.label) labels.push(g.label);
          }
        }
      }
      expect(labels).toContain('reactor');
      expect(labels[labels.length - 1]).toBe('exit');
      expect(labels.indexOf('reactor')).toBeLessThan(labels.indexOf('exit'));
    }
  });

  it('never routes through a shut door you cannot open yet', () => {
    const w = makeWorld(makeLevel(RECIPES[4]));
    const s = newRun(w);
    const door = w.level.doors[0];
    const beyond = w.level.reactorRoom;
    const path = routeRooms(w.level, s, w.level.start, [beyond]);
    // With no key and a door in the way the reactor cannot be reached yet.
    expect(door.kind).toBe('blue');
    expect(path).toBeNull();
  });

  it('says nothing is left to do in the room you are in', () => {
    const w = makeWorld(makeLevel(RECIPES[0]));
    const s = newRun(w);
    expect(routeRooms(w.level, s, 0, [0])).toEqual([]);
  });
});
