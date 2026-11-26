// Toon Flap's rules (docs/TOON-FLAP-PLAN.md): the server's replay check, the time and medals, and the unlocks.
// Playing every level to the end is the sim's job (npm run toonflap:sim), not a test.
import { describe, expect, it } from 'vitest';
import { botRun } from './bot';
import { addRun, emptyProgress, finishesToUnlock, flyersUnlocked, levelOpen, unlockRuns, type RunSummary } from './collection';
import { BUMP_PENALTY_STEPS, DASH_MAX_SECONDS, MAX_RUN_STEPS, POTIONS_MAX, STEPS_PER_SECOND, WALL_WIDTH } from './config';
import { decodeFlaps, encodeFlaps, medalFor, newRun, replayRun, scoreRun, stepRun, type RunState } from './engine';
import { buildCourse, LEVELS } from './levels';
import { buildDashCourse, earnFeather, newDash, stepDash } from './dash';
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

    // Sky Dash: the same seed builds the same course; a bump ends it unless a feather (then the potion) saves it.
    const dash = buildDashCourse('123456789012');
    expect(buildDashCourse('123456789012')).toEqual(dash);
    const d = newDash(dash);
    earnFeather(d);
    const saves: string[] = [];
    let flapNext = true;
    for (let i = 0; i < 5000 && d.run.mode !== 'done'; i++) {
      const { save } = stepDash(dash, d, flapNext, true);
      flapNext = d.run.mode === 'hover';
      if (save) saves.push(save);
    }
    expect(saves).toEqual(['feather', 'potion', 'crash']);
    expect(d).toMatchObject({ crashed: true, feathers: 0, feathersUsed: 1, potionUsed: true });
    // A dash isn't stopped by the levels' 5-minute cap (it used to end dead at about wall 143): ~600 walls, 20 minutes.
    expect(dash.walls.length).toBeGreaterThan(550);
    const late = newDash(dash).run;
    Object.assign(late, { mode: 'fly', t: MAX_RUN_STEPS });
    stepRun(dash, late, true);
    expect(late.mode).toBe('fly');
    Object.assign(late, { t: DASH_MAX_SECONDS * STEPS_PER_SECOND - 1 });
    expect(stepRun(dash, late, true)).toBe('finish');
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

  it('opens one new level a day, unlocks a flyer after 15 finishes (10 on harder levels), and caps potions', () => {
    const finish = (level: string, extra: Partial<RunSummary> = {}): RunSummary => ({ level, maths: true, seconds: 40, medal: 'bronze', bumps: 1, checks: [true], rightGaps: 0, potionUsed: false, ...extra });
    const D1 = '2026-11-11';
    const D2 = '2026-11-12';
    let p = emptyProgress();
    expect(levelOpen(p, 1, D1)).toBe(true);
    expect(levelOpen(p, 2, D1)).toBe(false);
    const first = addRun(p, finish('garden'), D1);
    expect(first.unlocks.newLevel).toBe(true);
    p = first.progress;
    expect(levelOpen(p, 2, D1)).toBe(true);
    // Finishing level 2 the same day doesn't open level 3 until tomorrow, and flying it tomorrow opens it then.
    const second = addRun(p, finish('mesa'), D1);
    expect(second.unlocks).toMatchObject({ newLevel: false, levelTomorrow: true });
    p = second.progress;
    expect(levelOpen(p, 3, D1)).toBe(false);
    expect(levelOpen(p, 3, D2)).toBe(true);
    p = addRun(p, finish('reef'), D2).progress;
    expect([levelOpen(p, 4, D2), p.opened]).toEqual([false, 3]);
    // An easy level's flyer takes 15 finishes (garden has 1 so far); a harder level's takes 10.
    expect([unlockRuns('garden'), unlockRuns('donut'), unlockRuns('manor'), unlockRuns('cosmic')]).toEqual([15, 15, 10, 10]);
    for (let i = 0; i < 13; i++) p = addRun(p, finish('garden'), D2).progress;
    expect(flyersUnlocked(p)).toEqual(['fantail']);
    expect(finishesToUnlock(p, 'garden')).toBe(1);
    const third = addRun(p, finish('garden'), D2);
    expect(third.unlocks.flyers).toEqual(['puppy-plane']);
    // A first gold earns a potion; a second gold on the same level doesn't; never more than POTIONS_MAX held.
    p = third.progress;
    for (const level of ['garden', 'mesa', 'reef', 'kitchen', 'donut']) p = addRun(p, finish(level, { medal: 'gold' }), D2).progress;
    expect(p.potions).toBe(POTIONS_MAX);
    expect(addRun(p, finish('garden', { medal: 'gold' }), D2).unlocks.potion).toBe(false);
    expect(addRun(p, finish('mesa', { potionUsed: true, bumps: 1 }), D2).progress.potions).toBe(POTIONS_MAX - 1);
  });
  it('after bumping an answer wall, every answer (top, middle and bottom) can still be reached', () => {
    // A simple flyer aiming for gap `want`: flap whenever it is falling below a target height near the gap's middle.
    const reach = (course: ReturnType<typeof buildCourse>, start: RunState, wall: number, want: number): boolean => {
      const target = course.walls[wall].gaps[want].y;
      return [-0.6, -0.4, -0.2, 0, 0.2, 0.4].some((aim) => {
        const s = structuredClone(start);
        for (let i = 0; i < 600; i++) {
          if (stepRun(course, s, s.mode === 'hover' || (s.y < target + aim && s.vy <= 0)) === 'bump') return false;
          const pick = s.picks[course.walls[wall].answer!];
          if (pick !== null && pick !== want) return false;
          if (s.nextWall > wall) return true;
        }
        return false;
      });
    };
    const missed: string[] = [];
    for (const def of LEVELS) {
      const course = buildCourse(def);
      for (const sign of course.signs) {
        const wall = course.walls[sign.wall];
        // Fly into the wall's face below its lowest opening: a bump, then a hover in front of it.
        const s = newRun(course);
        Object.assign(s, { mode: 'fly', x: wall.x - 0.35, y: 0.5, vy: 0, nextWall: sign.wall, perches: course.perches.filter((p) => p.x < wall.x).length });
        expect(stepRun(course, s, false)).toBe('bump');
        expect(s.x).toBeLessThan(course.walls[sign.wall - 1].x + WALL_WIDTH + 1);
        wall.gaps.forEach((_, g) => {
          if (!reach(course, s, sign.wall, g)) missed.push(`${def.id} sign ${sign.i} gap ${g}`);
        });
      }
    }
    expect(missed).toEqual([]);
  });
});

