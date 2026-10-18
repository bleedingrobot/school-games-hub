import { describe, expect, it } from 'vitest';
import { botRun } from './bot';
import { courseById } from './courses';
import { doorsForSeed } from './maths';
import { encodeInputs } from './inputs';
import { judgeRun, makeMarbleSeed, marbleSeedProblem, marbleSeedTime, marbleStampText, parseMarbleReport } from './save';

const NOW = 1_792_000_000;
const seedAgo = (s: number) => makeMarbleSeed(NOW - s, 'ab'.repeat(12));
const course = courseById('boulder-beach')!;
const SEED = seedAgo(200);
const doors = doorsForSeed(course, SEED, null);
const bot = botRun(course, { mode: 'up', openDoors: doors });
const inputs = encodeInputs(bot.runs);
const report = (over: Record<string, unknown> = {}) => ({ seed: SEED, stamp: 'x', course: 'boulder-beach', mode: 'up', inputs, ...over });

describe('seeds', () => {
  it('are made from the time and 12 bytes, and read back', () => {
    const seed = makeMarbleSeed(NOW, 'ab'.repeat(12));
    expect(seed).toBe(`m1-${NOW}-${'ab'.repeat(12)}`);
    expect(marbleSeedTime(seed)).toBe(NOW);
    expect(marbleSeedTime('s1-1792000000-' + 'ab'.repeat(12))).toBeNull();
  });
  it('are fresh for six hours and not from the future', () => {
    expect(marbleSeedProblem(seedAgo(60), NOW)).toBeNull();
    expect(marbleSeedProblem(seedAgo(7 * 3600), NOW)).toBe('seed too old');
    expect(marbleSeedProblem(seedAgo(-1000), NOW)).toBe('seed from the future');
    expect(marbleSeedProblem('made-up', NOW)).toBe('not a server seed');
  });
  it('are stamped for one student, course, mode and seed', () => {
    const t = (p: string, c: string, m: 'up' | 'down', s: string) => marbleStampText(p, c, m, s);
    expect(new Set([t('a', 'c', 'up', 's'), t('b', 'c', 'up', 's'), t('a', 'd', 'up', 's'), t('a', 'c', 'down', 's'), t('a', 'c', 'up', 't')]).size).toBe(5);
  });
});

describe('reading a report', () => {
  it('takes a well-shaped one', () => {
    expect(parseMarbleReport(report())).toMatchObject({ course: 'boulder-beach', mode: 'up' });
  });
  it('turns away the rest', () => {
    for (const bad of [null, 5, report({ mode: 'x' }), report({ course: 'Bad Course' }), report({ inputs: 5 }), report({ inputs: 'a'.repeat(60001) }), report({ stamp: 5 })]) {
      expect(parseMarbleReport(bad)).toBeNull();
    }
  });
});

describe('judging a run', () => {
  const judge = (over: Record<string, unknown> = {}) => judgeRun(parseMarbleReport(report(over))!, NOW, doors);
  it('replays the inputs and gives the time they make', () => {
    const j = judge();
    expect(j.ok).toBe(true);
    if (j.ok) {
      expect(j.run.steps).toBe(bot.state.finishSteps);
      expect(j.run.falls).toBe(bot.state.falls);
    }
  });
  it('needs a finish', () => {
    expect(judge({ inputs: '0x600' })).toEqual({ ok: false, problem: 'no finish' });
    expect(judge({ inputs: '' })).toEqual({ ok: false, problem: 'no finish' });
  });
  it('needs readable inputs and a real course', () => {
    expect(judge({ inputs: 'zz' })).toEqual({ ok: false, problem: 'inputs not readable' });
    expect(judge({ course: 'nowhere' })).toEqual({ ok: false, problem: 'unknown course' });
  });
  it('is faster than the real time since the seed? Then no', () => {
    expect(judge({ seed: seedAgo(3) })).toEqual({ ok: false, problem: 'faster than real time' });
  });
});
