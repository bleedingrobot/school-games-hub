import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundProvider } from '../../sound';
import { MarblePlay } from './MarblePlay';

const SETUP = { maths: false, rescue: false, doors: [0], gates: [{ slot: 0, labels: null, arrow: 0, question: null }], pits: [], rescues: [], gems: [], rightGems: [] };
const startRun = vi.fn(async (..._args: unknown[]): Promise<unknown> => ({ seed: 'm1-1792000000-abababababababababababab', stamp: 'stamp', ...SETUP }));
const answerQuestion = vi.fn(async (..._args: unknown[]): Promise<unknown> => ({ right: true, answer: 56 }));
const fetchMarbleSwitches = vi.fn(async (): Promise<{ maths: string; rescue: boolean }> => ({ maths: 'off', rescue: true }));
const flushRuns = vi.fn(async () => true);
const enqueueRun = vi.fn();
const loadServerBests = vi.fn(async (_maths?: boolean): Promise<Record<string, { up?: number; down?: number }> | null> => null);
const loadGhost = vi.fn(async (): Promise<unknown> => null);
const loadBoard = vi.fn(async (): Promise<unknown> => null);
vi.mock('../../data/marble', () => ({
  loadGhost: (...a: unknown[]) => loadGhost(...(a as [])),
  loadBoard: (...a: unknown[]) => loadBoard(...(a as [])),
  startRun: (...a: unknown[]) => startRun(...(a as [])),
  flushRuns: (...a: unknown[]) => flushRuns(...(a as [])),
  enqueueRun: (...a: unknown[]) => enqueueRun(...a),
  loadServerBests: (maths?: boolean) => loadServerBests(maths),
  answerQuestion: (...a: unknown[]) => answerQuestion(...a),
  fetchMarbleSwitches: () => fetchMarbleSwitches(),
}));
vi.mock('../../data/focus', () => ({ fetchMyFocus: async () => ({ source: 'auto', skills: [], onlyThese: false, endsAt: null, canChoose: true, own: null }) }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'student-1' } }) }));

vi.mock('./RunScreen', () => ({
  RunScreen: ({ course, mode, ghost, twoPlayer, setup, readTime, onAnswer, onDone, onExit }: { course: { def: { id: string } }; mode: string; ghost?: { name: string } | null; twoPlayer?: boolean; setup: { maths: boolean; doors: number[] }; readTime?: boolean; onAnswer: (slot: number, answer: number, ms: number) => Promise<unknown>; onDone: (r: unknown) => unknown; onExit: () => void }) => (
    <div>
      <p>Running {course.def.id} in {mode}{ghost ? ` with ghost ${ghost.name}` : ''}{twoPlayer ? ' for two' : ''}{setup.maths ? ' with maths' : ''}</p>
      <p>Doors {setup.doors.join(',')}{readTime ? ' read time' : ''}</p>
      <button onClick={() => onDone({ courseId: course.def.id, mode, outcome: 'finished', steps: 200, falls: 0, checkpoints: 0, inputs: [], maths: setup.maths })}>finish</button>
      <button onClick={() => void onAnswer(3, 56, 900)}>answer</button>
      <button onClick={onExit}>exit</button>
    </div>
  ),
}));

beforeEach(() => {
  localStorage.clear();
  startRun.mockClear();
  flushRuns.mockClear();
  enqueueRun.mockClear();
  loadGhost.mockReset();
  loadGhost.mockResolvedValue(null);
  loadBoard.mockReset();
  loadBoard.mockResolvedValue(null);
  loadServerBests.mockReset();
  loadServerBests.mockResolvedValue(null);
  startRun.mockReset();
  startRun.mockImplementation(async () => ({ seed: 'm1-1792000000-abababababababababababab', stamp: 'stamp', ...SETUP }));
  answerQuestion.mockClear();
  fetchMarbleSwitches.mockReset();
  fetchMarbleSwitches.mockResolvedValue({ maths: 'off', rescue: true });
});
const open = () => render(<SoundProvider><MarblePlay /></SoundProvider>);

