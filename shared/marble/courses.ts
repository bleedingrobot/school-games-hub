/**
 * The courses, as frozen literals (docs/MARBLE-PLAN.md, section 3). The two `test-` courses are for the
 * engine's tests and the first screens; the six New Zealand courses come in stage M.3.
 * Medal times are set from each course's reference run (`reference.test.ts` keeps them honest).
 */
import { compileCourse, type Course, type CourseDef } from './course';
import { NZ_COURSE_DEFS } from './nzCourses';

export const TEST_EASY: CourseDef = {
  id: 'test-easy',
  name: 'Wide Hill',
  rows: [
    '================',
    '=##>>mm##>#>##f=',
    '=##>>mm##>#>##f=',
    '=s#>>mm#c>#>##f=',
    '=##>>mm##>#>##f=',
    '=##>>mm##>#>##f=',
    '================',
  ],
  heights: [
    '0000000000000000',
    '0666544444332220',
    '0666544444332220',
    '0666544444332220',
    '0666544444332220',
    '0666544444332220',
    '0000000000000000',
  ],
  route: [[8.5, 3.5], [14.5, 3.5]],
  medals: { gold: 4, silver: 7, bronze: 12 },
  hardSeconds: 15,
};

export const TEST_HARD: CourseDef = {
  id: 'test-hard',
  name: 'Gap and Ice',
  rows: [
    '...................',
    '...................',
    '...................',
    '.##>j..###iiii##>f.',
    '.s#>j..#c#iiiib#>f.',
    '.##>j..###iiii##>f.',
    '...................',
    '...................',
    '...................',
  ],
  heights: [
    '0000000000000000000',
    '0000000000000000000',
    '0000000000000000000',
    '0555400444444444430',
    '0555400444444444430',
    '0555400444444444430',
    '0000000000000000000',
    '0000000000000000000',
    '0000000000000000000',
  ],
  route: [[4.5, 4.5], [8.5, 4.5], [13.5, 3.5], [15.5, 3.5], [17.5, 4.5]],
  medals: { gold: 5, silver: 9, bronze: 15 },
  hardSeconds: 20,
};

export const COURSE_DEFS: readonly CourseDef[] = [...NZ_COURSE_DEFS, TEST_EASY, TEST_HARD];

export const COURSES: readonly Course[] = COURSE_DEFS.map(compileCourse);

export function courseById(id: string): Course | undefined {
  return COURSES.find((c) => c.def.id === id);
}
