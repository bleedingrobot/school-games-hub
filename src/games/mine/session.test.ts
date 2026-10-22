import { describe, expect, it } from 'vitest';
import { flyLevel } from '../../../shared/mine/bot';
import { USE_RANGE, WRONG_ANSWER_DAMAGE } from '../../../shared/mine/config';
import { makeWorld, replay, stateKey } from '../../../shared/mine/engine';
import { GRANT, IDLE, PENALTY, packInput, NO_INPUT } from '../../../shared/mine/inputs';
import { RECIPES } from '../../../shared/mine/level';
import { PRACTICE_RECIPE } from './levels';
import { MAX_PAD_TRIES, MineSession, type MineEvent, type UseTarget } from './session';

/** Plays a recorded run into a session, one step at a time, the way the screen does. */
function play(session: MineSession, runs: ReadonlyArray<readonly [number, number]>, until = Infinity): void {
  let count = 0;
  for (const [code, n] of runs) for (let i = 0; i < n && count < until; i++, count++) session.step(code);
}

describe('a run in a session', () => {
  it('plays and records exactly what the rules would replay (so a saved run is honest)', () => {
    const recipe = RECIPES[1];
    const bot = flyLevel(makeWorld(new MineSession(recipe, { steady: true }).world.level, { steady: true }));
    const session = new MineSession(recipe, { steady: true });
    play(session, bot.runs);
    expect(session.state.outcome).toBe('finished');
    expect(session.runs).toEqual(bot.runs);
    expect(stateKey(session.state)).toBe(stateKey(replay(session.world, session.runs)));
    expect(session.clock).toBe(session.state.finishSteps);
  });

  it('tells the screen what happened, once', () => {
    const session = new MineSession(PRACTICE_RECIPE, { steady: true });
    const bot = flyLevel(makeWorld(session.world.level, { steady: true }));
    const seen: MineEvent[] = [];
    for (const [code, n] of bot.runs) for (let i = 0; i < n; i++) {
      session.step(code);
      seen.push(...session.events);
      session.events = [];
    }
    const kinds = seen.map((e) => e.kind);
    expect(kinds).toContain('key');
    expect(kinds).toContain('door');
    expect(kinds).toContain('reactor-down');
    expect(kinds.filter((k) => k === 'reactor-down')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'finished')).toHaveLength(1);
    expect(kinds).toContain('laser');
    expect(kinds.filter((k) => k === 'key')).toHaveLength(1);
    expect(seen.filter((e) => e.kind === 'door')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'robot-down').length).toBe(session.state.robotsKilled);
  });

  it('keeps the step before, so the picture can smooth between steps', () => {
    const session = new MineSession(PRACTICE_RECIPE, { steady: true });
    const x0 = session.state.px;
    session.step(packInput({ ...NO_INPUT, tz: 1 }));
    expect(session.prev.px).toBe(x0);
    expect(session.state.px === x0 && session.state.py === session.prev.py).toBe(false);
  });

  it('remembers the rooms and tunnels you have been through, for the map', () => {
    const session = new MineSession(PRACTICE_RECIPE, { steady: true });
    expect(session.visited.size).toBe(1);
    const bot = flyLevel(makeWorld(session.world.level, { steady: true }));
    play(session, bot.runs);
    expect(session.visited.has(session.world.level.reactorRoom)).toBe(true);
    expect(session.visited.size).toBeGreaterThan(2);
    for (const e of session.visitedEdges) {
      const [a, b] = e.split('-').map(Number);
      expect(session.visited.has(a) && session.visited.has(b)).toBe(true);
    }
  });

  it('stops taking steps once the run is over', () => {
    const session = new MineSession(PRACTICE_RECIPE, { steady: true });
    const bot = flyLevel(makeWorld(session.world.level, { steady: true }));
    play(session, bot.runs);
    const n = session.runs.length;
    session.step(IDLE);
    expect(session.runs).toHaveLength(n);
    expect(session.running).toBe(false);
  });
});

