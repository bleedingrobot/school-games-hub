import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as classes from '../data/classes';
import { ClassWarpCard } from './ClassWarpCard';

vi.mock('../data/classes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/classes')>()),
  fetchMyClass: vi.fn(),
}));

function show() {
  return render(
    <MemoryRouter>
      <ClassWarpCard />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(classes.fetchMyClass).mockResolvedValue({ className: null, groupName: null, waitingFor: null });
});

describe('the "Join your class" step on the home page', () => {
  it('shows for a student with no class, and links to Class Warp', async () => {
    show();
    expect(await screen.findByRole('link', { name: 'Join' })).toHaveAttribute('href', '/warp');
  });

  it('can be skipped, and stays skipped', async () => {
    const user = userEvent.setup();
    const { unmount } = show();
    await user.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('link', { name: 'Join' })).not.toBeInTheDocument();
    unmount();
    show();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('link', { name: 'Join' })).not.toBeInTheDocument();
  });

  it('is not shown to a student who is already in a class', async () => {
    vi.mocked(classes.fetchMyClass).mockResolvedValue({ className: 'Room 12', groupName: null, waitingFor: null });
    show();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('link', { name: 'Join' })).not.toBeInTheDocument();
  });

  it('is not shown while a student waits for their teacher to say yes', async () => {
    vi.mocked(classes.fetchMyClass).mockResolvedValue({ className: null, groupName: null, waitingFor: 'Room 12' });
    show();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('link', { name: 'Join' })).not.toBeInTheDocument();
  });

  it('shows nothing, and breaks nothing, when the class cannot be loaded or storage is blocked', async () => {
    vi.mocked(classes.fetchMyClass).mockRejectedValue(new Error('down'));
    show();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('link', { name: 'Join' })).not.toBeInTheDocument();
  });
});
