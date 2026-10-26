/**
 * Mine Runner talking to the school's server (the real game, not the phone preview). The server calls are replaced by
 * pretend ones; what's checked is what the screen sends, in what order, and what it does with the replies.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flyLevel } from '../../../shared/mine/bot';
import { makeWorld } from '../../../shared/mine/engine';
import { makeLevel, recipeById } from '../../../shared/mine/level';
import { questionPlan } from '../../../shared/mine/maths';
import type { StartReply } from '../../../shared/mine/maths';
import { AuthContext, type AuthState } from '../../auth/AuthContext';
import { SoundProvider } from '../../sound';
import { MinePlay } from './MinePlay';
import type { MineSession } from './session';

const mocks = vi.hoisted(() => ({
  startRun: vi.fn(),
  answerQuestion: vi.fn(),
  flushRuns: vi.fn(),
  loadServerBests: vi.fn(),
  fetchMineMaths: vi.fn(),
  loadBoard: vi.fn(),
  outcomeOf: vi.fn(),
}));
vi.mock('../../data/mine', async (original) => ({ ...(await original<typeof import('../../data/mine')>()), ...mocks }));

// There is no WebGL in the test browser: the picture is replaced by one that does nothing.
const view = { draw: vi.fn(), resize: vi.fn(), react: vi.fn(), highlight: vi.fn(), stats: () => ({ calls: 0, triangles: 0, pixelRatio: 1 }), setQuality: (n: number) => n, dispose: vi.fn() };
vi.mock('./renderer', () => ({ createView: () => view }));

const pupil = {
  status: 'signed-in', message: null, profile: { id: 'pilot-1', display_name: 'Pilot', role: 'student' },
  signIn: async () => {}, signOut: async () => {}, refreshProfile: async () => {},
} as unknown as AuthState;
const wrap = (ui: React.ReactElement) => (
  <AuthContext.Provider value={pupil}>
    <SoundProvider>{ui}</SoundProvider>
  </AuthContext.Provider>
);
const session = () => (window as unknown as { __mineSession: MineSession }).__mineSession;

/** What the server hands out for a mine with maths: every slot is "2 + 3 = ?" (the pretend server marks 5 as right). */
function startedFor(levelId: string, maths = true): StartReply {
  const plan = questionPlan(makeLevel(recipeById(levelId)!));
  return {
    seed: 'n1-1792000000-abababababababababababab',
    stamp: 'stamp',
    maths,
    questions: maths ? Array.from({ length: plan.total }, (_, slot) => ({ slot, parts: ['2', '+', '3', '=', '?'], spoken: '2 plus 3 equals what?' })) : [],
  };
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/?debug=1');
  Object.values(view).forEach((f) => typeof f === 'function' && 'mockClear' in f && (f as ReturnType<typeof vi.fn>).mockClear());
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.fetchMineMaths.mockResolvedValue('choose');
  mocks.loadServerBests.mockResolvedValue({});
  mocks.flushRuns.mockResolvedValue(true);
  mocks.outcomeOf.mockReturnValue('saved');
  mocks.loadBoard.mockResolvedValue({ top: [{ rank: 1, name: 'Ana', avatar: null, steps: 2700, me: false }, { rank: 2, name: 'Pilot', avatar: null, steps: 3000, me: true }], me: { rank: 2, steps: 3000 }, total: 2 });
  mocks.startRun.mockImplementation(async (level: string, _mode: string, maths: boolean) => ({ ok: true, run: startedFor(level, maths) }));
  mocks.answerQuestion.mockImplementation(async (_s: unknown, _l: string, _m: string, _slot: number, value: number) => ({ correct: value === 5, answer: 5 }));
});
afterEach(() => {
  cleanup();
  delete (window as unknown as { __mineSession?: MineSession }).__mineSession;
});

async function play(name: string) {
  const u = userEvent.setup({ delay: null });
  render(wrap(<MinePlay />));
  await waitFor(() => expect(mocks.fetchMineMaths).toHaveBeenCalled());
  await u.click(screen.getByRole('button', { name: `Play ${name}` }));
  return u;
}
async function inTheMine(name: string) {
  const u = await play(name);
  await waitFor(() => expect(session()).toBeTruthy());
  await waitFor(() => expect(screen.queryByText('Starting the mine…')).toBeNull());
  return u;
}

describe('question doors with the server’s questions', () => {
  async function toTheDoor() {
    const u = await inTheMine('Otago Diggings');
    const s = session();
    const bot = flyLevel(makeWorld(s.world.level, { steady: true }));
    act(() => {
      outer: for (const [code, n] of bot.runs) for (let i = 0; i < n; i++) {
        s.step(code);
        if (s.target()?.kind === 'door') break outer;
      }
    });
    expect(s.target()?.kind).toBe('door');
    return { u, s };
  }

  it('starts a counted dive, shows the server’s question (no trial words), sends the answer, and opens the door on a right one', async () => {
    const { u, s } = await toTheDoor();
    expect(mocks.startRun).toHaveBeenCalledWith('l2', 'steady', true);
    const id = s.target()!.id;
    await u.click(await screen.findByRole('button', { name: /Answer to open the door/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Question door' });
    expect(dialog).not.toHaveTextContent(/Trial question/);
    await u.keyboard('5{Enter}');
    await waitFor(() => expect(s.state.doorsOpen[id]).toBe(1), { timeout: 3000 });
    const plan = questionPlan(s.world.level);
    const first = plan.targets.find((t) => t.id === id)!.first;
    expect(mocks.answerQuestion).toHaveBeenCalledTimes(1);
    const [started, level, mode, slot, value] = mocks.answerQuestion.mock.calls[0];
    expect(started.seed).toMatch(/^n1-/);
    expect([level, mode, slot, value]).toEqual(['l2', 'steady', first, 5]);
    expect(s.state.doorsByAnswer).toBe(1);
  });
});

describe('finishing a counted dive', () => {
  async function finish(levelName: string, maths = true) {
    await inTheMine(levelName);
    const s = session();
    const bot = flyLevel(makeWorld(s.world.level, { steady: true, maths }));
    act(() => {
      for (const [code, n] of bot.runs) for (let i = 0; i < n; i++) s.step(code);
    });
    await screen.findByRole('heading', { name: 'You made it out!' });
  }

  it('queues the run with its seed, stamp, mine, flight and inputs, sends it, and says it is saved', async () => {
    await finish('Greenstone Hollow');
    await waitFor(() => expect(mocks.flushRuns).toHaveBeenCalledWith('pilot-1'));
    const queued = JSON.parse(localStorage.getItem('sgh-mine-queue:pilot-1') ?? '[]')[0];
    expect(queued).toMatchObject({ seed: expect.stringMatching(/^n1-/), stamp: 'stamp', level: 'l1', mode: 'steady', maths: true });
    expect(queued.inputs).toMatch(/^[0-9a-f]+x\d+/);
    expect(await screen.findByText('Your time is saved to the school board.')).toBeInTheDocument();
    expect(screen.getByText('A new best time!')).toBeInTheDocument();
    expect(screen.getByText(/medal/i)).toBeInTheDocument();
  });
});
