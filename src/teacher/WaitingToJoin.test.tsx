import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const data = vi.hoisted(() => ({
  fetchWarpRequests: vi.fn(),
  answerWarp: vi.fn(async () => undefined),
}));
vi.mock('../data/classes', async (original) => ({ ...(await original<typeof import('../data/classes')>()), ...data }));
vi.mock('../data/ownName', async (original) => ({
  ...(await original<typeof import('../data/ownName')>()),
  fetchNameRequests: vi.fn(async () => []),
}));

import { NeedsYou, WaitingCount, WaitingToJoinProvider } from './WaitingToJoin';

const kiwi = { id: 'r1', class_id: 'c1', class_name: 'Room 12', group_name: null, student_name: 'Brave Kiwi 7', asked_at: new Date().toISOString() };
const kea = { id: 'r2', class_id: 'c1', class_name: 'Room 12', group_name: 'Kahu', student_name: 'Kind Kea 5', asked_at: new Date().toISOString() };
const tui = { id: 'r3', class_id: 'c9', class_name: 'Room 9', group_name: null, student_name: 'Lucky Tui 12', asked_at: new Date().toISOString() };

function renderBoth(teacher = true) {
  return render(
    <MemoryRouter>
      <WaitingToJoinProvider teacher={teacher}>
        <nav aria-label="Main">
          <a href="/teacher">
            Teacher
            <WaitingCount />
          </a>
        </nav>
        <NeedsYou classId="c1" />
      </WaitingToJoinProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('students waiting to join a class', () => {

  it('lets a student in, then looks again so the nav count drops at once', async () => {
    data.fetchWarpRequests.mockResolvedValueOnce([kiwi, kea]).mockResolvedValue([kea]);
    const user = userEvent.setup();
    renderBoth();
    await user.click(await screen.findByRole('button', { name: 'Yes, let Brave Kiwi 7 in' }));
    expect(data.answerWarp).toHaveBeenCalledWith('r1', true);
    expect(await screen.findByText('Brave Kiwi 7 is in Room 12.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Teacher, 1 waiting to join a class' })).toBeInTheDocument();
  });

  it('points to my other classes with someone waiting, without their names', async () => {
    data.fetchWarpRequests.mockResolvedValue([tui]);
    renderBoth();
    const needs = await screen.findByRole('region', { name: /Needs you/ });
    expect(needs).toHaveTextContent('1 student waiting to join Room 9');
    expect(needs).not.toHaveTextContent('Lucky Tui 12');
    expect(screen.getByRole('link', { name: 'Room 9' })).toHaveAttribute('href', '/teacher/c9');
    expect(screen.queryByRole('button', { name: /Yes/ })).not.toBeInTheDocument();
  });

});
