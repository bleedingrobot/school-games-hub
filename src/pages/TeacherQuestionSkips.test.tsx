import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestionSkips } from '../data/questionLog';

const fetchQuestionSkips = vi.fn<(classId: string | null, days: number) => Promise<QuestionSkips>>();
vi.mock('../data/questionLog', () => ({ fetchQuestionSkips: (classId: string | null, days: number) => fetchQuestionSkips(classId, days) }));

const fetchSkipMode = vi.fn<(classId?: string | null) => Promise<string>>();
const saveSkipMode = vi.fn<(mode: string, classId?: string | null) => Promise<void>>();
vi.mock('../data/questionSkips', () => ({
  fetchSkipMode: (classId?: string | null) => fetchSkipMode(classId),
  saveSkipMode: (mode: string, classId?: string | null) => saveSkipMode(mode, classId),
}));

import { QuestionSkipsPanel } from './TeacherQuestionSkips';

const data: QuestionSkips = {
  students: [
    { id: 'a', name: 'Happy Dolphin 11', realName: 'ana.b', shown: 40, answered: 20, skipped: 20, topSkip: { game: 'dragon-maths', spot: 'size-it-up', skipped: 12 } },
    { id: 'b', name: 'Quiet Fox 2', realName: 'ben.c', shown: 30, answered: 29, skipped: 1, topSkip: { game: 'marble', spot: 'Rescue', skipped: 1 } },
  ],
  spots: [
    { game: 'dragon-maths', spot: 'size-it-up', shown: 20, skipped: 12 },
    { game: 'marble', spot: 'Pit stop', shown: 50, skipped: 9 },
  ],
};

beforeEach(() => {
  fetchQuestionSkips.mockReset();
  fetchSkipMode.mockReset().mockResolvedValue('on');
  saveSkipMode.mockReset().mockResolvedValue();
});

describe('Skipped questions panel', () => {
  it('shows the class total, each student most skips first, and marks the high ones', async () => {
    fetchQuestionSkips.mockResolvedValue(data);
    render(<QuestionSkipsPanel />);
    expect(await screen.findByText(/questions shown/)).toHaveTextContent('70 questions shown, 21 skipped (30%).');
    const students = screen.getByRole('table', { name: /Each student/ });
    const rows = within(students).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Happy Dolphin 11ana.b4020 (50%)Size it up, Dragon Maths');
    expect(rows[0]).toHaveAttribute('data-high');
    expect(rows[1]).not.toHaveAttribute('data-high');
    expect(within(screen.getByRole('table', { name: /Each kind/ })).getByText('Pit stop')).toBeInTheDocument();
    expect(fetchQuestionSkips).toHaveBeenCalledWith(null, 7);
  });
});
