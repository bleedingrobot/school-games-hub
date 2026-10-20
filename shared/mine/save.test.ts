import { describe, expect, it } from 'vitest';
import { flyLevel } from './bot';
import { makeWorld, newRun } from './engine';
import { encodeInputs, GRANT, PENALTY } from './inputs';
import { makeLevel, RECIPES, recipeById } from './level';
import { DOOR_QUESTIONS, PAD_QUESTIONS, questionPlan, targetOfSlot } from './maths';
import { isCountedLevel, judgeRun, makeMineSeed, mineSeedProblem, mineSeedTime, mineStampText, parseMineReport, MINE_SEED_LIFETIME_SECONDS } from './save';

const NOW = 1_792_000_000;
const seedAt = (ago: number) => makeMineSeed(NOW - ago, 'ab'.repeat(12));

function reportFor(levelId: string, maths: boolean, steady = true, ago = 1200) {
  const world = makeWorld(makeLevel(recipeById(levelId)!), { steady, maths });
  const bot = flyLevel(world);
  return { bot, report: { seed: seedAt(ago), stamp: 's', level: levelId, mode: steady ? ('steady' as const) : ('free' as const), maths, inputs: encodeInputs(bot.runs) } };
}

describe('seeds and stamps', () => {
  it('makes a seed that says when it was made', () => {
    expect(seedAt(0)).toMatch(/^n1-\d{10}-[0-9a-f]{24}$/);
    expect(mineSeedTime(seedAt(100))).toBe(NOW - 100);
    expect(mineSeedTime('m1-1792000000-' + 'ab'.repeat(12))).toBeNull();
  });
  it('accepts a fresh seed and refuses an old, future or made-up one', () => {
    expect(mineSeedProblem(seedAt(60), NOW)).toBeNull();
    expect(mineSeedProblem(seedAt(MINE_SEED_LIFETIME_SECONDS + 5), NOW)).toBe('seed too old');
    expect(mineSeedProblem(seedAt(-1000), NOW)).toBe('seed from the future');
    expect(mineSeedProblem('banana', NOW)).toBe('not a server seed');
  });
  it('signs the pupil, the mine, the flight, the maths choice and the seed', () => {
    const base = mineStampText('p', 'l1', 'steady', true, 'seed');
    for (const other of [mineStampText('q', 'l1', 'steady', true, 'seed'), mineStampText('p', 'l2', 'steady', true, 'seed'), mineStampText('p', 'l1', 'free', true, 'seed'), mineStampText('p', 'l1', 'steady', false, 'seed'), mineStampText('p', 'l1', 'steady', true, 'other')]) {
      expect(other).not.toBe(base);
    }
  });
});

describe('what counts as a mine and a report', () => {
  it('counts the six mines and their hard versions, and nothing else', () => {
    for (const r of RECIPES) {
      expect(isCountedLevel(r.id)).toBe(true);
      expect(isCountedLevel(`${r.id}:hard`)).toBe(true);
    }
    for (const bad of ['practice', 'l0', 'l7', 'l1:easy', 'l1:hard:hard', '', 5, null, undefined]) expect(isCountedLevel(bad)).toBe(false);
  });
  it('reads a well-made report and turns away the rest', () => {
    const good = { seed: seedAt(1), stamp: 's', level: 'l1', mode: 'free', maths: false, inputs: '1x1' };
    expect(parseMineReport(good)).toEqual(good);
    for (const bad of [null, 5, { ...good, level: 'practice' }, { ...good, mode: 'up' }, { ...good, maths: 'yes' }, { ...good, inputs: 5 }, { ...good, inputs: 'a'.repeat(200_001) }, { ...good, seed: 'x'.repeat(81) }, { ...good, stamp: 'x'.repeat(201) }]) {
      expect(parseMineReport(bad)).toBeNull();
    }
  });
});

