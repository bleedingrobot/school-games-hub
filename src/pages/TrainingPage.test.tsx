import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FACT_BY_KEY } from '../../shared/training/facts';
import { dayString, emptyState, type TrainingState } from '../../shared/training/records';
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

// Where the student is on the maths ladder (the warm-up decides where Training starts).
const ladder = vi.hoisted(() => ({ fetchMyLadder: vi.fn() }));
vi.mock('../data/ladder', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/ladder')>()),
  fetchMyLadder: ladder.fetchMyLadder,
}));

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
  ladder.fetchMyLadder.mockReset().mockRejectedValue(new Error('no ladder'));
});

describe('Training is hidden until it is switched on', () => {
  it('has no page, link or card while the switch is off', () => {
    renderAt('/training');
    expect(screen.getByText('Oops, wrong square!')).toBeInTheDocument();
    expect(screen.queryByText(/Today’s session/)).toBeNull();
    expect(data.loadTraining).not.toHaveBeenCalled();
  });
});

describe('the Training page', () => {

  it('saves each answer, and the typing check times and sessions count, as the student goes', async () => {
    flags.on = true;
    const user = userEvent.setup();
    renderAt('/training');
    await user.click(await screen.findByRole('button', { name: /Today’s session/ }));
    // The typing check: the first time, a practice number (not timed), then three numbers to type. Each step is a new question element.
    expect(await screen.findByText(/This one is just for practice/)).toBeInTheDocument();
    let previous: Element | null = null;
    for (let i = 0; i < 4; i++) {
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
    // The practice number isn't one of them: one time for each length.
    expect(Object.values(typing).map((t) => (t as number[]).length)).toEqual([1, 1, 1]);

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
