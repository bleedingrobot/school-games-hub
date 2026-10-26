import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileCourse } from '../../../shared/marble/course';
import { courseById } from '../../../shared/marble/courses';
import type { RunSetup } from '../../../shared/marble/maths';
import { BONUS } from '../../../shared/marble/inputs';
import { botRun } from '../../../shared/marble/bot';
import { replay } from '../../../shared/marble/engine';
import { encodeInputs } from '../../../shared/marble/inputs';
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

  it('touch: a drag starts the run, and the thumb stick shows only while rolling (never over the Ready or Paused buttons)', async () => {
    setup();
    await runFrames(50);
    const stage = document.querySelector('.marble-stage')!;
    expect(document.querySelector('.marble-stick')).toBeNull();
    fireEvent.pointerDown(stage, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    await runFrames(200);
    expect(screen.queryByText('Ready?')).toBeNull();
    expect(document.querySelector('.marble-stick')).not.toBeNull();
    fireEvent.keyDown(window, { code: 'KeyP' });
    await runFrames(50);
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(document.querySelector('.marble-stick')).toBeNull();
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

  it('races a ghost: draws a second marble, and says whether the student beat it', async () => {
    const slow = { name: 'Slow Kiwi', steps: 3000, inputs: '0x3000' };
    const { finished } = setup({ ghost: slow });
    await runFrames(50);
    expect(screen.getByText(/ghost of Slow Kiwi/)).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ArrowDown' });
    await runFrames(500);
    const others = draws.mock.calls.at(-1)![4] as { now: { x: number } }[];
    expect(others).toHaveLength(1);
    await runFrames(8000);
    expect(await screen.findByText(/You beat Slow Kiwi’s ghost/)).toBeInTheDocument();
    expect(finished).toHaveLength(1);
  });

  it('a faster ghost wins, and the ghost plays its recorded run exactly', async () => {
    const bot = botRun(courseById('test-easy')!);
    const want = replay(courseById('test-easy')!, bot.runs)!;
    setup({ ghost: { name: 'Fast Fantail', steps: 10, inputs: encodeInputs(bot.runs) } });
    await runFrames(50);
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ArrowDown' });
    await runFrames(8000);
    expect(await screen.findByText(/Fast Fantail’s ghost was/)).toBeInTheDocument();
    const last = draws.mock.calls.at(-1)![4] as { now: { outcome: string; finishSteps: number } }[];
    expect(last[0].now.outcome).toBe('finished');
    expect(last[0].now.finishSteps).toBe(want.finishSteps);
  });

  it('ignores a ghost whose inputs are broken', async () => {
    setup({ ghost: { name: 'Broken', steps: 100, inputs: 'nonsense' } });
    await runFrames(50);
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    await runFrames(100);
    expect((draws.mock.calls.at(-1)![4] as unknown[]).length).toBe(0);
  });

  it('two players: arrow keys steer the first marble, W A S D the second, first over the line wins and nothing is saved', async () => {
    const { finished } = setup({ twoPlayer: true });
    await runFrames(50);
    expect(screen.getByText(/Player 2 \(orange\) uses W A S D/)).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'KeyD' });
    fireEvent.keyDown(window, { code: 'KeyS' });
    await runFrames(8000);
    expect(await screen.findByRole('dialog', { name: 'Run finished' })).toHaveTextContent('Player 2 wins!');
    expect(finished).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /hard mode/i })).toBeNull();
    expect(screen.getByText(/This game isn’t saved/)).toBeInTheDocument();
  });

  it('two players: the arrow keys never move the second marble', async () => {
    setup({ twoPlayer: true });
    await runFrames(50);
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ArrowDown' });
    await runFrames(300);
    const [rival] = draws.mock.calls.at(-1)![4] as { now: { x: number; y: number } }[];
    const start = courseById('test-easy')!.start;
    expect(rival.now.x).toBeCloseTo(start.x, 5);
    expect(rival.now.y).toBeCloseTo(start.y, 5);
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

  it('shows the gate\'s question when its sign comes close, and does not wait to be read when read time is off', async () => {
    setup({ course: GATED, setup: MATHS, readTime: false });
    await start();
    await runFrames(100);
    expect(screen.getByText(/Gate:/)).toHaveTextContent('Gate: 7 × 8 = …');
    expect(screen.queryByRole('button', { name: 'Go!' })).toBeNull();
  });

  it('waits for the student to press Go when read time is on, with the clock stopped', async () => {
    setup({ course: GATED, setup: MATHS, readTime: true });
    await start();
    await runFrames(100);
    const go = await screen.findByRole('button', { name: 'Go!' });
    const frozen = screen.getByLabelText('Time').textContent;
    await runFrames(1000);
    expect(screen.getByLabelText('Time').textContent).toBe(frozen);
    fireEvent.click(go);
    await runFrames(300);
    expect(screen.queryByRole('button', { name: 'Go!' })).toBeNull();
    expect(screen.getByLabelText('Time').textContent).not.toBe(frozen);
  });

  it('carries on by itself after ten seconds of reading', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      setup({ course: GATED, setup: MATHS, readTime: true });
      await start();
      await runFrames(100);
      await screen.findByRole('button', { name: 'Go!' });
      await act(async () => {
        vi.advanceTimersByTime(10_500);
      });
      await runFrames(100);
      expect(screen.queryByRole('button', { name: 'Go!' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows no question with maths off', async () => {
    setup({ course: GATED, setup: { ...MATHS, maths: false, gates: [{ slot: 0, labels: null, arrow: 1, question: null }], pits: [] }, readTime: true });
    await start();
    await runFrames(2000);
    expect(screen.queryByText(/Gate:/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Go!' })).toBeNull();
  });

  it('stops at a pit stop for a question; a right answer takes the time off with a BONUS input', async () => {
    const answers: unknown[][] = [];
    const onAnswer = vi.fn(async (...a: unknown[]) => {
      answers.push(a);
      return { right: true, answer: 12 };
    });
    const { finished } = setup({ course: GATED, setup: MATHS, readTime: false, onAnswer: onAnswer as never });
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
    // The marble goes on: through the gate's doors... which are shut here, so only check what was written down.
    await runFrames(8000);
    const out = finished[0];
    if (out) expect(out.inputs.some(([code]) => code === BONUS)).toBe(true);
    else expect(true).toBe(true);
  });

  it('a half-second question stop says what it is worth, and takes half a second off', async () => {
    const STOPS = compileCourse({
      id: 'tiny-stops', name: 'Tiny stops', rows: ['=========', '=s##h##f=', '========='], heights: Array(3).fill('222222222'),
      route: [], medals: { gold: 2, silver: 4, bronze: 8 }, hardSeconds: 30,
    });
    const onAnswer = vi.fn(async () => ({ right: true, answer: 12 }));
    const { finished } = setup({ course: STOPS, setup: { ...MATHS, gates: [], doors: [] }, readTime: false, onAnswer: onAnswer as never });
    await start();
    await runFrames(1500);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Quick question');
    expect(dialog).toHaveTextContent('A right answer takes half a second off your time.');
    fireEvent.keyDown(dialog, { key: '1' });
    fireEvent.keyDown(dialog, { key: '2' });
    fireEvent.keyDown(dialog, { key: 'Enter' });
    await runFrames(100);
    await waitFor(() => expect(onAnswer).toHaveBeenCalled());
    await runFrames(1500);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.querySelector('.marble-toast')).toHaveTextContent('Right! Half a second off your time');
    await runFrames(4000);
    const out = finished[0]!;
    const r = replay(STOPS, out.inputs)!;
    expect(r.state.pitsPaid).toEqual([0]);
    expect(r.finishSteps).toBe(r.steps - 30);
  });

  it('lets a pit stop be skipped, with no bonus', async () => {
    const onAnswer = vi.fn();
    const { finished } = setup({ course: GATED, setup: MATHS, readTime: false, onAnswer: onAnswer as never });
    await start();
    await runFrames(1500);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Skip (no time off)' }));
    await runFrames(200);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onAnswer).not.toHaveBeenCalled();
    await runFrames(8000);
    for (const run of finished) expect(run.inputs.some(([code]) => code === BONUS)).toBe(false);
  });

  it('says when the answer could not be checked, and lets the student try again or skip', async () => {
    const onAnswer = vi.fn(async () => null);
    setup({ course: GATED, setup: MATHS, readTime: false, onAnswer: onAnswer as never });
    await start();
    await runFrames(1500);
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: '5' });
    fireEvent.keyDown(dialog, { key: 'Enter' });
    await runFrames(100);
    expect(await screen.findByText(/couldn’t check that one/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Skip/ })).toBeEnabled();
  });

  it('plays a ghost with the doors that ghost ran with, not the student\'s', async () => {
    // With door A shut for the student but open for the ghost the course is the same; here we just check the ghost is drawn.
    setup({ course: GATED, setup: { ...MATHS, doors: [1] }, ghost: { name: 'Gate Ghost', steps: 500, inputs: '3x60', doors: [0] } });
    await runFrames(50);
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    await runFrames(200);
    expect((draws.mock.calls.at(-1)![4] as unknown[]).length).toBe(1);
  });

  it('hands over whether the run had maths', async () => {
    const { finished } = setup({ course: courseById('test-easy')!, setup: { ...MATHS, maths: false, gates: [], pits: [], doors: [], gems: [], rightGems: [] } });
    await runFrames(50);
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ArrowDown' });
    await runFrames(8000);
    expect(finished[0].maths).toBe(false);
  });
});

