import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestionSkips } from '../data/questionLog';

const fetchQuestionSkips = vi.fn<(classId: string | null, days: number) => Promise<QuestionSkips>>();
vi.mock('../data/questionLog', () => ({ fetchQuestionSkips: (classId: string | null, days: number) => fetchQuestionSkips(classId, days) }));

const picked = vi.hoisted(() => ({ classId: null as string | null }));
vi.mock('../teacher/TeacherClass', () => ({ useTeacherClass: () => ({ classId: picked.classId, ready: true }) }));

import { QuestionSkipsPanel, spotName } from './TeacherQuestionSkips';

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
  picked.classId = null;
  fetchQuestionSkips.mockReset();
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

  it('changes the time span', async () => {
    fetchQuestionSkips.mockResolvedValue(data);
    render(<QuestionSkipsPanel />);
    await screen.findByText(/questions shown/);
    await userEvent.click(screen.getByRole('radio', { name: 'Today' }));
    expect(fetchQuestionSkips).toHaveBeenLastCalledWith(null, 1);
  });

  it('says so when nothing was shown, or the counts could not be read', async () => {
    fetchQuestionSkips.mockResolvedValueOnce({ students: [], spots: [] });
    const { unmount } = render(<QuestionSkipsPanel />);
    expect(await screen.findByText('No questions shown in this time yet.')).toBeInTheDocument();
    unmount();
    fetchQuestionSkips.mockRejectedValueOnce(new Error('no'));
    render(<QuestionSkipsPanel />);
    expect(await screen.findByText('We couldn’t load the skip counts.')).toBeInTheDocument();
  });

  it('points to the Skip button switch on Today', async () => {
    fetchQuestionSkips.mockResolvedValue(data);
    picked.classId = 'c12';
    render(<QuestionSkipsPanel />, { wrapper: MemoryRouter });
    await screen.findByText(/questions shown/);
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/teacher/c12');
    expect(screen.queryByRole('radio', { name: /^On/ })).not.toBeInTheDocument();
  });

  it('names question kinds', () => {
    expect(spotName('size-it-up')).toBe('Size it up');
    expect(spotName('Pit stop')).toBe('Pit stop');
  });
});