describe('Christmas Coast (seasonal)', () => {
  it('opens only in December and January after Toon Garden, grabs presents, and keeps its record apart', async () => {
    const { SEASONAL_LEVELS, inSeason } = await import('./levels');
    const { levelRecord, nextStep, trailsUnlocked, golds } = await import('./collection');
    const xmas = SEASONAL_LEVELS[0];
    expect([inSeason(xmas, '2026-11-25'), inSeason(xmas, '2026-11-26'), inSeason(xmas, '2026-12-01'), inSeason(xmas, '2027-01-31'), inSeason(xmas, '2027-02-01'), inSeason(xmas, '2027-11-30')]).toEqual([false, true, true, true, false, false]);
    const run = (level: string, extra: Partial<RunSummary> = {}): RunSummary => ({ level, maths: true, seconds: 30, medal: 'gold', bumps: 0, checks: [], rightGaps: 0, potionUsed: false, ...extra });
    let p = emptyProgress();
    expect(levelOpen(p, xmas.n, '2026-12-05')).toBe(false); // Toon Garden first
    p = addRun(p, run('garden'), '2026-12-05').progress;
    expect(levelOpen(p, xmas.n, '2026-12-05')).toBe(true);
    expect(levelOpen(p, xmas.n, '2027-03-01')).toBe(false);
    expect(nextStep(p, '2026-12-06')).toContain('Christmas Coast');

    // Presents: flying through one grabs it.
    const course = buildCourse(xmas);
    expect(course.presents.length).toBeGreaterThan(5);
    const s = newRun(course);
    const gift = course.presents[0];
    Object.assign(s, { mode: 'fly', x: gift.x - 0.01, y: gift.y, vy: 0 });
    expect(stepRun(course, s, false)).toBe('present');
    expect(s.got[0]).toBe(true);

    // The record sits under `seasonal`: it never opens the next level or counts as a trail level.
    const opened = p.opened;
    const all = addRun(p, run('xmas', { presents: course.presents.length, presentsOf: course.presents.length }), '2026-12-06');
    expect(all.progress.opened).toBe(opened);
    expect(all.progress.levels.xmas).toBeUndefined();
    expect(levelRecord(all.progress, 'xmas')).toMatchObject({ finishes: 1, medal: 'gold', allPresents: 1 });
    expect(all.progress.presents).toBe(course.presents.length);
    expect(golds(all.progress)).toBe(1);
    expect(all.unlocks.flyers).toEqual(['santa-fantail', 'grumpy-santa']); // every present, and no bumps
    expect(trailsUnlocked(all.progress)).toContain('candy-canes');
    expect(unlockRuns('xmas')).toBe(5);
    let q = all.progress;
    for (let i = 0; i < 4; i++) q = addRun(q, run('xmas'), '2026-12-07').progress;
    expect(flyersUnlocked(q)).toContain('surf-sleigh');
    expect(finishesToUnlock(q, 'xmas')).toBe(0);
  });

  it('pupils\' rules: 3 presents make a potion (one a flight), the Elf Snow Globe flies 1 to 26 December, Santa pushes', async () => {
    const { SEASONAL_LEVELS } = await import('./levels');
    const { trailsUnlocked } = await import('./collection');
    const run = (extra: Partial<RunSummary> = {}): RunSummary => ({ level: 'xmas', maths: true, seconds: 50, medal: 'bronze', bumps: 1, checks: [], rightGaps: 0, potionUsed: false, presentsOf: 8, ...extra });
    let p = emptyProgress();
    let r = addRun(p, run({ presents: 2 }), '2026-12-02');
    expect([r.unlocks.potion, r.progress.potions, r.progress.sack]).toEqual([false, 0, 2]);
    r = addRun(r.progress, run({ presents: 1 }), '2026-12-02');
    expect([r.unlocks.potion, r.unlocks.potionFromPresents, r.progress.potions, r.progress.sack]).toEqual([true, true, 1, 0]);
    r = addRun(r.progress, run({ presents: 8 }), '2026-12-02'); // only one potion a flight; at most 2 wait in the sack
    expect([r.progress.potions, r.progress.sack]).toEqual([2, 2]);
    p = r.progress;
    expect(flyersUnlocked(p, '2026-12-26')).toContain('elf-globe');
    expect(flyersUnlocked(p, '2026-12-27')).not.toContain('elf-globe');
    expect(flyersUnlocked(p, '2026-11-26')).toContain('elf-globe'); // opened early (James, 26 Nov 2026)
    expect(flyersUnlocked(p, '2026-11-25')).not.toContain('elf-globe');
    expect(flyersUnlocked(p, '2026-12-10')).not.toContain('grumpy-santa'); // every flight so far had a bump
    expect(trailsUnlocked(p)).not.toContain('baubles');
    p = addRun(p, run({ bumps: 0, presents: 19 }), '2026-12-03').progress;
    expect(flyersUnlocked(p)).toContain('grumpy-santa');
    expect(trailsUnlocked(p)).toContain('baubles'); // 30 presents
    expect(buildCourse(SEASONAL_LEVELS[0]).zones.some((z) => z.kind === 'ghost')).toBe(true);
  });
});