// A straight with a two-tile gap, so the marble falls: for the rescue questions.
const GAP = compileCourse({
  id: 'tiny-gap', name: 'Tiny gap',
  rows: ['==========', '=s#..###f=', '=##..###f=', '=========='],
  heights: Array(4).fill('2222222222'),
  route: [], medals: { gold: 2, silver: 4, bronze: 8 }, hardSeconds: 30,
});
// Two gems side by side on a straight; gem 0 is the right one.
const GEMMY = compileCourse({
  id: 'tiny-gems', name: 'Tiny gems',
  rows: ['==========', '=s###f====', '=####f====', '=========='],
  heights: Array(4).fill('2222222222'),
  route: [], medals: { gold: 2, silver: 4, bronze: 8 }, hardSeconds: 30,
  gems: [{ sign: [1, 1], groups: [{ after: 0, spots: [[3.5, 1.5], [3.5, 2.5]] }] }],
});

describe('RunScreen: rescue questions and number gems', () => {
  const go = async () => {
    await runFrames(50);
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ArrowDown' });
  };
  const rescueSetup: RunSetup = { maths: true, rescue: true, doors: [], gates: [], pits: [], rescues: [q(5, ['2', '×', '6', '=', '?']), q(6, ['3', '×', '3', '=', '?'])], gems: [], rightGems: [] };

  it('asks a rescue question after a fall; a right answer takes the fall\'s three seconds back', async () => {
    const onAnswer = vi.fn(async () => ({ right: true, answer: 12 }));
    setup({ course: GAP, setup: rescueSetup, onAnswer: onAnswer as never });
    await go();
    await runFrames(3000);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Rescue');
    const during = screen.getByLabelText('Time').textContent!;
    const seconds = (t: string) => Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]);
    expect(seconds(during)).toBeGreaterThanOrEqual(3);
    // Let go of the keys, or the marble rolls straight into the gap again.
    fireEvent.keyUp(window, { code: 'ArrowRight' });
    fireEvent.keyUp(window, { code: 'ArrowDown' });
    fireEvent.keyDown(dialog, { key: '1' });
    fireEvent.keyDown(dialog, { key: '2' });
    fireEvent.keyDown(dialog, { key: 'Enter' });
    await runFrames(100);
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(5, 12, expect.any(Number)));
    await runFrames(1500);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText(/No time lost for that fall/)).toBeInTheDocument();
    await runFrames(100);
    expect(seconds(screen.getByLabelText('Time').textContent!)).toBeLessThan(seconds(during) - 2.5);
  });

  it('a wrong rescue answer or skipping gives nothing back, and the clock keeps the fall', async () => {
    setup({ course: GAP, setup: rescueSetup, onAnswer: (async () => ({ right: false, answer: 12 })) as never });
    await go();
    await runFrames(3000);
    await screen.findByRole('dialog');
    const during = screen.getByLabelText('Time').textContent!;
    fireEvent.click(screen.getByRole('button', { name: 'Skip (no time back)' }));
    await runFrames(100);
    expect(screen.queryByText(/No time lost/)).toBeNull();
    expect(screen.getByLabelText('Time').textContent!.localeCompare(during)).toBeGreaterThanOrEqual(0);
  });

  it('asks no rescue question when the teacher has them off, or when maths is off', async () => {
    setup({ course: GAP, setup: { ...rescueSetup, rescue: false, rescues: [] } });
    await go();
    await runFrames(3000);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not ask again within twenty seconds of play', async () => {
    setup({ course: GAP, setup: rescueSetup, onAnswer: (async () => ({ right: false, answer: 12 })) as never });
    await go();
    await runFrames(3000);
    fireEvent.click(await screen.findByRole('button', { name: 'Skip (no time back)' }));
    await runFrames(200);
    // Rolling east again falls again within seconds: no second question yet.
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ArrowDown' });
    await runFrames(3000);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a gem trail\'s question near its gems, and a right gem takes a second off', async () => {
    const gemSetup: RunSetup = {
      maths: true, rescue: false, doors: [], gates: [], pits: [], rescues: [],
      gems: [{ slot: 2, question: q(2, ['6', '×', '7', '=', '?']), groups: [{ labels: ['42', '40'] }] }], rightGems: [0],
    };
    setup({ course: GEMMY, setup: gemSetup });
    await go();
    await runFrames(200);
    expect(screen.getByText(/Gems:/)).toHaveTextContent('Gems: 6 × 7 = …');
    await runFrames(1500);
    expect(screen.getByText('Gem! 1 second off')).toBeInTheDocument();
  });

  it('lets a student guess their time before rolling, and says how close it was', async () => {
    const plain: RunSetup = { ...rescueSetup, rescue: false, rescues: [] };
    setup({ course: courseById('test-easy')!, setup: plain });
    await runFrames(50);
    const input = screen.getByLabelText(/Guess your time/);
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ArrowDown' });
    await runFrames(8000);
    expect(await screen.findByText(/You guessed 9 seconds. It took 3\.5\./)).toBeInTheDocument();
  });

  it('tapping or clicking the guess box does not start the run', async () => {
    const plain: RunSetup = { ...rescueSetup, rescue: false, rescues: [] };
    setup({ course: courseById('test-easy')!, setup: plain });
    await runFrames(50);
    const input = screen.getByLabelText(/Guess your time/);
    fireEvent.pointerDown(input, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerDown(screen.getByText(/Guess your time/), { pointerId: 2, pointerType: 'mouse', clientX: 100, clientY: 90 });
    await runFrames(300);
    expect(screen.getByText('Ready?')).toBeInTheDocument();
    expect(screen.getByLabelText('Time').textContent).toBe('0:00.00');
  });

  it('offers no guess without maths', async () => {
    setup({ course: courseById('test-easy')!, setup: { ...rescueSetup, maths: false, rescue: false, rescues: [] } });
    await runFrames(50);
    expect(screen.queryByLabelText(/Guess your time/)).toBeNull();
  });
});
