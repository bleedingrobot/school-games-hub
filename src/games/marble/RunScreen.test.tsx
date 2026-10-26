import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileCourse } from '../../../shared/marble/course';
import { courseById } from '../../../shared/marble/courses';
import type { RunSetup } from '../../../shared/marble/maths';
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
});

// A short straight with a pit stop two tiles in, and an answer gate whose sign is close to the start.
const GATED = compileCourse({
  id: 'tiny-gated', name: 'Tiny gated',
  rows: ['===============', '=s#cc###f======', '===============', '=======AB======'],
  heights: Array(4).fill('222222222222222'),
  route: [], medals: { gold: 2, silver: 4, bronze: 8 }, hardSeconds: 30,
  gates: [{ sign: [2, 1], after: 0, tunnels: [
    { cells: [[5, 1]], door: 0, route: [[5.5, 1.5], [6.5, 1.5], [6.5, 1.5]], dead: [] },
    { cells: [[6, 1]], door: 1, route: [[6.5, 1.5], [7.5, 1.5], [7.5, 1.5]], dead: [] },
  ] }],
});
const q = (slot: number, parts: string[]) => ({ slot, parts, spoken: parts.join(' ') });
const MATHS: RunSetup = {
  maths: true, rescue: false, doors: [0],
  gates: [{ slot: 0, labels: ['54', '56'], arrow: null, question: q(0, ['7', '×', '8', '=', '?']) }],
  pits: [q(1, ['3', '×', '4', '=', '?'])], rescues: [], gems: [], rightGems: [],
};

describe('RunScreen with maths', () => {
  const start = async () => {
    await runFrames(50);
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ArrowDown' });
  };

  it('stops at a pit stop for a question; a right answer is sent to be marked and takes two seconds off', async () => {
    const answers: unknown[][] = [];
    const onAnswer = vi.fn(async (...a: unknown[]) => {
      answers.push(a);
      return { right: true, answer: 12 };
    });
    setup({ course: GATED, setup: MATHS, readTime: false, onAnswer: onAnswer as never });
    await start();
    await runFrames(1500);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Pit stop');
    const frozen = screen.getByLabelText('Time').textContent;
    await runFrames(800);
    expect(screen.getByLabelText('Time').textContent).toBe(frozen);
    fireEvent.keyDown(dialog, { key: '1' });
    fireEvent.keyDown(dialog, { key: '2' });
    fireEvent.keyDown(dialog, { key: 'Enter' });
    await runFrames(100);
    await waitFor(() => expect(onAnswer).toHaveBeenCalled());
    expect(answers[0].slice(0, 2)).toEqual([1, 12]);
    await runFrames(1500);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.querySelector('.marble-toast')).toHaveTextContent('Right! 2 seconds off your time');
  });
});
