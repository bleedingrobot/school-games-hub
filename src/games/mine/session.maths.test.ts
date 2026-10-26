import { describe, expect, it } from 'vitest';
import { PAD_ANSWERS, REACTOR_LOCK_ANSWERS } from '../../../shared/mine/config';
import { RECIPES } from '../../../shared/mine/level';
import { MineSession, type UseTarget } from './session';

const recipe = RECIPES[2];

function moveTo(session: MineSession, x: number, y: number, z: number): void {
  const s = session.state;
  s.px = x; s.py = y; s.pz = z; s.vx = 0; s.vy = 0; s.vz = 0;
}

describe('the session and the reactor lock', () => {
  it('offers the reactor as a target when the ship is close, and counts the unlock down', () => {
    const session = new MineSession(recipe, { steady: true });
    const R = session.world.level.reactor;
    moveTo(session, R.x + 3, R.y, R.z);
    let target = session.target() as Extract<UseTarget, { kind: 'reactor' }>;
    expect(target.kind).toBe('reactor');
    expect(target.left).toBe(REACTOR_LOCK_ANSWERS);
    session.answered(target, true);
    expect(session.events.some((e) => e.kind === 'reactor-step' && e.left === REACTOR_LOCK_ANSWERS - 1)).toBe(true);
    target = session.target() as Extract<UseTarget, { kind: 'reactor' }>;
    expect(target.left).toBe(REACTOR_LOCK_ANSWERS - 1);
    session.answered(target, true);
    session.answered(session.target()!, true);
    expect(session.state.reactorLock).toBe(0);
    expect(session.events.some((e) => e.kind === 'reactor-step' && e.left === 0)).toBe(true);
    expect(session.target()).toBeNull(); // nothing left to answer there
  });

  it('charges a wrong answer at the reactor like a question door', () => {
    const session = new MineSession(recipe, { steady: true });
    const R = session.world.level.reactor;
    moveTo(session, R.x + 3, R.y, R.z);
    const before = session.state.shield;
    session.answered(session.target()!, false);
    expect(session.state.reactorLock).toBe(REACTOR_LOCK_ANSWERS);
    expect(session.state.wrongAnswers).toBe(1);
    expect(session.state.shield).toBeLessThan(before);
  });

  it('has no lock in a run without maths', () => {
    const session = new MineSession(recipe, { steady: true, maths: false });
    const R = session.world.level.reactor;
    moveTo(session, R.x + 3, R.y, R.z);
    expect(session.target()).toBeNull();
  });
});

describe('the session and two-answer pads', () => {
  it('says one more to go after the first right answer, and fills the pad on the second', () => {
    const session = new MineSession(recipe, { steady: true });
    const pad = session.world.level.pads[0];
    session.state.shield = 10;
    moveTo(session, pad.x, pad.y, pad.z);
    const first = session.target() as Extract<UseTarget, { kind: 'pad' }>;
    expect(first.left).toBe(PAD_ANSWERS);
    session.answered(first, true);
    expect(session.events.some((e) => e.kind === 'pad-step' && e.left === 1)).toBe(true);
    expect(session.state.shield).toBe(10);
    const second = session.target() as Extract<UseTarget, { kind: 'pad' }>;
    expect(second.left).toBe(1);
    session.answered(second, true);
    expect(session.events.some((e) => e.kind === 'pad')).toBe(true);
    expect(session.state.shield).toBeGreaterThan(10);
    expect(session.target()?.kind).not.toBe('pad');
  });

  it('wrong answers cost nothing but use up a try', () => {
    const session = new MineSession(recipe, { steady: true });
    const pad = session.world.level.pads[0];
    moveTo(session, pad.x, pad.y, pad.z);
    const target = session.target()!;
    const shield = session.state.shield;
    session.answered(target, false);
    expect(session.state.shield).toBe(shield);
    expect(session.state.wrongAnswers).toBe(0);
    expect(session.padTriesLeft(pad.id)).toBe(4);
  });
});
