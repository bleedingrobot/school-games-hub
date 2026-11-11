import { render, screen} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameDefinition, HardestRow } from '../games/types';

const picked = vi.hoisted(() => ({ classId: 'c1' as string | null }));
vi.mock('./TeacherClass', () => ({
  useTeacherClass: () => ({ classId: picked.classId, current: picked.classId ? { id: picked.classId, name: 'Room 12' } : null, ready: true }),
}));

import { HardestQuestions} from './Hardest';

const row = (question: string, correct: number, attempts: number, extra: Partial<HardestRow> = {}): HardestRow => ({
  question,
  topic: 'Times tables',
  attempts,
  correct,
  students: 3,
  ...extra,
});
const fake = (id: string, name: string, hardest?: () => Promise<HardestRow[]>) =>
  ({ id, name, teacher: hardest ? { hardest } : {} }) as unknown as GameDefinition;

beforeEach(() => {
  picked.classId = 'c1';
});



describe('HardestQuestions', () => {
  const games = () => [
    fake('monsters', 'Maths Monsters', async () => [row('7 × 8', 2, 10)]),
    fake('gem-keep', 'Gem Keep', async () => [row('6 × 6', 6, 10, { topic: null })]),
    fake('none', 'No Hardest'),
  ];

  it('shows rows with their game names, hardest first', async () => {
    const list = games();
    render(<HardestQuestions games={list} />);
    expect(await screen.findByRole('heading', { name: 'Hardest questions in Room 12' })).toBeInTheDocument();
    const rows = (await screen.findAllByRole('row')).slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('7 × 8Maths MonstersTimes tables20%103');
    expect(rows[1]).toHaveTextContent('6 × 6Gem Keep–60%103');
  });

});