describe('course picker', () => {
  it('shows the six New Zealand courses, each with a Did you know card', () => {
    open();
    for (const name of ['Boulder Beach', 'Crown Range Zig-Zag', 'Geyser Valley', 'Glacier Run', 'Windy Welly', 'Alpine Crossing']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.queryAllByText('Coming soon')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Play Boulder Beach' })).toBeInTheDocument();
    expect(screen.getAllByText('Did you know?')).toHaveLength(6);
    expect(screen.getByText(/1,076 metres/)).toBeInTheDocument();
  });

  it('plays a practice course, remembers the best time and then offers hard mode', async () => {
    open();
    const card = screen.getByRole('heading', { name: 'Wide Hill' }).closest('li')!;
    expect(within(card).queryByRole('button', { name: /Hard mode/ })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Play Wide Hill' }));
    expect(await screen.findByText('Running test-easy in up')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'finish' }));
    fireEvent.click(screen.getByRole('button', { name: 'exit' }));
    const after = screen.getByRole('heading', { name: 'Wide Hill' }).closest('li')!;
    expect(within(after).getByText(/Best: 0:03.33/)).toBeInTheDocument();
    fireEvent.click(within(after).getByRole('button', { name: /Hard mode/ }));
    expect(await screen.findByText('Running test-easy in down')).toBeInTheDocument();
  });

  it('asks the server for a stamped seed as a run opens, and sends the finished run to be replayed', async () => {
    open();
    const card = screen.getByRole('heading', { name: 'Boulder Beach' }).closest('li')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Play Boulder Beach' }));
    await screen.findByText('Running boulder-beach in up');
    expect(startRun).toHaveBeenCalledWith('boulder-beach', 'up', false);
    fireEvent.click(screen.getByRole('button', { name: 'finish' }));
    await waitFor(() => expect(enqueueRun).toHaveBeenCalledTimes(1));
    expect(enqueueRun).toHaveBeenCalledWith('student-1', expect.objectContaining({ course: 'boulder-beach', mode: 'up', inputs: '', stamp: 'stamp' }));
    expect(flushRuns).toHaveBeenCalled();
  });

  it('still lets a run be played, and remembered on this device, when the server can’t be reached', async () => {
    startRun.mockResolvedValueOnce(null as never);
    open();
    const card = screen.getByRole('heading', { name: 'Boulder Beach' }).closest('li')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Play Boulder Beach' }));
    await screen.findByText('Running boulder-beach in up');
    fireEvent.click(screen.getByRole('button', { name: 'finish' }));
    fireEvent.click(screen.getByRole('button', { name: 'exit' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(enqueueRun).not.toHaveBeenCalled();
    expect(within(screen.getByRole('heading', { name: 'Boulder Beach' }).closest('li')!).getByText(/Best: 0:03.33/)).toBeInTheDocument();
  });

  it('shows the faster of the server’s best and this device’s', async () => {
    loadServerBests.mockResolvedValue({ 'boulder-beach': { up: 120 } });
    open();
    expect(await screen.findByText(/Best: 0:02.00/)).toBeInTheDocument();
  });

  it('keeps each student’s device copy apart', () => {
    localStorage.setItem('marble-rush-bests-v1:someone-else', '{"boulder-beach":{"up":50}}');
    open();
    expect(screen.queryByText(/Best:/)).toBeNull();
  });

  it('races a ghost chosen from the list, and says so when there is none yet', async () => {
    loadGhost.mockResolvedValueOnce({ name: 'Quick Kea', steps: 900, inputs: '3x60', doors: [] });
    open();
    fireEvent.change(screen.getByLabelText(/Race a ghost/), { target: { value: 'next' } });
    const card = screen.getByRole('heading', { name: 'Boulder Beach' }).closest('li')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Play Boulder Beach' }));
    expect(await screen.findByText('Running boulder-beach in up with ghost Quick Kea')).toBeInTheDocument();
    expect(loadGhost).toHaveBeenCalledWith('boulder-beach', 'up', 'next', false);
    fireEvent.click(screen.getByRole('button', { name: 'exit' }));
    fireEvent.click(within(screen.getByRole('heading', { name: 'Boulder Beach' }).closest('li')!).getByRole('button', { name: 'Play Boulder Beach' }));
    expect(await screen.findByText('Running boulder-beach in up')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'exit' }));
    expect(screen.getByText(/No ghost to race on that course yet/)).toBeInTheDocument();
  });

  it('starts no ghost by default', async () => {
    open();
    fireEvent.click(within(screen.getByRole('heading', { name: 'Boulder Beach' }).closest('li')!).getByRole('button', { name: 'Play Boulder Beach' }));
    await screen.findByText('Running boulder-beach in up');
    expect(loadGhost).not.toHaveBeenCalled();
  });

  it('plays two players on one keyboard without asking for a seed or saving anything', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Two players on Boulder Beach' }));
    expect(await screen.findByText('Running boulder-beach in up for two')).toBeInTheDocument();
    expect(startRun).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'finish' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(enqueueRun).not.toHaveBeenCalled();
  });

  it('shows the class board with word-names and the student’s own place', async () => {
    loadBoard.mockResolvedValue({
      top: [{ rank: 1, name: 'Quick Kea', avatar: null, steps: 900, me: false }, { rank: 2, name: 'Me Moa', avatar: null, steps: 950, me: true }],
      me: { rank: 2, steps: 950 },
      total: 2,
    });
    open();
    const card = screen.getByRole('heading', { name: 'Boulder Beach' }).closest('li')!;
    const details = card.querySelector('details.marble-board') as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    expect(await within(card).findByText('Quick Kea')).toBeInTheDocument();
    expect(within(card).getByText('Me Moa (you)')).toBeInTheDocument();
    expect(loadBoard).toHaveBeenCalledWith('boulder-beach', 'up', false);
    fireEvent.click(within(card).getByRole('button', { name: /Hard mode/ , pressed: false }));
    await waitFor(() => expect(loadBoard).toHaveBeenCalledWith('boulder-beach', 'down', false));
  });
});