describe('question doors and pads', () => {
  /** Flies the bot until the ship is first able to use something. */
  function untilUsable(recipe = RECIPES[1]) {
    const session = new MineSession(recipe, { steady: true });
    const bot = flyLevel(makeWorld(session.world.level, { steady: true }));
    for (const [code, n] of bot.runs) {
      for (let i = 0; i < n; i++) {
        // The bot answers right as soon as it can: stop just before that.
        if (code >= GRANT && session.target()) return { session, target: session.target()! };
        session.step(code);
      }
    }
    throw new Error('never usable');
  }

  it('finds the door or pad you are close to, and nothing when you are far from any', () => {
    const session = new MineSession(RECIPES[1], { steady: true });
    expect(session.target()).toBeNull();
    const { target, session: near } = untilUsable();
    expect(target.distance).toBeLessThanOrEqual(USE_RANGE);
    expect(['door', 'pad']).toContain(target.kind);
    expect(near.target()?.id).toBe(target.id);
  });

  it('opens a question door on a right answer by recording a GRANT', () => {
    const { session, target } = untilUsable();
    if (target.kind !== 'door') return;
    const before = session.runs.length;
    session.answered(target, true);
    expect(session.state.doorsOpen[target.id]).toBe(1);
    expect(session.state.doorsByAnswer).toBe(1);
    expect(session.runs.length).toBe(before + 1);
    expect(session.runs[session.runs.length - 1][0]).toBe(GRANT + target.id);
    expect(session.state.badGrants).toBe(0);
  });

  it('costs shield and time for a wrong answer at a door, and records it as a PENALTY', () => {
    const { session } = (() => {
      // Find a level moment with a question door in reach.
      for (const recipe of RECIPES.slice(1)) {
        const found = untilUsable(recipe);
        if (found.target.kind === 'door') return found;
      }
      throw new Error('no door found');
    })();
    const target = session.target()!;
    const shield = session.state.shield;
    const clock = session.clock;
    session.answered(target, false);
    expect(session.state.wrongAnswers).toBe(1);
    expect(session.state.shield).toBe(Math.max(1, shield - WRONG_ANSWER_DAMAGE));
    expect(session.clock).toBeGreaterThan(clock);
    expect(session.state.doorsOpen[target.id]).toBe(0);
    expect(session.runs[session.runs.length - 1][0]).toBe(PENALTY);
    expect(session.events.some((e) => e.kind === 'wrong')).toBe(true);
  });

  it('never charges for a wrong answer at a pad, and gives up on a pad after three tries', () => {
    let found: { session: MineSession; target: UseTarget } | null = null;
    // Fly the bot through levels until a pad is in reach.
    for (const recipe of RECIPES) {
      const session = new MineSession(recipe, { steady: true });
      const bot = flyLevel(makeWorld(session.world.level, { steady: true }));
      for (const [code, n] of bot.runs) {
        for (let i = 0; i < n && !found; i++) {
          session.step(code);
          const t = session.target();
          if (t && t.kind === 'pad') found = { session, target: t };
        }
        if (found) break;
      }
      if (found) break;
    }
    expect(found).not.toBeNull();
    const { session, target } = found!;
    const shield = session.state.shield;
    const clock = session.clock;
    const steps = session.runs.length;
    for (let t = 1; t <= MAX_PAD_TRIES; t++) {
      expect(session.target()?.id).toBe(target.id);
      expect(session.padTriesLeft(target.id)).toBe(MAX_PAD_TRIES - t + 1);
      session.answered(target, false);
    }
    expect(session.state.shield).toBe(shield);
    expect(session.clock).toBe(clock);
    expect(session.runs).toHaveLength(steps);
    expect(session.padTriesLeft(target.id)).toBe(0);
    expect(session.target()?.id).not.toBe(target.id);
  });
});
