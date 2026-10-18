import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundProvider } from '../../sound';
import { MarblePlay } from './MarblePlay';

const startRun = vi.fn(async () => ({ seed: 'm1-1792000000-abababababababababababab', stamp: 'stamp' }));
const flushRuns = vi.fn(async () => true);
const enqueueRun = vi.fn();
const loadServerBests = vi.fn(async (): Promise<Record<string, { up?: number; down?: number }> | null> => null);
vi.mock('../../data/marble', () => ({
  startRun: (...a: unknown[]) => startRun(...(a as [])),
  flushRuns: (...a: unknown[]) => flushRuns(...(a as [])),
  enqueueRun: (...a: unknown[]) => enqueueRun(...a),
  loadServerBests: () => loadServerBests(),
}));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'student-1' } }) }));

vi.mock('./RunScreen', () => ({
  RunScreen: ({ course, mode, onDone, onExit }: { course: { def: { id: string } }; mode: string; onDone: (r: unknown) => unknown; onExit: () => void }) => (
    <div>
      <p>Running {course.def.id} in {mode}</p>
      <button onClick={() => onDone({ courseId: course.def.id, mode, outcome: 'finished', steps: 200, falls: 0, checkpoints: 0, inputs: [] })}>finish</button>
      <button onClick={onExit}>exit</button>
    </div>
  ),
}));

beforeEach(() => {
  localStorage.clear();
  startRun.mockClear();
  flushRuns.mockClear();
  enqueueRun.mockClear();
  loadServerBests.mockReset();
  loadServerBests.mockResolvedValue(null);
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
    expect(startRun).toHaveBeenCalledWith('boulder-beach', 'up');
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
});
