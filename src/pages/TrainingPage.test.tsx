import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FACT_BY_KEY } from '../../shared/training/facts';
import { dayString, emptyState, recordAnswer, type TrainingState } from '../../shared/training/records';
import { AppRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { SoundProvider } from '../sound';

const flags = { on: false };
vi.mock('../training/switch', () => ({ trainingOn: () => flags.on }));

const data = {
  loadTraining: vi.fn(),
  addAnswer: vi.fn(),
  enqueueStudent: vi.fn(),
  flushQueue: vi.fn(async () => true),
};
vi.mock('../data/training', () => data);

// The dashboard asks for its own things; nothing here is about them.
vi.mock('../data/botGames', () => ({
  fetchRecentGames: vi.fn(async () => []),
  fetchMyStats: vi.fn(async () => []),
  saveBotGame: vi.fn(async () => {}),
  saveAbandonedGame: vi.fn(),
  refreshSaveToken: vi.fn(async () => {}),
}));
vi.mock('../data/multiplayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/multiplayer')>()),
  fetchRecentFriendGames: vi.fn(async () => []),
  fetchFriendStats: vi.fn(async () => []),
  fetchMyOpenGames: vi.fn(async () => []),
  fetchPlayerCards: vi.fn(async () => new Map()),
  fetchLobby: vi.fn(async () => []),
  fetchMultiplayerEnabled: vi.fn(async () => true),
}));
vi.mock('../data/progress', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/progress')>()),
  fetchMyProgress: vi.fn(async () => null),
}));

const student: AuthState = {
  status: 'signed-in',
  profile: { id: 'u1', display_name: 'Speedy Otter 27', avatar: {}, role: 'student' },
  message: null,
  signIn: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
};

function renderAt(path: string, auth: Partial<AuthState> = {}) {
  return render(
    <SoundProvider>
      <AuthContext.Provider value={{ ...student, ...auth }}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundProvider>,
  );
}

// The page loads on demand; load it once up front so no test waits on that.
beforeAll(async () => {
  await import('./TrainingPage');
});

/** Lets the screen finish appearing: answer keys are ignored until then. */
const shown = () => act(async () => void (await new Promise((r) => setTimeout(r, 80))));

beforeEach(() => {
  flags.on = false;
  Object.values(data).forEach((f) => f.mockClear());
  data.loadTraining.mockResolvedValue({ state: emptyState(), offline: false });
  data.flushQueue.mockResolvedValue(true);
});

describe('Training is hidden until it is switched on', () => {
  it('has no page, link or card while the switch is off', () => {
    renderAt('/training');
    expect(screen.getByText('Oops, wrong square!')).toBeInTheDocument();
    expect(screen.queryByText(/Today’s session/)).toBeNull();
    expect(data.loadTraining).not.toHaveBeenCalled();
  });

  it('has no link on the home page or in the menu while the switch is off', () => {
    renderAt('/');
    expect(screen.queryByRole('link', { name: /Training/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Facts training/ })).toBeNull();
  });

  it('shows a menu link and a home page card to students once it is on', () => {
    flags.on = true;
    renderAt('/');
    expect(screen.getByRole('link', { name: /Training/ })).toHaveAttribute('href', '/training');
    expect(screen.getByRole('link', { name: /Facts training/ })).toHaveAttribute('href', '/training');
  });

  it('shows no link to teachers', () => {
    flags.on = true;
    renderAt('/', { profile: { ...student.profile!, role: 'teacher' } });
    expect(screen.queryByRole('link', { name: /Training/ })).toBeNull();
  });
});

describe('the Training page', () => {
  it('opens on the student’s saved records, with the this-week line', async () => {
    flags.on = true;
    const today = dayString(new Date());
    // A fact that turned bright green today (1 s thinking time after the default typing time comes off).
    const state = recordAnswer(emptyState(), 'mul:2x5', 10, 10, 1500, today).state;
    data.loadTraining.mockResolvedValue({ state, offline: false });
    renderAt('/training');
    expect(await screen.findByRole('button', { name: /Today’s session/ })).toBeInTheDocument();
    expect(data.loadTraining).toHaveBeenCalledWith('u1');
    expect(screen.getByText('1 fact turned green this week!')).toBeInTheDocument();
  });

  it('shows a kind line when nothing has turned green yet', async () => {
    flags.on = true;
    renderAt('/training');
    expect(await screen.findByText('Every day you practise makes your facts stronger.')).toBeInTheDocument();
  });

  it('says when it is offline, and still lets the student practise', async () => {
    flags.on = true;
    data.loadTraining.mockResolvedValue({ state: emptyState(), offline: true });
    renderAt('/training');
    expect(await screen.findByText(/can’t reach the internet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Today’s session/ })).toBeEnabled();
  });

  it('is for students only', async () => {
    flags.on = true;
    renderAt('/training', { profile: { ...student.profile!, role: 'teacher' } });
    expect(await screen.findByText(/Training is for students/)).toBeInTheDocument();
    expect(data.loadTraining).not.toHaveBeenCalled();
  });

  it('says so kindly when it can’t open', async () => {
    flags.on = true;
    data.loadTraining.mockRejectedValue(new Error('boom'));
    renderAt('/training');
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t open Training/);
  });

  it('saves each answer, and the typing check times and sessions count, as the student goes', async () => {
    flags.on = true;
    const user = userEvent.setup();
    renderAt('/training');
    await user.click(await screen.findByRole('button', { name: /Today’s session/ }));
    // The typing check: three numbers to type. Each step is a new question element.
    let previous: Element | null = null;
    for (let i = 0; i < 3; i++) {
      const node = await waitFor(() => {
        const q = document.querySelector('.tr-question');
        expect(q).not.toBeNull();
        expect(q).not.toBe(previous);
        expect(q!.textContent).toMatch(/^\d+$/);
        return q!;
      });
      await shown(); // the keys wait for the screen to be shown
      await user.keyboard(node.textContent!);
      previous = node;
    }
    expect(data.enqueueStudent).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'student', autoSubmit: true }));
    const typing = data.enqueueStudent.mock.calls.at(-1)![1].typing;
    expect(Object.keys(typing).sort()).toEqual(['1', '2', '3']);

    // The first real question: answer it right.
    const question = await screen.findByText(/= \?$/);
    const [a, op, b] = question.textContent!.replace(' = ?', '').split(' ');
    const answer = op === '×' ? Number(a) * Number(b) : Number(a) / Number(b);
    await shown();
    await user.keyboard(String(answer));
    await waitFor(() => expect(data.addAnswer).toHaveBeenCalledTimes(1));
    const [player, saved] = data.addAnswer.mock.calls[0];
    expect(player).toBe('u1');
    const fact = FACT_BY_KEY.get(saved.key)!;
    expect(saved).toMatchObject({ given: answer, day: dayString(new Date()), typingMs: expect.any(Number), seed: expect.any(Number) });
    expect(fact.answer).toBe(answer);
    expect(Number.isInteger(saved.ms) && saved.ms >= 0).toBe(true);
    expect(Number.isInteger(saved.typingMs)).toBe(true);
  });
});

// Keeps the type checker honest about what the page is given.
export type _Check = TrainingState;