describe('the question plan', () => {
  it('gives every question door and pad its own block, doors first then pads', () => {
    for (const r of RECIPES) {
      for (const id of [r.id, `${r.id}:hard`]) {
        const level = makeLevel(recipeById(id)!);
        const plan = questionPlan(level);
        const doors = level.doors.filter((d) => d.kind === 'question').length;
        expect(plan.targets.filter((t) => t.kind === 'door')).toHaveLength(doors);
        expect(plan.targets.filter((t) => t.kind === 'pad')).toHaveLength(level.pads.length);
        expect(plan.total).toBe(doors * DOOR_QUESTIONS + level.pads.length * PAD_QUESTIONS);
        let at = 0;
        for (const t of plan.targets) {
          expect(t.first).toBe(at);
          at += t.count;
        }
        // The id is the number a GRANT names.
        for (const t of plan.targets) {
          if (t.kind === 'door') expect(level.doors[t.id].kind).toBe('question');
          else expect(level.pads[t.id - level.doors.length].id).toBe(t.id);
        }
        expect(targetOfSlot(plan, 0)).toBe(plan.targets[0]);
        expect(targetOfSlot(plan, plan.total)).toBeUndefined();
        expect(targetOfSlot(plan, -1)).toBeUndefined();
      }
    }
  });
});

describe('judging a run', () => {
  it('replays the inputs and works out the time and what opened by an answer', () => {
    const { bot, report } = reportFor('l2', true);
    const judged = judgeRun(report, NOW);
    expect(judged.ok).toBe(true);
    if (!judged.ok) return;
    expect(judged.run.steps).toBe(bot.state.finishSteps);
    expect(judged.run.played).toBe(bot.state.steps);
    expect(judged.run.penalties).toBe(0);
    const door = makeLevel(recipeById('l2')!).doors.find((d) => d.kind === 'question')!;
    expect(judged.run.grants).toEqual([door.id]);
  });

  it('plays free flight as free flight', () => {
    const { bot, report } = reportFor('l1', false, false);
    const judged = judgeRun(report, NOW);
    expect(judged.ok && judged.run.steps).toBe(bot.state.finishSteps);
    // The same inputs played as steady flight do not give the same run.
    const steady = judgeRun({ ...report, mode: 'steady' }, NOW);
    expect(steady.ok && steady.run.steps === bot.state.finishSteps).toBe(false);
  });

  it('refuses a run that never reached the exit, or cannot be read', () => {
    const { report } = reportFor('l1', false);
    expect(judgeRun({ ...report, inputs: '0x600' }, NOW)).toEqual({ ok: false, problem: 'no finish' });
    expect(judgeRun({ ...report, inputs: 'banana' }, NOW)).toEqual({ ok: false, problem: 'inputs not readable' });
  });

  it('refuses a time faster than the real time since the seed was handed out', () => {
    const { report } = reportFor('l1', false, true, 10);
    expect(judgeRun(report, NOW)).toEqual({ ok: false, problem: 'faster than real time' });
  });

  it('refuses a made-up answer: a grant in a run with no maths, or for nothing that is near', () => {
    const { bot, report } = reportFor('l1', false);
    expect(judgeRun({ ...report, inputs: encodeInputs([[GRANT, 1], ...bot.runs]) }, NOW)).toEqual({ ok: false, problem: 'a door or pad opened that was not earned' });
    const withMaths = reportFor('l1', true);
    expect(judgeRun({ ...withMaths.report, inputs: encodeInputs([[GRANT + 40, 1], ...withMaths.bot.runs]) }, NOW).ok).toBe(false);
  });

  it('counts a penalty and takes it into the time', () => {
    const { bot, report } = reportFor('l2', true);
    const door = makeLevel(recipeById('l2')!).doors.find((d) => d.kind === 'question')!;
    const at = bot.runs.findIndex(([code]) => code === GRANT + door.id);
    const runs: [number, number][] = [...bot.runs.slice(0, at), [PENALTY, 1], ...bot.runs.slice(at)];
    const judged = judgeRun({ ...report, inputs: encodeInputs(runs) }, NOW);
    expect(judged.ok && judged.run.penalties).toBe(1);
    expect(judged.ok && judged.run.steps).toBe(bot.state.finishSteps + 180);
  });

  it('opens question doors for a run without maths, and nothing counts as answered', () => {
    const level = makeLevel(recipeById('l2')!);
    const world = makeWorld(level, { maths: false });
    const state = newRun(world);
    for (const door of level.doors) expect(state.doorsOpen[door.id]).toBe(door.kind === 'question' ? 1 : 0);
    // With maths (the default) they all start shut, exactly as before.
    expect(newRun(makeWorld(level)).doorsOpen.every((d) => d === 0)).toBe(true);
    expect(makeWorld(level).maths).toBe(true);
  });
});
