import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const data = vi.hoisted(() => ({
  fetchWarpRequests: vi.fn(),
  answerWarp: vi.fn(async () => undefined),
}));
vi.mock('../data/classes', async (original) => ({ ...(await original<typeof import('../data/classes')>()), ...data }));

import { WaitingCount, WaitingToJoin, WaitingToJoinProvider } from './WaitingToJoin';

const kiwi = { id: 'r1', class_id: 'c1', class_name: 'Room 12', group_name: null, student_name: 'Brave Kiwi 7', asked_at: new Date().toISOString() };
const kea = { id: 'r2', class_id: 'c1', class_name: 'Room 12', group_name: 'Kahu', student_name: 'Kind Kea 5', asked_at: new Date().toISOString() };

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
        <WaitingToJoin />
      </WaitingToJoinProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('students waiting to join a class', () => {
  it('lists them at the top of the teacher page, and counts them in the nav', async () => {
    data.fetchWarpRequests.mockResolvedValue([kiwi, kea]);
    renderBoth();
    expect(await screen.findByRole('region', { name: /Waiting to join a class/ })).toBeInTheDocument();
    expect(screen.getByText(/would like to join Room 12 \(Kahu\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Teacher, 2 waiting to join a class' })).toBeInTheDocument();
  });

  it('lets a student in, then looks again so the nav count drops at once', async () => {
    data.fetchWarpRequests.mockResolvedValueOnce([kiwi, kea]).mockResolvedValue([kea]);
    const user = userEvent.setup();
    renderBoth();
    await user.click(await screen.findByRole('button', { name: 'Yes, let Brave Kiwi 7 in' }));
    expect(data.answerWarp).toHaveBeenCalledWith('r1', true);
    expect(await screen.findByText('Brave Kiwi 7 is in Room 12.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Teacher, 1 waiting to join a class' })).toBeInTheDocument();
  });

  it('turns a student down', async () => {
    data.fetchWarpRequests.mockResolvedValueOnce([kiwi]).mockResolvedValue([]);
    const user = userEvent.setup();
    renderBoth();
    await user.click(await screen.findByRole('button', { name: 'No, keep Brave Kiwi 7 out' }));
    expect(data.answerWarp).toHaveBeenCalledWith('r1', false);
    expect(await screen.findByText('Brave Kiwi 7 was turned down.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Teacher' })).toBeInTheDocument();
  });

  it('shows nothing while nobody is waiting', async () => {
    data.fetchWarpRequests.mockResolvedValue([]);
    renderBoth();
    await vi.waitFor(() => expect(data.fetchWarpRequests).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: /Waiting to join/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Teacher' })).toBeInTheDocument();
  });

  it('never asks the server for a student', async () => {
    renderBoth(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(data.fetchWarpRequests).not.toHaveBeenCalled();
  });
});
