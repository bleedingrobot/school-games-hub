// Toon Flap's rules (docs/TOON-FLAP-PLAN.md): the server's replay check, the time and medals, and the unlocks.
// Playing every level to the end is the sim's job (npm run toonflap:sim), not a test.
import { describe, expect, it } from 'vitest';
import { botRun } from './bot';
import { addRun, emptyProgress, flyersUnlocked, levelOpen, type RunSummary } from './collection';
import { BUMP_PENALTY_STEPS, POTIONS_MAX, STEPS_PER_SECOND } from './config';
import { decodeFlaps, encodeFlaps, medalFor, newRun, replayRun, scoreRun, stepRun } from './engine';
import { buildCourse, LEVELS } from './levels';
import { gapLabels, gapsRight, rightGaps } from './maths';

const garden = buildCourse(LEVELS[0]);

describe('Toon Flap rules', () => {
  it('replays a sent run exactly, refuses a made-up one, and a bump costs time but never ends the run', () => {
    const live = botRun(garden);
    expect(live.state.outcome).toBe('finished');
    const sent = decodeFlaps(encodeFlaps(live.flaps));
    const replay = replayRun(garden, sent ?? []);
    expect(replay.valid).toBe(true);
    expect(replay.state).toEqual(live.state);
    // A flap list that skips the flap the bird needs to leave a hover can't have come from playing.
    expect(replayRun(garden, live.flaps.map((f) => f + 1)).valid).toBe(false);
    expect(decodeFlaps('1,-2')).toBeNull();
    // Hovering costs no time; never flapping again means a bump, then hovering, still running.
    const s = newRun(garden);
    stepRun(garden, s, false);
    expect(s.t).toBe(0);
    stepRun(garden, s, true);
    let event = null;
    for (let i = 0; i < 1000 && event !== 'bump'; i++) event = stepRun(garden, s, false);
    expect(event).toBe('bump');
    expect(s).toMatchObject({ mode: 'hover', hover: 'bump', bumps: 1, outcome: 'running' });
    expect(scoreRun(s, { checksRight: 0, gapsRight: 0 }).steps).toBe(s.t + BUMP_PENALTY_STEPS);
  });

  it('a perfect run with every bonus is gold; Gentle wings and maths-off have their own rules; a potion cancels only one bump', () => {
    const run = botRun(garden).state;
    const perfect = scoreRun(run, { checksRight: 1, gapsRight: 0 });
    expect(medalFor(garden, perfect.seconds, true)).toBe('gold');
    expect(medalFor(garden, perfect.seconds, true, true)).toBe('silver');
    expect(medalFor(garden, scoreRun(run, { checksRight: 0, gapsRight: 0 }).seconds, false)).toBe('gold');
    // Checks can't count for more perches than were reached.
    expect(scoreRun(run, { checksRight: 9, gapsRight: 9 }).steps).toBe(perfect.steps);
    const bumped = { ...run, bumps: 2 };
    expect(scoreRun(bumped, { checksRight: 0, gapsRight: 0, potion: true }).steps).toBe(run.t + BUMP_PENALTY_STEPS);
    expect(medalFor(garden, 999, true)).toBe('bronze');
    // Answer gaps: the right gap comes from the seed; the labels hold the answer once, at that gap.
    const reef = buildCourse(LEVELS[2]);
    const right = rightGaps(reef, 'seed-1');
    expect(right).toEqual(rightGaps(reef, 'seed-1'));
    const labels = gapLabels(42, 3, right[0] % 3, 'seed-1', [42, 48, 36]);
    expect(labels.filter((l) => l === 42)).toHaveLength(1);
    expect(labels[right[0] % 3]).toBe(42);
    expect(gapsRight([right[0]], right)).toBe(1);
    expect(perfect.seconds).toBe(perfect.steps / STEPS_PER_SECOND);
  });

  it('opens levels in order, unlocks a flyer after 3 finishes, and caps potions', () => {
    const finish = (level: string, extra: Partial<RunSummary> = {}): RunSummary => ({ level, maths: true, seconds: 40, medal: 'bronze', bumps: 1, checks: [true], rightGaps: 0, potionUsed: false, ...extra });
    let p = emptyProgress();
    expect(levelOpen(p, 1)).toBe(true);
    expect(levelOpen(p, 2)).toBe(false);
    p = addRun(p, finish('garden')).progress;
    expect(levelOpen(p, 2)).toBe(true);
    p = addRun(p, finish('garden')).progress;
    expect(flyersUnlocked(p)).toEqual(['fantail']);
    const third = addRun(p, finish('garden'));
    expect(third.unlocks.flyers).toEqual(['puppy-plane']);
    // A first gold earns a potion; a second gold on the same level doesn't; never more than POTIONS_MAX held.
    p = third.progress;
    for (const level of ['garden', 'mesa', 'reef', 'kitchen', 'donut']) p = addRun(p, finish(level, { medal: 'gold' })).progress;
    expect(p.potions).toBe(POTIONS_MAX);
    expect(addRun(p, finish('garden', { medal: 'gold' })).unlocks.potion).toBe(false);
    expect(addRun(p, finish('mesa', { potionUsed: true, bumps: 1 })).progress.potions).toBe(POTIONS_MAX - 1);
  });
});
