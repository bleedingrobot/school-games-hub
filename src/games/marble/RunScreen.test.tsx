import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { courseById } from '../../../shared/marble/courses';
import { replay } from '../../../shared/marble/engine';
import { SoundProvider } from '../../sound';
import { RunScreen, type FinishedRun } from './RunScreen';

// three.js can't run in a test, so the picture is a stand-in that just counts draws.
const draws = vi.fn();
vi.mock('./renderer', () => ({
  createView: () => ({ draw: draws, resize: vi.fn(), setLowQuality: vi.fn(), dispose: vi.fn() }),
}));

let frameCallbacks: FrameRequestCallback[] = [];
let now = 0;

/** Runs animation frames, 1/60 s apart, for this many milliseconds. */
async function runFrames(ms: number) {
  for (let t = 0; t < ms; t += 1000 / 60) {
    now += 1000 / 60;
    const callbacks = frameCallbacks;
    frameCallbacks = [];
    await act(async () => callbacks.forEach((cb) => cb(now)));
  }
}

beforeEach(() => {
  frameCallbacks = [];
  now = 0;
  draws.mockClear();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frameCallbacks.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => vi.unstubAllGlobals());

function setup(overrides: Partial<React.ComponentProps<typeof RunScreen>> = {}) {
  const finished: FinishedRun[] = [];
  const props = {
    course: courseById('test-easy')!,
    mode: 'up' as const,
    canTryHard: true,
    onDone: (run: FinishedRun) => (finished.push(run), { isBest: true }),
    onAgain: vi.fn(),
    onHard: vi.fn(),
    onExit: vi.fn(),
    ...overrides,
  };
  render(<SoundProvider><RunScreen {...props} /></SoundProvider>);
  return { props, finished };
}

describe('RunScreen', () => {
  it('waits at "Ready?" until the student starts, then runs the clock', async () => {
    setup();
    await runFrames(50);
    expect(await screen.findByText('Ready?')).toBeInTheDocument();
    expect(screen.getByLabelText('Time').textContent).toBe('0:00.00');
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    await runFrames(500);
    expect(screen.queryByText('Ready?')).toBeNull();
    expect(screen.getByLabelText('Time').textContent).not.toBe('0:00.00');
    expect(draws).toHaveBeenCalled();
  });

  it('finishes the course, shows a medal, and hands over inputs that replay to the same time', async () => {
    const { finished } = setup();
    await runFrames(50);
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    // East on the grid is "right and down" on the screen.
    fireEvent.keyDown(window, { code: 'ArrowDown' });
    await runFrames(8000);
    expect(await screen.findByText('Finished!')).toBeInTheDocument();
    expect(screen.getByText(/Gold/)).toBeInTheDocument();
    expect(screen.getByText(/New personal best/)).toBeInTheDocument();
    expect(finished).toHaveLength(1);
    const run = finished[0];
    expect(run.outcome).toBe('finished');
    const again = replay(courseById('test-easy')!, run.inputs);
    expect(again?.finishSteps).toBe(run.steps);
  });

  it('pauses with P, and the clock stops', async () => {
    setup();
    await runFrames(50);
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ArrowDown' });
    await runFrames(300);
    fireEvent.keyDown(window, { code: 'KeyP' });
    await runFrames(50);
    expect(screen.getByText('Paused')).toBeInTheDocument();
    const frozen = screen.getByLabelText('Time').textContent;
    await runFrames(500);
    expect(screen.getByLabelText('Time').textContent).toBe(frozen);
    fireEvent.click(screen.getByRole('button', { name: 'Keep rolling' }));
    await runFrames(300);
    expect(screen.getByLabelText('Time').textContent).not.toBe(frozen);
  });

  it('start again goes back to ready with the clock at zero', async () => {
    setup();
    await runFrames(50);
    fireEvent.keyDown(window, { code: 'ArrowDown' });
    await runFrames(400);
    fireEvent.keyDown(window, { code: 'KeyR' });
    await runFrames(50);
    expect(screen.getByText('Ready?')).toBeInTheDocument();
    expect(screen.getByLabelText('Time').textContent).toBe('0:00.00');
  });

  it('hard mode counts down, and running out says so', async () => {
    const { finished, props } = setup({ mode: 'down' });
    await runFrames(50);
    expect(screen.getByLabelText('Time left').textContent).toBe('0:15.00');
    fireEvent.keyDown(window, { code: 'ArrowUp' }); // away from the finish, into a wall
    await runFrames(17000);
    expect(await screen.findByText('Out of time')).toBeInTheDocument();
    expect(finished[0].outcome).toBe('timeout');
    expect(screen.queryByRole('button', { name: /hard mode/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Roll again' }));
    expect(props.onAgain).toHaveBeenCalled();
  });

  it('offers hard mode after a finish in count-up', async () => {
    const { props } = setup();
    await runFrames(50);
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ArrowDown' });
    await runFrames(8000);
    fireEvent.click(await screen.findByRole('button', { name: /Try hard mode/ }));
    expect(props.onHard).toHaveBeenCalled();
  });
});
