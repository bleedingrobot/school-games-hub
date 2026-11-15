import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { CheckPupil } from '../../data/factsCheck';
import { classSummary, FactsCheckPanel } from './FactsCheckPanel';

const check = (right: number, quick: number, at = '2026-11-15T00:00:00Z', middleMs = 3000) => ({
  at, right, quick, middleMs, marks: Array.from({ length: 24 }, (_, i) => (i < quick ? 2 : i < right ? 1 : 0)),
});
const pupil = (id: string, checks: ReturnType<typeof check>[]): CheckPupil => ({ id, name: id, realName: `${id}.r`, year: 5, checks });

const CLASS = [
  pupil('ana', [check(18, 8), check(20, 12, '2026-12-13T00:00:00Z', 2000)]),
  pupil('ben', [check(20, 14), check(19, 12, '2026-12-13T00:00:00Z')]),
  pupil('cat', [check(10, 2)]),
  pupil('dan', []),
];

it('compares first and latest checks, finds the hardest facts, and shows each pupil who has done one', async () => {
  const s = classSummary(CLASS);
  expect(s).toMatchObject({ done: 3, notDone: 1, twice: 2, quickBefore: 11, quickNow: 12, better: 1, worse: 1, middleBefore: 3000 });
  expect(s.hardest[0]).toEqual({ prompt: '56 ÷ 7', right: 0 });
  render(<FactsCheckPanel classId="c1" load={async () => CLASS} />);
  expect(await screen.findByText(/2 pupils with two or more checks/)).toBeInTheDocument();
  expect(screen.getByText('+4')).toBeInTheDocument();
  expect(screen.queryByText('dan')).not.toBeInTheDocument();
  expect(screen.getByText(/Not done yet: 1 pupil/)).toBeInTheDocument();
});
