import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as classes from '../data/classes';
import { ClassWarp } from './ClassWarp';

vi.mock('../data/classes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/classes')>()),
  previewWarp: vi.fn(),
  joinWarp: vi.fn(),
  fetchMyClass: vi.fn(),
  cancelWarpRequest: vi.fn(),
}));

const found = (over: Partial<Extract<classes.WarpPreview, { status: 'found' }>> = {}) =>
  ({ status: 'found', kind: 'class', name: 'Room 12', className: 'Room 12', leaving: null, alreadyIn: false, ask: false, ...over }) as classes.WarpPreview;

function show() {
  return render(
    <MemoryRouter>
      <ClassWarp />
    </MemoryRouter>,
  );
}

async function type(user: ReturnType<typeof userEvent.setup>, code: string) {
  await user.type(screen.getByLabelText('Class code'), code);
  await user.click(screen.getByRole('button', { name: 'Warp!' }));
}

beforeEach(() => {
  vi.mocked(classes.fetchMyClass).mockResolvedValue({ className: null, groupName: null, waitingFor: null });
  vi.mocked(classes.previewWarp).mockReset();
  vi.mocked(classes.joinWarp).mockReset();
  vi.mocked(classes.cancelWarpRequest).mockReset();
});

describe('Class Warp', () => {
  it('shows the class by name, asks to confirm, then warps and welcomes the student', async () => {
    vi.mocked(classes.previewWarp).mockResolvedValue(found());
    vi.mocked(classes.joinWarp).mockResolvedValue({ status: 'joined', name: 'Room 12', className: 'Room 12' });
    const user = userEvent.setup();
    show();
    await type(user, 'km4 tp');
    expect(await screen.findByRole('heading', { name: 'Warp to Room 12?' })).toHaveFocus();
    expect(classes.joinWarp).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Yes, warp!' }));
    expect(classes.joinWarp).toHaveBeenCalledWith('km4 tp');
    expect(await screen.findByRole('heading', { name: 'Welcome to Room 12!' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Let’s play' })).toHaveAttribute('href', '/');
  });
});
