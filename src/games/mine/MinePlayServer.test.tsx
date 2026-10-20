/**
 * Mine Runner talking to the school's server (the real game, not the phone preview). The server calls are replaced by
 * pretend ones; what's checked is what the screen sends, in what order, and what it does with the replies.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flyLevel } from '../../../shared/mine/bot';
import { makeWorld } from '../../../shared/mine/engine';
import { makeLevel, recipeById } from '../../../shared/mine/level';
import { questionPlan } from '../../../shared/mine/maths';
import type { StartReply } from '../../../shared/mine/maths';
import { AuthContext, type AuthState } from '../../auth/AuthContext';
import { SoundProvider } from '../../sound';
import { LEVELS } from './levels';
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
  const u = userEvent.setup();
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

describe('the picker for the real game', () => {
  it('offers every mine, the practice mine, and a school board for each', async () => {
    render(wrap(<MinePlay />));
    for (const l of LEVELS) expect(screen.getByRole('button', { name: `Play ${l.name}` })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Play Practice mine' })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: 'School board' })).toHaveLength(LEVELS.length);
    expect(screen.queryByText(/trial questions/i)).toBeNull();
    expect(screen.queryByText(/question server/i)).toBeNull();
  });

  it('shows the pupil’s best from the school’s server, for the way they play', async () => {
    mocks.loadServerBests.mockResolvedValue({ 'l2|maths': 30 * 75, 'l2|plain': 30 * 150 });
    render(wrap(<MinePlay />));
    expect(await screen.findByText('Your best: 1:15.0 (gold medal)')).toBeInTheDocument();
    // Switching maths off shows the best for flights without maths.
    const u = userEvent.setup();
    await u.click(screen.getByRole('checkbox', { name: /Fly with maths questions/ }));
    expect(await screen.findByText('Your best: 2:30.0 (bronze medal)')).toBeInTheDocument();
  });

  it('lets a pupil choose maths only when the teacher lets them', async () => {
    const { unmount } = render(wrap(<MinePlay />));
    expect(await screen.findByRole('checkbox', { name: /Fly with maths questions/ })).toBeChecked();
    unmount();
    mocks.fetchMineMaths.mockResolvedValue('on');
    render(wrap(<MinePlay />));
    expect(await screen.findByText(/Your class flies with maths questions/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Fly with maths questions/ })).toBeNull();
    cleanup();
    mocks.fetchMineMaths.mockResolvedValue('off');
    render(wrap(<MinePlay />));
    expect(await screen.findByText(/switched off for your class/)).toBeInTheDocument();
  });

  it('opens the school board for a mine, in hard mode too, and goes back', async () => {
    const u = userEvent.setup();
    render(wrap(<MinePlay />));
    await u.click(screen.getAllByRole('button', { name: 'School board' })[1]);
    expect(await screen.findByRole('heading', { name: 'Otago Diggings: school board' })).toHaveFocus();
    expect(mocks.loadBoard).toHaveBeenCalledWith('l2', true);
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Pilot (you)')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Without maths' }));
    await waitFor(() => expect(mocks.loadBoard).toHaveBeenLastCalledWith('l2', false));
    await u.click(screen.getByRole('button', { name: 'Back to the mines' }));
    await u.click(screen.getByRole('checkbox', { name: /hard mode/i }));
    await u.click(screen.getAllByRole('button', { name: 'School board' })[2]);
    await waitFor(() => expect(mocks.loadBoard).toHaveBeenLastCalledWith('l3:hard', true));
  });
});

describe('starting a dive', () => {
  it('asks the server to start a counted dive and flies it', async () => {
    await inTheMine('Otago Diggings');
    expect(mocks.startRun).toHaveBeenCalledWith('l2', 'steady', true);
    expect(session().world.maths).toBe(true);
  });

  it('starts hard mode as its own board and a pupil who turned maths off without maths', async () => {
    const u = userEvent.setup();
    render(wrap(<MinePlay />));
    await u.click(await screen.findByRole('checkbox', { name: /Fly with maths questions/ }));
    await u.click(screen.getByRole('checkbox', { name: /hard mode/i }));
    await u.click(screen.getByRole('button', { name: 'Play Greenstone Hollow (hard)' }));
    await waitFor(() => expect(mocks.startRun).toHaveBeenCalledWith('l1:hard', 'steady', false));
    await waitFor(() => expect(session()).toBeTruthy());
    expect(session().world.maths).toBe(false);
  });

  it('never asks the server to start the practice mine', async () => {
    await inTheMine('Practice mine');
    expect(mocks.startRun).not.toHaveBeenCalled();
  });

  it('follows the teacher if the maths switch changed since the page loaded', async () => {
    mocks.startRun.mockImplementationOnce(async () => ({ ok: false, reason: 'maths-off', message: 'Maths is switched off for your class.' }));
    await inTheMine('Otago Diggings');
    expect(mocks.startRun).toHaveBeenNthCalledWith(1, 'l2', 'steady', true);
    expect(mocks.startRun).toHaveBeenNthCalledWith(2, 'l2', 'steady', false);
    expect(session().world.maths).toBe(false);
  });

  it('says so, and stays on the picker, when it’s time for a break', async () => {
    mocks.startRun.mockResolvedValue({ ok: false, reason: 'too-many', message: 'That’s a lot of mining today! Have a break and come back tomorrow.' });
    await play('Otago Diggings');
    expect(await screen.findByRole('alert')).toHaveTextContent(/lot of mining today/);
    expect(screen.queryByRole('button', { name: /Fly it as practice/ })).toBeNull();
    expect(session()).toBeUndefined();
  });

  it('says so, and offers nothing to count, when the teacher has switched the game off for the class', async () => {
    mocks.startRun.mockResolvedValue({ ok: false, reason: 'game-off', message: 'Mine Runner is not switched on for your class.' });
    await play('Otago Diggings');
    expect(await screen.findByRole('alert')).toHaveTextContent(/not switched on/);
    expect(screen.queryByRole('button', { name: /Fly it as practice/ })).toBeNull();
    expect(session()).toBeUndefined();
  });

  it('offers practice, which counts for nothing, when the server can’t be reached', async () => {
    mocks.startRun.mockResolvedValue({ ok: false, reason: 'offline', message: 'The school server could not be reached, so this dive won’t count.' });
    const u = await play('Otago Diggings');
    expect(await screen.findByRole('alert')).toHaveTextContent(/won’t count/);
    await u.click(screen.getByRole('button', { name: /Fly it as practice/ }));
    await waitFor(() => expect(session()).toBeTruthy());
    // No questions: the question door starts open.
    expect(session().world.maths).toBe(false);
    const door = session().world.level.doors.find((d) => d.kind === 'question')!;
    expect(session().state.doorsOpen[door.id]).toBe(1);
    // Finishing it sends nothing.
    const bot = flyLevel(makeWorld(session().world.level, { steady: true, maths: false }));
    act(() => {
      for (const [code, n] of bot.runs) for (let i = 0; i < n; i++) session().step(code);
    });
    expect(await screen.findByText(/practice only, so it was not saved/)).toBeInTheDocument();
    expect(mocks.flushRuns).not.toHaveBeenCalled();
    expect(localStorage.getItem('sgh-mine-queue:pilot-1')).toBeNull();
  });
});

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

  it('shows the server’s question (no trial words), sends the answer, and opens the door on a right one', async () => {
    const { u, s } = await toTheDoor();
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
    expect(s.state.badGrants).toBe(0);
  });

  it('a wrong answer shows the whole fact, costs shield and time, and the next try is a new question', async () => {
    const { u, s } = await toTheDoor();
    const id = s.target()!.id;
    const first = questionPlan(s.world.level).targets.find((t) => t.id === id)!.first;
    const shield = s.state.shield;
    fireEvent.keyDown(window, { code: 'Enter' });
    await screen.findByRole('dialog', { name: 'Question door' });
    await u.keyboard('4{Enter}');
    expect(await screen.findByText('2 + 3 = 5')).toBeInTheDocument();
    await waitFor(() => expect(s.state.wrongAnswers).toBe(1), { timeout: 4000 });
    expect(s.state.doorsOpen[id]).toBe(0);
    expect(s.state.shield).toBeLessThan(shield);
    // The next time the door is tried it is the next question for that door.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Question door' })).toBeNull());
    fireEvent.keyDown(window, { code: 'Enter' });
    await screen.findByRole('dialog', { name: 'Question door' });
    await u.keyboard('5{Enter}');
    await waitFor(() => expect(s.state.doorsOpen[id]).toBe(1), { timeout: 3000 });
    expect(mocks.answerQuestion.mock.calls.map((c) => c[3])).toEqual([first, first + 1]);
  });

  it('leaving a question without answering uses nothing up', async () => {
    const { s } = await toTheDoor();
    fireEvent.keyDown(window, { code: 'Enter' });
    const dialog = await screen.findByRole('dialog', { name: 'Question door' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Question door' })).toBeNull());
    expect(mocks.answerQuestion).not.toHaveBeenCalled();
    expect(s.state.wrongAnswers).toBe(0);
  });

  it('does not open a door if the server can’t be reached, lets the pupil try again, and sends the same answer', async () => {
    const { u, s } = await toTheDoor();
    const id = s.target()!.id;
    mocks.answerQuestion.mockRejectedValueOnce(new Error('We couldn’t reach the school’s server. Check your Wi-Fi and try that one again.'));
    fireEvent.keyDown(window, { code: 'Enter' });
    await screen.findByRole('dialog', { name: 'Question door' });
    await u.keyboard('5{Enter}');
    expect(await screen.findByText(/couldn’t reach the school’s server/)).toBeInTheDocument();
    expect(s.state.doorsOpen[id]).toBe(0);
    // Typing something else on the retry still sends the answer that was first sent.
    await u.keyboard('{Backspace}7{Enter}');
    await waitFor(() => expect(s.state.doorsOpen[id]).toBe(1), { timeout: 3000 });
    expect(mocks.answerQuestion.mock.calls.map((c) => c[4])).toEqual([5, 5]);
  });

  it('says when a door has no more questions', async () => {
    const { u, s } = await toTheDoor();
    mocks.answerQuestion.mockImplementation(async () => ({ correct: false, answer: 5 }));
    const id = s.target()!.id;
    const count = questionPlan(s.world.level).targets.find((t) => t.id === id)!.count;
    for (let i = 0; i < count; i++) {
      fireEvent.keyDown(window, { code: 'Enter' });
      await screen.findByRole('dialog', { name: 'Question door' });
      await u.keyboard('4{Enter}');
      await waitFor(() => expect(s.state.wrongAnswers).toBe(i + 1), { timeout: 4000 });
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Question door' })).toBeNull());
    }
    fireEvent.keyDown(window, { code: 'Enter' });
    expect(await screen.findByText(/no more questions/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Question door' })).toBeNull();
  });
});

describe('finishing a counted dive', () => {
  async function finish(levelName: string, id: string, maths = true) {
    const u = await inTheMine(levelName);
    const s = session();
    const bot = flyLevel(makeWorld(s.world.level, { steady: true, maths }));
    act(() => {
      for (const [code, n] of bot.runs) for (let i = 0; i < n; i++) s.step(code);
    });
    await screen.findByRole('heading', { name: 'You made it out!' });
    return { u, s, bot, id };
  }

  it('queues the run with its seed, stamp, mine, flight and inputs, sends it, and says it is saved', async () => {
    await finish('Greenstone Hollow', 'l1');
    await waitFor(() => expect(mocks.flushRuns).toHaveBeenCalledWith('pilot-1'));
    const queued = JSON.parse(localStorage.getItem('sgh-mine-queue:pilot-1') ?? '[]')[0];
    expect(queued).toMatchObject({ seed: expect.stringMatching(/^n1-/), stamp: 'stamp', level: 'l1', mode: 'steady', maths: true });
    expect(queued.inputs).toMatch(/^[0-9a-f]+x\d+/);
    expect(await screen.findByText('Your time is saved to the school board.')).toBeInTheDocument();
    expect(screen.getByText('A new best time!')).toBeInTheDocument();
    expect(screen.getByText(/medal/i)).toBeInTheDocument();
  });

  it('says when the time is waiting to be sent, and when a break is needed', async () => {
    mocks.outcomeOf.mockReturnValue('waiting');
    await finish('Greenstone Hollow', 'l1');
    expect(await screen.findByText(/kept on this device and will be sent/)).toBeInTheDocument();
    cleanup();
    localStorage.clear();
    mocks.outcomeOf.mockReturnValue('break');
    await finish('Greenstone Hollow', 'l1');
    expect(await screen.findByText(/Have a break/)).toBeInTheDocument();
  });

  it('is not a new best when the server already has a faster time', async () => {
    mocks.loadServerBests.mockResolvedValue({ 'l1|maths': 30 });
    render(wrap(<MinePlay />));
    await waitFor(() => expect(mocks.loadServerBests).toHaveBeenCalled());
    cleanup();
    await finish('Greenstone Hollow', 'l1');
    expect(screen.queryByText('A new best time!')).toBeNull();
    expect(await screen.findByText('Your best here: 0:01.0')).toBeInTheDocument();
  });

  it('starts a fresh server run for “Fly it again” (a new seed each time)', async () => {
    const { u } = await finish('Greenstone Hollow', 'l1');
    const old = session();
    await u.click(screen.getByRole('button', { name: 'Fly it again' }));
    await waitFor(() => expect(session()).not.toBe(old));
    expect(mocks.startRun).toHaveBeenCalledTimes(2);
  });

  it('goes on to the next mine with its own start', async () => {
    const { u } = await finish('Greenstone Hollow', 'l1');
    await u.click(screen.getByRole('button', { name: 'Next mine' }));
    await waitFor(() => expect(mocks.startRun).toHaveBeenLastCalledWith('l2', 'steady', true));
  });
});

describe('a run waiting to be sent', () => {
  it('is sent when the pupil opens the game, and the times are loaded again', async () => {
    localStorage.setItem('sgh-mine-queue:pilot-1', JSON.stringify([{ seed: 'n1-1792000000-abababababababababababab', stamp: 's', level: 'l1', mode: 'steady', maths: true, inputs: '1x1' }]));
    render(wrap(<MinePlay />));
    await waitFor(() => expect(mocks.flushRuns).toHaveBeenCalledWith('pilot-1'));
    await waitFor(() => expect(mocks.loadServerBests).toHaveBeenCalled());
  });
});
