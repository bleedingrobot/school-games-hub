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

// Hoisted: the home page loads this module too (Training before games), before the test's own lines run.
const data = vi.hoisted(() => ({
  loadTraining: vi.fn(),
  addAnswer: vi.fn(),
  enqueueStudent: vi.fn(),
  enqueueSession: vi.fn(),
  localFinishedAt: vi.fn(() => null),
  flushQueue: vi.fn(async () => true),
}));
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
    expect(screen.queryByRole('link', { name: /Multiplication and division training/ })).toBeNull();
  });

  it('shows a menu link and a home page card to students once it is on', () => {
    flags.on = true;
    renderAt('/');
    expect(screen.getByRole('link', { name: /Training/ })).toHaveAttribute('href', '/training');
    expect(screen.getByRole('link', { name: /Multiplication and division training/ })).toHaveAttribute('href', '/training');
  });

  it('shows the menu link and card to teachers too', () => {
    flags.on = true;
    renderAt('/', { profile: { ...student.profile!, role: 'teacher' } });
    expect(screen.getByRole('link', { name: /Training/ })).toHaveAttribute('href', '/training');
    expect(screen.getByRole('link', { name: /Multiplication and division training/ })).toBeInTheDocument();
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

  it('opens for teachers as well, with their own records', async () => {
    flags.on = true;
    renderAt('/training', { profile: { ...student.profile!, role: 'teacher' } });
    expect(await screen.findByRole('button', { name: /Today’s session/ })).toBeInTheDocument();
    expect(data.loadTraining).toHaveBeenCalledWith('u1');
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

describe('Quick looks inside Training', () => {
  const settings = { placed: true, startStage: 1 as const, finished: 0 as const, guided: false };

  it('has a Quick looks button next to Today’s session, and a way back', async () => {
    flags.on = true;
    const user = userEvent.setup();
    renderAt('/training');
    expect(await screen.findByRole('button', { name: 'Quick looks' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quick looks' }));
    expect(screen.getByRole('heading', { name: 'Quick looks' })).toBeInTheDocument();
    // Quick looks replaces Training's own page frame rather than sitting inside it: only the hub's main area is left.
    expect(screen.getAllByRole('main')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Back to Training' }));
    expect(screen.getByRole('button', { name: /Today’s session/ })).toBeInTheDocument();
  });

  it('opens straight into Quick looks from the dashboard card, and the card sits next to Training’s', async () => {
    flags.on = true;
    renderAt('/');
    expect(screen.getByRole('link', { name: /Quick looks/ })).toHaveAttribute('href', '/training?quick=1');
    expect(screen.getByRole('link', { name: /Multiplication and division training/ })).toBeInTheDocument();
  });

  it('opens Quick looks first when the address says so', async () => {
    flags.on = true;
    renderAt('/training?quick=1');
    expect(await screen.findByRole('heading', { name: 'Quick looks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Training' })).toBeInTheDocument();
  });

  it('is never shown when Training itself is off', () => {
    renderAt('/training');
    expect(screen.queryByRole('button', { name: 'Quick looks' })).toBeNull();
  });

  it('saves the starting-check result with the student, and an answer as a plain tap with the right key', async () => {
    flags.on = true;
    const user = userEvent.setup();
    data.loadTraining.mockResolvedValue({ state: emptyState(), offline: false, quick: { answers: [], settings: { ...settings, placed: false } } });
    renderAt('/training');
    await user.click(await screen.findByRole('button', { name: 'Quick looks' }));
    // Leave the starting check straight away: nothing was answered, so nothing is saved.
    await user.click(screen.getByRole('button', { name: 'Start with a quick check' }));
    await user.click(await screen.findByRole('button', { name: 'Finish for now' }));
    expect(data.addAnswer).not.toHaveBeenCalled();
    expect(data.enqueueStudent).not.toHaveBeenCalled();
  });

  it('saves a practice answer as a Quick looks answer, with nothing typed and no time', async () => {
    flags.on = true;
    const user = userEvent.setup();
    data.loadTraining.mockResolvedValue({ state: emptyState(), offline: false, quick: { answers: [], settings } });
    renderAt('/training');
    await user.click(await screen.findByRole('button', { name: 'Quick looks' }));
    await user.click(screen.getByRole('button', { name: 'Start looking' }));
    // Get ready, the flash, then the buttons unlock; the right one is whatever the picture holds.
    const n = await waitFor(() => {
      const dots = document.querySelectorAll('.sb-stage svg circle:not(.sb-ghost)').length;
      expect(dots).toBeGreaterThan(0);
      return dots;
    });
    const button = await screen.findByRole('button', { name: String(n) }, { timeout: 4000 });
    await waitFor(() => expect(button).toBeEnabled(), { timeout: 4000 });
    await user.click(button);
    await waitFor(() => expect(data.addAnswer).toHaveBeenCalledTimes(1));
    const [player, saved] = data.addAnswer.mock.calls[0];
    expect(player).toBe('u1');
    expect(saved).toMatchObject({ given: n, ms: 0, typingMs: 0, day: dayString(new Date()), seed: expect.any(Number) });
    expect(saved.key).toMatch(/^sub:(line|clus|angl)-[123]$/);
    // The stage reached is unchanged by one answer, so no settings are sent yet.
    expect(data.enqueueStudent).not.toHaveBeenCalled();
  }, 20_000);

  it('saves the settings with the student when the starting check puts them somewhere', async () => {
    flags.on = true;
    const user = userEvent.setup();
    data.loadTraining.mockResolvedValue({ state: emptyState(), offline: false, quick: { answers: [], settings: { ...settings, placed: false } } });
    renderAt('/training');
    await user.click(await screen.findByRole('button', { name: 'Quick looks' }));
    await user.click(screen.getByLabelText('Keep the picture on the screen (no flashing)'));
    expect(data.enqueueStudent).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ type: 'student', quick: { placed: false, startStage: 1, finished: 0, guided: true }, typing: {} }),
    );
  });
});

// Keeps the type checker honest about what the page is given.
export type _Check = TrainingState;
