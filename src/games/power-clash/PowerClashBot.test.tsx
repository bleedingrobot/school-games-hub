import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replaySolo } from '../../../shared/power-clash/solo';
import { judgePowerClashGame, type PowerClashGameReport } from '../../../shared/power-clash/save';
import { PowerClashPlay, type PowerClashSaving } from './PowerClashPlay';

const SEED = 's1-1792000000-abcdefabcdefabcdefabcdef';
const STAMP = 'x'.repeat(43);

function savingMock(over: Partial<PowerClashSaving> = {}) {
  const saved: PowerClashGameReport[] = [];
  const left: PowerClashGameReport[] = [];
  const saving: PowerClashSaving = {
    seed: vi.fn(async () => ({ seed: SEED, stamp: STAMP })),
    save: vi.fn(async (r) => {
      saved.push(r);
      return { countsForPoints: true };
    }),
    abandon: vi.fn((r) => void left.push(r)),
    ...over,
  };
  return { saving, saved, left };
}

const cells = () => screen.getAllByRole('button', { name: /^Row \d, column \d:/ });
const openCells = () => cells().filter((c) => !(c as HTMLButtonElement).disabled);
const prompt = () => document.querySelector('.pc__prompt')!.textContent ?? '';

async function chooseBot(user: ReturnType<typeof userEvent.setup>, side: 'X' | 'O' = 'X') {
  await user.click(screen.getByRole('button', { name: 'Play a bot' }));
  if (side === 'O') await user.click(screen.getByRole('button', { name: /^O \(bot goes first\)/ }));
  await user.click(screen.getByRole('button', { name: /Start the clash/ }));
}

/** Plays like a hurried student: first free square, next round when asked, until the match ends. */
async function playToTheEnd(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 400; i++) {
    if (/match/.test(prompt()) && screen.queryByRole('button', { name: 'Rematch' })) return;
    const next = screen.queryByRole('button', { name: 'Next round' });
    if (next) await user.click(next);
    else {
      const open = openCells();
      if (open.length) await user.click(open[0]);
      else await act(async () => new Promise((r) => setTimeout(r, 5)));
    }
  }
  throw new Error('the match never ended');
}

