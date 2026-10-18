import { describe, expect, it } from 'vitest';
import { STUDENTS } from '../sim';
import { simRealTower, simRoute } from './routeSim';

const student = (right: number) => ({ right, quick: 0.5, catchBelow: 0 });

describe('the real Tower trainers (pretend students, seeded so the numbers never wobble)', () => {
  it('a student whose team is ready for the area wins most of the time: a 90% student nearly always, a 50% student more often than not', () => {
    for (let area = 1; area <= 6; area++) {
      const hard = simRealTower(area, student(STUDENTS['50%']), 120, `t:${area}:50`);
      const mid = simRealTower(area, student(STUDENTS['75%']), 120, `t:${area}:75`);
      const easy = simRealTower(area, student(STUDENTS['90%']), 120, `t:${area}:90`);
      expect(hard.ready.winRate, `area ${area}, 50%`).toBeGreaterThan(0.7);
      expect(mid.ready.winRate, `area ${area}, 75%`).toBeGreaterThan(0.9);
      expect(easy.ready.winRate, `area ${area}, 90%`).toBeGreaterThan(0.95);
      // A Tower is a real step up: a team three levels behind does clearly worse.
      expect(hard.behind.winRate, `area ${area}, 50% behind`).toBeLessThan(hard.ready.winRate);
      // 10 to 16 questions is a good Tower fight, never a marathon.
      expect(hard.ready.questions.mean).toBeLessThan(18);
      expect(easy.ready.questions.mean).toBeGreaterThan(6);
    }
  });
});

describe('the whole route', () => {
  it('can be played from level 5 to the last Tower in a few hundred battles at most, and gets harder gently', () => {
    const r = simRoute(student(STUDENTS['75%']), 'route-test');
    expect(r.battlesToReady).toHaveLength(6);
    expect(r.totalBattles).toBeGreaterThan(60);
    expect(r.totalBattles).toBeLessThan(400);
    expect(r.minutes).toBeGreaterThan(30);
    expect(r.leadAtTower[5]).toBeGreaterThanOrEqual(r.leadAtTower[0]);
    for (const tries of r.towerTries) expect(tries).toBeLessThanOrEqual(8);
  });
});
