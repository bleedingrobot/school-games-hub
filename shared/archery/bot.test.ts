import { describe, expect, it } from 'vitest';
import { botArrows } from './arrows';
import {
  BOT_KITS, BOT_LEVELS, BOT_MAX_SIMS, BOT_TUNING, chooseBotShot, chooseBotShotWithInfo, chooseForRun, type BotLevel, type BotTuning,
} from './bot';
import { shotProblem, startFight, takeShot, type FightRun } from './fight';
import { mixSeed } from './random';
import { WORLD_IDS, type ArrowId, type FightSetup, type Shot, type WorldId } from './types';

const kitSetup = (world: WorldId, a: BotLevel, b: BotLevel): FightSetup => ({
  world,
  players: [{ quiver: { ...BOT_KITS[a] }, shield: 0 }, { quiver: { ...BOT_KITS[b] }, shield: 0 }],
});

/** Plays a whole bot-against-bot fight, checking every shot as it goes. */
function playBots(seed: number, setup: FightSetup, levels: [BotLevel, BotLevel], each?: (run: FightRun, shot: Shot, sims: number) => void) {
  const run = startFight(seed, setup);
  const shots: Shot[] = [];
  while (run.winner === null) {
    const p = run.round.turn;
    const c = chooseForRun(run, levels[p]);
    expect(c.player).toBe(p);
    expect(shotProblem(c.shot, setup, p, run.used[p])).toBeNull();
    each?.(run, c.shot, c.sims);
    const taken = takeShot(run, c.shot);
    expect(taken.problem).toBeNull();
    shots.push(c.shot);
  }
  return { run, shots };
}

describe('archery bots', () => {
  it('only shoot Plain or Steel from the bots list, never more Steel than the kit, and every shot is legal', () => {
    const allowed = new Set(botArrows().map((a) => a.id));
    // The setup offers far more than the kits, including the Glass Arrow and Stage 3 arrows.
    const greedy: Partial<Record<ArrowId, number>> = { steel: 9, glass: 5, giant: 5, rain: 5, log: 5 };
    for (const world of WORLD_IDS) {
      for (const level of BOT_LEVELS) {
        const setup: FightSetup = { world, players: [{ quiver: { ...greedy }, shield: 0 }, { quiver: { ...greedy }, shield: 0 }] };
        const { run, shots } = playBots(mixSeed(11, WORLD_IDS.indexOf(world) * 10 + BOT_LEVELS.indexOf(level)), setup, [level, level]);
        for (const s of shots) {
          expect(['plain', 'steel']).toContain(s.arrow);
          expect(allowed.has(s.arrow)).toBe(true);
          expect(Number.isInteger(s.angle) && s.angle >= 0 && s.angle <= 180).toBe(true);
          expect(Number.isInteger(s.power) && s.power >= 0 && s.power <= 100).toBe(true);
        }
        for (const used of run.used) {
          expect(used.steel ?? 0).toBeLessThanOrEqual(BOT_KITS[level].steel ?? 0);
          expect(used.glass ?? 0).toBe(0);
        }
      }
    }
  });

  it('never shoots a Steel Arrow it does not have', () => {
    const setup: FightSetup = { world: 'desert', players: [{ quiver: {}, shield: 0 }, { quiver: {}, shield: 0 }] };
    const { shots } = playBots(77, setup, ['hard', 'medium']);
    expect(shots.every((s) => s.arrow === 'plain')).toBe(true);
  });

  it('gives the same shot for the same turn, and the replayed fight agrees with the running one', () => {
    const setup = kitSetup('snow', 'hard', 'easy');
    const seen: { shots: Shot[] }[] = [];
    const shots: Shot[] = [];
    playBots(4242, setup, ['hard', 'easy'], (_run, shot) => {
      if (shots.length % 5 === 0) seen.push({ shots: [...shots] });
      shots.push(shot);
    });
    expect(seen.length).toBeGreaterThan(3);
    // Ask both levels about the same turns, twice each: same answer every time.
    for (const { shots: before } of seen.slice(0, 6)) {
      for (const level of BOT_LEVELS) {
        const turn = { seed: 4242, setup, shots: before, level };
        expect(chooseBotShot(turn)).toEqual(chooseBotShot(turn));
      }
    }
    // And the replayed answer is the one the running fight got.
    const run = startFight(4242, setup);
    const levels: [BotLevel, BotLevel] = ['hard', 'easy'];
    for (let i = 0; i < 25 && run.winner === null; i++) {
      const p = run.round.turn;
      const live = chooseForRun(run, levels[p]).shot;
      expect(chooseBotShot({ seed: 4242, setup, shots: run.records.map((r) => r.shot), level: levels[p] })).toEqual(live);
      takeShot(run, live);
    }
  });

  it('never flies more than 3 trial shots in a turn', () => {
    expect(BOT_MAX_SIMS).toBe(3);
    let most = 0;
    for (const world of WORLD_IDS) {
      playBots(mixSeed(5, WORLD_IDS.indexOf(world)), kitSetup(world, 'hard', 'hard'), ['hard', 'hard'], (_r, _s, sims) => {
        most = Math.max(most, sims);
      });
    }
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(BOT_MAX_SIMS);
    const info = chooseBotShotWithInfo({ seed: 9, setup: kitSetup('forest', 'easy', 'medium'), shots: [], level: 'easy' });
    expect(info.sims).toBe(0);
  });

  it("Easy walks its power the right way: less after a long shot, more after a short one", () => {
    // Take away the wobble and the deliberate misses so the walk itself shows.
    const easy = BOT_TUNING.easy as BotTuning;
    const saved = { ...easy };
    Object.assign(easy, { powerWobble: 0, angleWobble: 0, missChance: 0 });
    try {
      let long = 0;
      let short = 0;
      for (let f = 0; f < 6; f++) {
        const setup = kitSetup(WORLD_IDS[f % 4], 'easy', 'easy');
        playBots(mixSeed(31, f), setup, ['easy', 'easy'], (run, shot) => {
          const p = run.round.turn;
          const last = [...run.records].reverse().find((r) => r.round === run.round.index && r.player === p);
          if (!last || last.damage[1 - p] > 0) return;
          const them = run.round.archers[1 - p];
          const dir = them.x > run.round.archers[p].x ? 1 : -1;
          const miss = (last.hit.x - them.x) * dir;
          if (last.shot.power >= 97 && miss < 0) return; // at full power it aims flatter instead
          if (miss > 30 && last.shot.power > 2) {
            expect(shot.power).toBeLessThan(last.shot.power);
            long++;
          } else if (miss < -30 && last.shot.power < 98) {
            expect(shot.power).toBeGreaterThan(last.shot.power);
            short++;
          }
        });
      }
      expect(long).toBeGreaterThan(5);
      expect(short).toBeGreaterThan(5);
    } finally {
      Object.assign(easy, saved);
    }
  });

  it('Hard beats Easy most of the time', () => {
    let hard = 0;
    const fights = 24;
    for (let i = 0; i < fights; i++) {
      const world = WORLD_IDS[i % 4];
      const hardSeat = i % 2;
      const levels: [BotLevel, BotLevel] = hardSeat === 0 ? ['hard', 'easy'] : ['easy', 'hard'];
      const { run } = playBots(mixSeed(2026, i), kitSetup(world, levels[0], levels[1]), levels);
      if (run.winner === hardSeat) hard++;
    }
    expect(hard).toBeGreaterThanOrEqual(Math.ceil(fights * 0.7));
  });
});