describe('Power Clash against a bot', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('offers Play a bot beside two-player, with the usual level picker and a side', async () => {
    const user = userEvent.setup();
    render(<PowerClashPlay timeScale={0} />);
    expect(screen.getByRole('button', { name: 'Two players, one screen' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Play a bot' }));
    const levels = screen.getByRole('group', { name: 'Bot level' });
    expect(within(levels).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['very-easy', 'easy', 'medium']);
    expect(screen.getByRole('button', { name: /^X \(you go first\)/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: /Pick your powers \(3\/3\)/ })).toBeInTheDocument();
    expect(screen.getByText(/practice copy/)).toBeInTheDocument(); // no saving in the preview
  });

  it('the bot replies after the student, and says what it did', async () => {
    const user = userEvent.setup();
    render(<PowerClashPlay timeScale={0} />);
    await chooseBot(user);
    expect(screen.getByText('Practice game: this one won’t be saved.')).toBeInTheDocument();
    await user.click(openCells()[4]);
    await waitFor(() => expect(cells().filter((c) => /: O$/.test(c.getAttribute('aria-label')!))).toHaveLength(1));
    expect(document.querySelector('.pc__message')!.textContent).toMatch(/^The bot put O on /);
    await waitFor(() => expect(openCells().length).toBeGreaterThan(0)); // the student's turn again
    expect(prompt()).toMatch(/^Your go/);
  });

  it('the student cannot act on the bot’s turn', async () => {
    const user = userEvent.setup();
    render(<PowerClashPlay timeScale={1} />); // real thinking time so the lock is visible
    await chooseBot(user);
    await user.click(openCells()[0]);
    // Right after the student's move: every square, every power and "Leave game" waits, and the bot is thinking.
    expect(openCells()).toHaveLength(0);
    expect(prompt()).toMatch(/is thinking/);
    for (const power of screen.getAllByRole('button', { name: /Double Trouble|Body Swap|Freeze Ray|Board Wipe/ })) expect(power).toBeDisabled();
    await waitFor(() => expect(openCells().length).toBeGreaterThan(0), { timeout: 4000 });
    expect(prompt()).toMatch(/^Your go/);
  });

  it('the bot moves first when the student is O', async () => {
    const user = userEvent.setup();
    render(<PowerClashPlay timeScale={0} />);
    await chooseBot(user, 'O');
    await waitFor(() => expect(cells().filter((c) => /: X$/.test(c.getAttribute('aria-label')!))).toHaveLength(1));
    await waitFor(() => expect(openCells().length).toBeGreaterThan(0));
    expect(screen.getByLabelText('Score')).toHaveTextContent('You');
  });

  it('shows both sets of powers, and the bot’s cards can’t be pressed', async () => {
    const user = userEvent.setup();
    render(<PowerClashPlay timeScale={0} />);
    await chooseBot(user);
    expect(screen.getByRole('heading', { name: /^You \(X\)/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /The Easy bot \(O\)/ })).toBeInTheDocument();
    const panels = document.querySelectorAll('.pc__panel');
    expect(within(panels[1] as HTMLElement).getAllByRole('button')).toHaveLength(3);
    for (const b of within(panels[1] as HTMLElement).getAllByRole('button')) expect(b).toBeDisabled();
  });

  it('saves the match once, when it ends, and the server would accept what was sent', async () => {
    const user = userEvent.setup();
    const { saving, saved, left } = savingMock();
    render(<PowerClashPlay timeScale={0} saving={saving} level="very-easy" />);
    await chooseBot(user);
    expect(saving.seed).toHaveBeenCalledTimes(1);
    expect(screen.getByText('This game will be saved when it’s over.')).toBeInTheDocument();
    await playToTheEnd(user);
    await waitFor(() => expect(saving.save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Game saved. Thanks for playing!')).toBeInTheDocument());
    const report = saved[0];
    expect(report).toEqual(expect.objectContaining({ game: 'power-clash', seed: SEED, stamp: STAMP, level: 'very-easy', side: 'X', ending: 'finished' }));
    // The page played exactly what the server replays.
    const judged = judgePowerClashGame(report);
    expect(judged.ok && judged.game.reason).toBe('finished');
    const replay = replaySolo({ seed: SEED, level: 'very-easy', side: 'X', loadout: report.loadouts.X }, report.actions);
    expect(replay.ok && replay.finished).toBe(true);
    expect(left).toEqual([]);
    // Nothing more is sent just by sitting there.
    await act(async () => new Promise((r) => setTimeout(r, 30)));
    expect(saving.save).toHaveBeenCalledTimes(1);
  }, 60000);

  it('says so when a game could not be saved', async () => {
    const user = userEvent.setup();
    const { saving } = savingMock({ save: vi.fn(async () => { throw new Error('No Wi-Fi right now'); }) });
    render(<PowerClashPlay timeScale={0} saving={saving} level="very-easy" />);
    await chooseBot(user);
    await playToTheEnd(user);
    await waitFor(() => expect(screen.getByText('No Wi-Fi right now')).toBeInTheDocument());
  }, 60000);

  it('is a practice game when no seed can be had, and sends nothing', async () => {
    const user = userEvent.setup();
    const { saving } = savingMock({ seed: vi.fn(async () => null) });
    render(<PowerClashPlay timeScale={0} saving={saving} level="very-easy" />);
    await chooseBot(user);
    expect(screen.getByText('Practice game: this one won’t be saved.')).toBeInTheDocument();
    await playToTheEnd(user);
    expect(saving.save).not.toHaveBeenCalled();
  }, 60000);

  it('records a game left part-way as left early (and a match with no moves as nothing)', async () => {
    const user = userEvent.setup();
    const { saving, left } = savingMock();
    render(<PowerClashPlay timeScale={0} saving={saving} />);
    await chooseBot(user);
    await user.click(screen.getByRole('button', { name: 'Leave game' }));
    expect(left).toEqual([]); // did nothing yet
    await chooseBot(user);
    await user.click(openCells()[0]);
    await waitFor(() => expect(openCells().length).toBeGreaterThan(0));
    await user.click(screen.getByRole('button', { name: 'Leave game' }));
    expect(saving.abandon).toHaveBeenCalledTimes(1);
    expect(left[0]).toEqual(expect.objectContaining({ ending: 'abandoned', actions: ['place:0'] }));
    expect(screen.getByRole('button', { name: /Start the clash/ })).toBeInTheDocument();
  });

  it('two-player games on one screen are never saved', async () => {
    const user = userEvent.setup();
    const { saving } = savingMock();
    render(<PowerClashPlay timeScale={0} saving={saving} />);
    await user.click(screen.getByRole('button', { name: /Start the clash/ }));
    await user.click(openCells()[0]);
    expect(saving.seed).not.toHaveBeenCalled();
    expect(screen.queryByText(/Practice game/)).toBeNull();
  });
});
