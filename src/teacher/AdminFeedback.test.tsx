import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import { teacherRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { FeedbackNote } from '../data/questionFeedback';

const data = vi.hoisted(() => ({ fetchFeedback: vi.fn(), setFeedbackStatus: vi.fn() }));
vi.mock('../data/questionFeedback', async (original) => ({
  ...(await original<typeof import('../data/questionFeedback')>()),
  ...data,
}));
vi.mock('../data/classes', async (original) => ({
  ...(await original<typeof import('../data/classes')>()),
  fetchClasses: vi.fn(async () => [{
    id: 'c9', name: 'Room 9', school_year: 2026, year_level: 5, archived: false, warp_code: 'KM4TP', warp_mode: 'on',
    members: 3, teaching: true, groups: 0, waiting: 0,
  }]),
}));

const note: FeedbackNote = {
  id: 4, at: '2026-11-26T03:00:00Z', game: '#/games/gems · Pit stop', key: 'mul:23x4',
  question: { title: 'Pit stop', parts: ['23', '×', '4', '=', '?'], answer: 92 },
  picture: { kind: 'split-box', tens: 20, ones: 3, by: 4 },
  help: { kind: 'split', title: 'Split 23 into 20 and 3', steps: ['20 × 4 = 80', '3 × 4 = ?'] },
  feedback: 'Box should say 20 and 3', tags: ['picture'], status: 'open', note: '', doneAt: null,
  author: 'Calm Fox 2', authorEmail: 'jr@douglaspark.school.nz',
};

const admin: AuthState = {
  status: 'signed-in',
  profile: { id: 't9', display_name: 'Calm Fox 2', avatar: {}, role: 'teacher', school_admin: true },
  message: null,
  signIn: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
};

beforeEach(() => {
  vi.clearAllMocks();
  data.fetchFeedback.mockResolvedValue([note]);
  data.setFeedbackStatus.mockResolvedValue(undefined);
});

it('lists question feedback with what the pop-up showed, and ticks a note off', async () => {
  const user = userEvent.setup();
  render(
    <AuthContext.Provider value={admin}>
      <MemoryRouter initialEntries={['/teacher/admin/feedback']}>
        <Routes>{teacherRoutes()}</Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  expect(await screen.findByRole('link', { name: 'Question feedback' })).toBeTruthy();
  const item = (await screen.findByText(/Box should say 20 and 3/)).closest('li') as HTMLElement;
  expect(item.textContent).toContain('Box should say 20 and 3');
  expect(item.textContent).toContain('23 × 4 = ?');
  expect(item.textContent).toContain('Answer: 92');
  expect(within(item).getByText('Split 23 into 20 and 3')).toBeTruthy();
  expect(item.querySelector('svg')).not.toBeNull();
  expect(data.fetchFeedback).toHaveBeenCalledWith('open');

  await user.type(within(item).getByRole('textbox'), 'Fixed in #920');
  await user.click(within(item).getByRole('button', { name: 'Fixed' }));
  expect(data.setFeedbackStatus).toHaveBeenCalledWith(4, 'fixed', 'Fixed in #920');

  await user.click(screen.getByRole('button', { name: 'Done' }));
  await vi.waitFor(() => expect(data.fetchFeedback).toHaveBeenLastCalledWith('done'));
});
