import { describe, expect, it } from 'vitest';
import { chooseForRun } from './bot';
import { DUEL_MAX_TIMEOUTS } from './config';
import { PASS, duelBack, duelScores, duelSetup, readShot, readTurns, replayDuel, timeoutsAfter, tooManyTimeouts } from './duel';
import { startFight, takeShot } from './fight';
import type { PlayerSetup, Shot } from './types';

const packs: [PlayerSetup, PlayerSetup] = [
  { quiver: { steel: 2, apple: 1 }, shield: 'wood', bow: 'long' },
  { quiver: { giant: 1 }, shield: null, bow: 'starter' },
];

/** Plays a whole classmate fight with two Hard bots taking each other's seat (and some turns used up). */
function wholeFight(seed: number, passEvery = 0) {
  const setup = duelSetup('desert', packs);
  const run = startFight(seed, setup);
  const turns: Shot[] = [];
  while (run.winner === null) {
    const shot = passEvery && turns.length % passEvery === passEvery - 1 ? PASS : chooseForRun(run, 'hard').shot;
    expect(takeShot(run, shot).problem).toBeNull();
    turns.push(shot);
  }
  return { setup, run, turns };
}

describe('classmate fights', () => {
  it('are one round: whoever wins it wins the fight', () => {
    for (const seed of [1, 2, 3]) {
      const { run } = wholeFight(seed);
      expect(run.rounds).toHaveLength(1);
      expect(run.winner).toBe(run.rounds[0].winner);
    }
  });

  it('replay the same from the turn list, used-up turns and all', () => {
    const { setup, run, turns } = wholeFight(7, 5);
    expect(turns.some((t) => t.pass)).toBe(true);
    const again = replayDuel(7, setup, readTurns(JSON.parse(JSON.stringify(turns)))!);
    expect(again.problem).toBeNull();
    expect(again.run.winner).toBe(run.winner);
    expect(again.run.used).toEqual(run.used);
    expect(again.run.round.archers).toEqual(run.round.archers);
    expect(duelScores(again.run)).toEqual(duelScores(run));
  });

  it('keep both packs apart from the setup they came from', () => {
    const setup = duelSetup('city', packs);
    setup.players[0].quiver.steel = 0;
    expect(packs[0].quiver.steel).toBe(2);
    expect(setup.oneRound).toBe(true);
  });

  it('give back what each player packed and did not use', () => {
    const setup = duelSetup('forest', packs);
    expect(duelBack(setup, [{ steel: 1, apple: 1 }, {}])).toEqual([{ steel: 1 }, { giant: 1 }]);
  });

  it('read a sent shot, and never a pass (only the timer makes those)', () => {
    expect(readShot({ angle: 50, power: 60, arrow: 'steel', apple: true })).toEqual({ angle: 50, power: 60, arrow: 'steel', apple: true });
    expect(readShot({ angle: 50, power: 60, arrow: 'steel', pass: true })).toBeNull();
    expect(readShot({ angle: '50', power: 60, arrow: 'steel' })).toBeNull();
    expect(readShot([1, 2])).toBeNull();
    expect(readShot(null)).toBeNull();
    expect(readTurns([{ angle: 50, power: 60, arrow: 'plain' }, { pass: true }])).toEqual([{ angle: 50, power: 60, arrow: 'plain' }, PASS]);
    expect(readTurns('nope')).toBeNull();
  });

  it(`end after ${DUEL_MAX_TIMEOUTS} used-up turns in a row by the same player`, () => {
    let t: [number, number] = [0, 0];
    t = timeoutsAfter(t, 0, true);
    t = timeoutsAfter(t, 1, true);
    t = timeoutsAfter(t, 0, true);
    t = timeoutsAfter(t, 1, false);
    expect(t).toEqual([2, 0]);
    expect(tooManyTimeouts(t)).toBe(false);
    t = timeoutsAfter(t, 0, true);
    expect(tooManyTimeouts(t)).toBe(true);
    // A real shot in between starts the count again.
    expect(timeoutsAfter([2, 1], 0, false)).toEqual([0, 1]);
  });
});
