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
  it('asks for the code, and says only that a wrong one did not work', async () => {
    vi.mocked(classes.previewWarp).mockResolvedValue({ status: 'nope' });
    const user = userEvent.setup();
    show();
    expect(screen.getByRole('heading', { name: 'Join your class' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Warp!' })).toBeDisabled();
    await type(user, 'ZZZZZ');
    expect(await screen.findByRole('alert')).toHaveTextContent('That code didn’t work.');
    expect(screen.queryByText(/Room/)).not.toBeInTheDocument();
  });

  it('says to wait a while after too many wrong tries', async () => {
    vi.mocked(classes.previewWarp).mockResolvedValue({ status: 'slow-down' });
    const user = userEvent.setup();
    show();
    await type(user, 'ZZZZZ');
    expect(await screen.findByRole('alert')).toHaveTextContent('Wait a few minutes');
  });

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

  it('asks before leaving another class, and says nothing is lost', async () => {
    vi.mocked(classes.previewWarp).mockResolvedValue(found({ name: 'Room 14', className: 'Room 14', leaving: 'Room 12' }));
    const user = userEvent.setup();
    show();
    await type(user, 'KM4TP');
    expect(await screen.findByRole('heading', { name: 'Leave Room 12 and warp to Room 14?' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing is lost/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'No, stay where I am' }));
    expect(classes.joinWarp).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Join your class' })).toBeInTheDocument();
  });

  it('tells a student a group code brings them into the group and its class', async () => {
    vi.mocked(classes.previewWarp).mockResolvedValue(found({ kind: 'group', name: 'Kea', className: 'Room 12' }));
    const user = userEvent.setup();
    show();
    await type(user, 'KM4TP');
    expect(await screen.findByRole('heading', { name: 'Warp to Kea?' })).toBeInTheDocument();
    expect(screen.getByText(/join the class and the group/)).toBeInTheDocument();
  });

  it('holds the student when the teacher wants to say yes first', async () => {
    vi.mocked(classes.previewWarp).mockResolvedValue(found({ ask: true }));
    vi.mocked(classes.joinWarp).mockResolvedValue({ status: 'waiting', name: 'Room 12' });
    const user = userEvent.setup();
    show();
    await type(user, 'KM4TP');
    expect(await screen.findByText(/Your teacher needs to say yes before you join/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, ask my teacher' }));
    expect(await screen.findByRole('heading', { name: /Now your teacher says yes/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the games' })).toBeInTheDocument();
  });

  it('says they are already in when they type their own class code again', async () => {
    vi.mocked(classes.previewWarp).mockResolvedValue(found({ alreadyIn: true }));
    const user = userEvent.setup();
    show();
    await type(user, 'KM4TP');
    expect(await screen.findByRole('heading', { name: 'You’re already in Room 12' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /warp/i })).not.toBeInTheDocument();
  });

  it('does not call the server for something that cannot be a code', async () => {
    const user = userEvent.setup();
    show();
    await user.type(screen.getByLabelText('Class code'), 'hello');
    await user.click(screen.getByRole('button', { name: 'Warp!' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That code didn’t work.');
  });

  it('shows where the student is now, and a pending request they can cancel', async () => {
    vi.mocked(classes.fetchMyClass).mockResolvedValue({ className: 'Room 12', groupName: 'Kea', waitingFor: 'Room 14' });
    const user = userEvent.setup();
    show();
    expect(await screen.findByText('Room 12, Kea')).toBeInTheDocument();
    expect(screen.getByText(/You asked to join/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel my request' }));
    expect(classes.cancelWarpRequest).toHaveBeenCalled();
  });

  it('lets the student walk away without a class', async () => {
    show();
    expect(screen.getByRole('link', { name: /Not now, back to the games/ })).toHaveAttribute('href', '/');
  });
});
