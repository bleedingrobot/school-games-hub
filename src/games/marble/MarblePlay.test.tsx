import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
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