describe('maths in the picker and at the start of a run', () => {
  const play = () => fireEvent.click(within(screen.getByRole('heading', { name: 'Boulder Beach' }).closest('li')!).getByRole('button', { name: 'Play Boulder Beach' }));
  const mathsSetup = { seed: 'm1-1792000000-abababababababababababab', stamp: 'stamp', ...SETUP, maths: true, rescue: true, doors: [1], gates: [{ slot: 0, labels: ['54', '56'], arrow: null, question: { slot: 0, parts: ['7', '×', '8', '=', '?'], spoken: 's' } }] };

  it('shows no maths choices when the teacher has maths off', () => {
    open();
    expect(screen.queryByLabelText(/Maths:/)).toBeNull();
    expect(screen.queryByLabelText(/Read time/)).toBeNull();
  });

  it('lets a student choose maths when the teacher allows it, and remembers the choice', async () => {
    fetchMarbleSwitches.mockResolvedValue({ maths: 'choose', rescue: true });
    open();
    const chip = await screen.findByLabelText('Maths: on');
    expect(chip).toBeChecked();
    expect(screen.getByLabelText(/Read time/)).toBeChecked();
    fireEvent.click(chip);
    expect(screen.getByLabelText('Maths: off')).not.toBeChecked();
    expect(screen.queryByLabelText(/Read time/)).toBeNull();
    expect(JSON.parse(localStorage.getItem('marble-rush-prefs-v1:student-1')!)).toMatchObject({ maths: false });
  });

  it('asks for a maths run when the student wants it, and plays with the setup the server sent', async () => {
    fetchMarbleSwitches.mockResolvedValue({ maths: 'choose', rescue: true });
    startRun.mockResolvedValue(mathsSetup);
    open();
    await screen.findByLabelText('Maths: on');
    play();
    expect(await screen.findByText('Running boulder-beach in up with maths')).toBeInTheDocument();
    expect(startRun).toHaveBeenCalledWith('boulder-beach', 'up', true);
    expect(screen.getByText('Doors 1 read time')).toBeInTheDocument();
  });

  it('asks for a plain run when the student turned maths off', async () => {
    fetchMarbleSwitches.mockResolvedValue({ maths: 'choose', rescue: true });
    open();
    fireEvent.click(await screen.findByLabelText('Maths: on'));
    play();
    await screen.findByText('Running boulder-beach in up');
    expect(startRun).toHaveBeenCalledWith('boulder-beach', 'up', false);
  });

  it('asks for maths when the teacher says on for everyone, with no choice', async () => {
    fetchMarbleSwitches.mockResolvedValue({ maths: 'on', rescue: true });
    open();
    expect(await screen.findByText(/Maths is on/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Maths: on')).toBeNull();
    play();
    await screen.findByText('Running boulder-beach in up');
    expect(startRun).toHaveBeenCalledWith('boulder-beach', 'up', true);
  });

  it('keeps times with maths apart from times without', async () => {
    fetchMarbleSwitches.mockResolvedValue({ maths: 'choose', rescue: true });
    startRun.mockResolvedValue(mathsSetup);
    open();
    await screen.findByLabelText('Maths: on');
    play();
    await screen.findByText('Running boulder-beach in up with maths');
    fireEvent.click(screen.getByRole('button', { name: 'finish' }));
    fireEvent.click(screen.getByRole('button', { name: 'exit' }));
    expect(within(screen.getByRole('heading', { name: 'Boulder Beach' }).closest('li')!).getByText(/Best: 0:03.33/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Maths: on'));
    expect(within(screen.getByRole('heading', { name: 'Boulder Beach' }).closest('li')!).getByText('No time yet')).toBeInTheDocument();
    expect(localStorage.getItem('marble-rush-bests-v1-maths:student-1')).toContain('boulder-beach');
    expect(localStorage.getItem('marble-rush-bests-v1:student-1')).toBeNull();
  });

  it('asks for both sets of the server’s bests', async () => {
    open();
    await waitFor(() => expect(loadServerBests).toHaveBeenCalledWith(true));
    expect(loadServerBests).toHaveBeenCalledWith(false);
  });

  it('sends a pit-stop answer to be marked, and says so when the server can’t be reached', async () => {
    startRun.mockResolvedValue({ ...mathsSetup, maths: true });
    fetchMarbleSwitches.mockResolvedValue({ maths: 'on', rescue: true });
    open();
    await screen.findByText(/Maths is on/);
    play();
    await screen.findByText('Running boulder-beach in up with maths');
    fireEvent.click(screen.getByRole('button', { name: 'answer' }));
    await waitFor(() => expect(answerQuestion).toHaveBeenCalledWith(expect.objectContaining({ stamp: 'stamp' }), 'boulder-beach', 'up', 3, 56, 900));
  });

  it('plays on without maths, and says why, when the server can’t be reached', async () => {
    fetchMarbleSwitches.mockResolvedValue({ maths: 'on', rescue: true });
    startRun.mockResolvedValue(null);
    open();
    await screen.findByText(/Maths is on/);
    play();
    await screen.findByText('Running boulder-beach in up');
    fireEvent.click(screen.getByRole('button', { name: 'exit' }));
    expect(screen.getByText(/couldn’t reach the server/)).toBeInTheDocument();
    expect(enqueueRun).not.toHaveBeenCalled();
  });

  it('asks the with-maths board when maths is on, and lets the student switch', async () => {
    fetchMarbleSwitches.mockResolvedValue({ maths: 'choose', rescue: true });
    loadBoard.mockResolvedValue({ top: [], me: null, total: 0 });
    open();
    await screen.findByLabelText('Maths: on');
    const card = screen.getByRole('heading', { name: 'Boulder Beach' }).closest('li')!;
    const details = card.querySelector('details.marble-board') as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    await waitFor(() => expect(loadBoard).toHaveBeenCalledWith('boulder-beach', 'up', true));
    fireEvent.click(within(card).getByRole('button', { name: 'Without maths' }));
    await waitFor(() => expect(loadBoard).toHaveBeenCalledWith('boulder-beach', 'up', false));
  });
});

describe('how to play', () => {
  it('opens its own page with the heading focused, and goes back to the courses', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }));
    const heading = screen.getByRole('heading', { name: 'How to play Marble Rush' });
    expect(heading).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Falling and checkpoints' })).toBeInTheDocument();
    expect(screen.getByText('3 seconds')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Answer gates' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the courses' }));
    expect(screen.getByRole('heading', { name: 'Boulder Beach' })).toBeInTheDocument();
  });

  it('explains the maths when the teacher allows it, with the numbers from the game', async () => {
    fetchMarbleSwitches.mockResolvedValue({ maths: 'choose', rescue: true });
    open();
    await screen.findByLabelText('Maths: on');
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }));
    for (const name of ['Answer gates', 'Pit stops', 'Rescue questions', 'Number gems', 'Guess your time', 'Your maths records']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getByText(/never costs you/)).toBeInTheDocument();
    expect(screen.getByText(/up to 5 a run/)).toBeInTheDocument();
  });
});
