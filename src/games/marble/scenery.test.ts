import { describe, expect, it } from 'vitest';
import { COURSES } from '../../../shared/marble/courses';
import { landmarkKinds, planScenery } from './scenery';

const IDS = ['boulder-beach', 'crown-range', 'geyser-valley', 'glacier-run', 'windy-welly', 'alpine-crossing', 'wide-hill', 'gap-and-ice'];
const courses = IDS.map((id) => COURSES.find((c) => c.def.id === id)!);

/** Chebyshev distance from a cell to the nearest non-void tile (a big number if there is none). */
function distToTrack(course: (typeof courses)[number], x: number, y: number): number {
  let best = 99;
  for (let ty = 0; ty < course.height; ty++) {
    for (let tx = 0; tx < course.width; tx++) {
      if (course.tiles[ty * course.width + tx].ch === '.') continue;
      best = Math.min(best, Math.max(Math.abs(tx - x), Math.abs(ty - y)));
    }
  }
  return best;
}

describe('planScenery', () => {
  it('finds all eight courses', () => {
    expect(courses.every(Boolean)).toBe(true);
  });

  it('gives an empty plan for an unknown course', () => {
    const plan = planScenery(COURSES.find((c) => c.def.id === 'test-easy')!);
    expect(plan.islands).toEqual([]);
    expect(plan.props).toEqual([]);
  });

  for (const course of courses) {
    describe(course.def.id, () => {
      const plan = planScenery(course);

      it('is the same every time', () => {
        expect(planScenery(course)).toEqual(plan);
      });

      it('has islands only on void, at least two tiles from the track and within six', () => {
        expect(plan.islands.length).toBeGreaterThanOrEqual(8);
        for (const i of plan.islands) {
          expect(i.w).toBeGreaterThanOrEqual(1);
          expect(i.h).toBeGreaterThanOrEqual(1);
          expect(i.w * i.h).toBeLessThanOrEqual(6);
          expect(i.top).toBeGreaterThanOrEqual(-1.5);
          for (let y = i.y; y < i.y + i.h; y++) {
            for (let x = i.x; x < i.x + i.w; x++) {
              const d = distToTrack(course, x, y);
              expect(d).toBeGreaterThanOrEqual(2);
              expect(d).toBeLessThanOrEqual(6);
            }
          }
        }
      });

      it('has islands that do not touch each other', () => {
        const { islands } = plan;
        for (let a = 0; a < islands.length; a++) {
          for (let b = a + 1; b < islands.length; b++) {
            const A = islands[a];
            const B = islands[b];
            const apartX = A.x + A.w + 1 <= B.x || B.x + B.w + 1 <= A.x;
            const apartY = A.y + A.h + 1 <= B.y || B.y + B.h + 1 <= A.y;
            expect(apartX || apartY).toBe(true);
          }
        }
      });

      it('puts every prop on an island (except gulls) at the island height', () => {
        for (const p of plan.props) {
          if (p.kind === 'gull') continue;
          const on = plan.islands.find((i) => p.x >= i.x && p.x <= i.x + i.w && p.y >= i.y && p.y <= i.y + i.h);
          expect(on).toBeTruthy();
          expect(p.z).toBe(on!.top);
        }
        for (const p of plan.props) {
          expect(p.priority).toBeGreaterThanOrEqual(0);
          expect(p.priority).toBeLessThanOrEqual(1);
          expect(p.variant).toBeGreaterThanOrEqual(0);
          expect(p.variant).toBeLessThanOrEqual(3);
        }
      });

      it('has its landmark kinds and no more than 220 props', () => {
        const kinds = new Set(plan.props.map((p) => p.kind));
        const wanted = landmarkKinds(course.def.id);
        expect(wanted.length).toBeGreaterThan(0);
        for (const kind of wanted) expect(kinds.has(kind)).toBe(true);
        expect(plan.props.length).toBeLessThanOrEqual(220);
        expect(plan.props.length).toBeGreaterThan(20);
      });
    });
  }

  it('has seagulls on the beach and the harbour, floating above the track', () => {
    for (const id of ['boulder-beach', 'windy-welly']) {
      const gulls = planScenery(courses[IDS.indexOf(id)]).props.filter((p) => p.kind === 'gull');
      expect(gulls.length).toBeGreaterThan(0);
      for (const g of gulls) expect(g.z).toBeGreaterThanOrEqual(1.5);
    }
  });
});
