import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { judgePowerClashGame, type PowerClashGameReport } from '../../../shared/power-clash/save';
import type { PowerId } from '../../../shared/power-clash/types';
import { PowerClashPlay, type PowerClashSaving } from './PowerClashPlay';
import { POWERS } from './text';

type User = ReturnType<typeof userEvent.setup>;
const NAMES: Record<PowerId, RegExp> = {
  'body-swap': /Body Swap/, 'freeze-ray': /Freeze Ray/, 'board-wipe': /Board Wipe/,
  'force-field': /Force Field/, 'portal-chaos': /Portal Chaos/, 'wild-card': /Wild Card/, 'time-heist': /Time Heist/,
};
const cell = (row: number, col: number) => screen.getByRole('button', { name: new RegExp(`Row ${row}, column ${col}:`) });
const message = () => document.querySelector('.pc__message')!.textContent ?? '';

async function tap(user: User, row: number, col: number) {
  await waitFor(() => expect(cell(row, col)).toBeEnabled(), { timeout: 3000 });
  await user.click(cell(row, col));
}
/** In the setup screen, make a player's three powers exactly these. */
async function pick(user: User, player: 'X' | 'O', powers: PowerId[]) {
  const panel = () => screen.getByRole('heading', { name: new RegExp(`Player ${player}: pick`) }).closest('section') as HTMLElement;
  for (const p of POWERS) {
    const button = within(panel()).getByRole('button', { name: NAMES[p.id] });
    if (button.getAttribute('aria-pressed') === 'true' && !powers.includes(p.id)) await user.click(button);
  }
  for (const id of powers) {
    const button = within(panel()).getByRole('button', { name: NAMES[id] });
    if (button.getAttribute('aria-pressed') !== 'true') await user.click(button);
  }
}
/** The power card for a player (0 = X's panel, 1 = O's panel) on the game screen. */
const card = (id: PowerId, player: 0 | 1 = 0) => screen.getAllByRole('button', { name: NAMES[id] })[player];

/** Wait out the animation lock, then press the card. */
async function useCard(user: User, id: PowerId, player: 0 | 1 = 0) {
  await waitFor(() => expect(card(id, player)).toBeEnabled(), { timeout: 3000 });
  await user.click(card(id, player));
}

async function begin(user: User, x: PowerId[], o: PowerId[], chaos = false) {
  render(<PowerClashPlay />);
  if (chaos) await user.click(screen.getByRole('button', { name: /Chaos Mode/ }));
  await pick(user, 'X', x);
  await pick(user, 'O', o);
  await user.click(screen.getByRole('button', { name: /Start the clash/ }));
}

describe('the seven powers', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists all seven in each picker and still wants exactly three', async () => {
    const user = userEvent.setup();
    render(<PowerClashPlay />);
    for (const player of ['X', 'O'] as const) {
      const panel = screen.getByRole('heading', { name: new RegExp(`Player ${player}: pick`) }).closest('section') as HTMLElement;
      expect(within(panel).getAllByRole('button')).toHaveLength(7);
    }
    await pick(user, 'X', ['force-field', 'portal-chaos', 'wild-card']);
    expect(screen.getByRole('button', { name: /Start the clash/ })).toBeEnabled();
    // A fourth one is not added.
    await user.click(within(screen.getByRole('heading', { name: /Player X: pick/ }).closest('section') as HTMLElement).getByRole('button', { name: /Time Heist/ }));
    expect(screen.getByRole('heading', { name: /Player X: pick 3 \(3\/3\)/ })).toBeInTheDocument();
  });

  it('Force Field: pick your own symbol, it shows a shield and the other player cannot target it', async () => {
    const user = userEvent.setup();
    await begin(user, ['force-field', 'freeze-ray', 'portal-chaos'], ['board-wipe', 'body-swap', 'freeze-ray']);
    await tap(user, 2, 2); // X in the middle
    await tap(user, 1, 1); // O in the corner
    await useCard(user, 'force-field');
    expect(screen.getByText('Tap one of YOUR symbols to protect')).toBeInTheDocument();
    // Only X's own symbol can be picked.
    await waitFor(() => expect(cell(2, 2)).toBeEnabled(), { timeout: 3000 });
    expect(cell(1, 1)).toBeDisabled();
    await user.click(cell(2, 2));
    expect(message()).toMatch(/Force Field!/);
    await tap(user, 3, 3); // X places
    expect(cell(2, 2).getAttribute('aria-label')).toMatch(/X, protected/);
    expect(document.querySelector('.pc__shield')).not.toBeNull();
    // O tries a Board Wipe: the protected symbol can't be chosen, the others can.
    await useCard(user, 'board-wipe', 0); // only O has one
    await waitFor(() => expect(cell(3, 3)).toBeEnabled(), { timeout: 3000 });
    expect(cell(2, 2)).toBeDisabled();
  });

  it('Portal Chaos: tap two symbols, they are thrown, and the message says so', async () => {
    const user = userEvent.setup();
    await begin(user, ['portal-chaos', 'freeze-ray', 'force-field'], ['board-wipe', 'body-swap', 'freeze-ray']);
    await tap(user, 1, 1); // X
    await tap(user, 1, 2); // O
    await tap(user, 2, 2); // X
    await tap(user, 3, 3); // O
    await useCard(user, 'portal-chaos'); // X's turn
    expect(screen.getByText('Tap the first symbol')).toBeInTheDocument();
    await tap(user, 1, 1);
    expect(screen.getByText('Tap the second symbol')).toBeInTheDocument();
    await tap(user, 1, 2);
    expect(message()).toMatch(/Portal Chaos! Two symbols were thrown/);
    const symbols = screen.getAllByRole('button', { name: /^Row \d, column \d:/ }).map((c) => c.getAttribute('aria-label')!.split(': ')[1]);
    expect(symbols.filter((s) => s === 'X')).toHaveLength(2);
    expect(symbols.filter((s) => s === 'O')).toHaveLength(2);
  });

  it('Wild Card: one tap spins the wheel and says what it landed on', async () => {
    const user = userEvent.setup();
    await begin(user, ['wild-card', 'freeze-ray', 'force-field'], ['board-wipe', 'body-swap', 'freeze-ray']);
    await user.click(card('wild-card'));
    expect(message()).toMatch(/Wild Card! The wheel landed on (Bonus placement|Freeze|Swap|Blast)/);
    expect(document.querySelector('.pc__wheel')).not.toBeNull();
    expect(screen.getAllByText('Used up').length).toBeGreaterThan(0);
  });

  it('Time Heist: greyed out until a go has finished, then it undoes their go', async () => {
    const user = userEvent.setup();
    await begin(user, ['time-heist', 'freeze-ray', 'board-wipe'], ['time-heist', 'body-swap', 'freeze-ray']);
    expect(card('time-heist')).toBeEnabled();
    await user.click(card('time-heist'));
    expect(message()).toBe('Nobody has finished a go yet');
    expect(screen.getAllByText(/Can’t use: Nobody has finished a go yet/).length).toBeGreaterThan(0);
    await tap(user, 2, 2); // X in the middle
    await useCard(user, 'time-heist', 1); // O undoes it
    expect(message()).toMatch(/Time Heist! The last go never happened/);
    expect(cell(2, 2).getAttribute('aria-label')).toMatch(/empty/);
    expect(screen.getByText(/Player O: now place your symbol/)).toBeInTheDocument();
    await tap(user, 1, 1); // O places as normal
    expect(cell(1, 1).getAttribute('aria-label')).toMatch(/: O/);
  });
});

describe('Chaos Mode on one screen', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is a separate, clearly labelled button that explains itself, and normal play is the default', async () => {
    const user = userEvent.setup();
    render(<PowerClashPlay />);
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Chaos Mode/ })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: /Chaos Mode/ }));
    expect(screen.getByText(/after every third go, a surprise happens/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Start the clash/ }));
    expect(screen.getByText(/Chaos Mode: a surprise in 3 goes/)).toBeInTheDocument();
  });

  it('a normal game never shows the Chaos Mode badge', async () => {
    const user = userEvent.setup();
    await begin(user, ['force-field', 'freeze-ray', 'board-wipe'], ['body-swap', 'freeze-ray', 'force-field']);
    expect(document.querySelector('.pc__chaosbadge')).toBeNull();
    await tap(user, 1, 1);
    await tap(user, 2, 2);
    await tap(user, 3, 3);
    await waitFor(() => expect(cell(1, 2)).toBeEnabled(), { timeout: 3000 });
    expect(message()).not.toMatch(/Earthquake|Frost wave|Meteor|Lucky star|Recharge/);
  });

  it('a surprise comes after the third go: a banner, one line of text, and the countdown starts again', async () => {
    const user = userEvent.setup();
    await begin(user, ['force-field', 'freeze-ray', 'board-wipe'], ['body-swap', 'freeze-ray', 'force-field'], true);
    await tap(user, 1, 1);
    expect(screen.getByText(/a surprise in 2 goes/)).toBeInTheDocument();
    await tap(user, 2, 2);
    expect(screen.getByText(/a surprise after this go/)).toBeInTheDocument();
    await tap(user, 3, 3);
    expect(message()).toMatch(/Earthquake!|Frost wave!|Meteor!|Lucky star!|Recharge!/);
    expect(document.querySelector('.pc__chaos')).not.toBeNull();
    expect(screen.getByText(/a surprise in 3 goes/)).toBeInTheDocument();
  });

  it('Rematch keeps Chaos Mode', async () => {
    const user = userEvent.setup();
    await begin(user, ['force-field', 'freeze-ray', 'board-wipe'], ['body-swap', 'freeze-ray', 'force-field'], true);
    expect(document.querySelector('.pc--chaos')).not.toBeNull();
  });

  it('How to play explains the new powers and Chaos Mode', async () => {
    const user = userEvent.setup();
    render(<PowerClashPlay />);
    await user.click(screen.getByRole('button', { name: /How to play/ }));
    const dialog = screen.getByRole('dialog');
    for (const name of ['The seven powers', 'Chaos Mode', 'Force Field', 'Portal Chaos', 'Wild Card', 'Time Heist']) {
      expect(within(dialog).getAllByText(new RegExp(name)).length).toBeGreaterThan(0);
    }
  });
});

describe('Chaos Mode against a bot, saved for points', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends a report that says Chaos Mode, and the server replay of it works', async () => {
    const SEED = 's1-1792000000-abcdefabcdefabcdefabcdef';
    const saved: PowerClashGameReport[] = [];
    const saving: PowerClashSaving = {
      seed: vi.fn(async () => ({ seed: SEED, stamp: 'x'.repeat(43) })),
      save: vi.fn(async (r) => {
        saved.push(r);
        return { countsForPoints: true };
      }),
      abandon: vi.fn(),
    };
    const user = userEvent.setup();
    render(<PowerClashPlay saving={saving} timeScale={0} />);
    await user.click(screen.getByRole('button', { name: 'Play a bot' }));
    await user.click(screen.getByRole('button', { name: /Chaos Mode/ }));
    await user.click(screen.getByRole('button', { name: /Start the clash/ }));
    // Plays like a hurried student: first free square, next round when asked.
    for (let i = 0; i < 600 && saved.length === 0; i++) {
      const next = screen.queryByRole('button', { name: 'Next round' });
      if (next) await user.click(next);
      else {
        const open = screen.getAllByRole('button', { name: /^Row \d, column \d:/ }).filter((c) => !(c as HTMLButtonElement).disabled);
        if (open.length) await user.click(open[0]);
        else await act(async () => new Promise((r) => setTimeout(r, 5)));
      }
    }
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].chaos).toBe(true);
    const judged = judgePowerClashGame(saved[0]);
    expect(judged.ok).toBe(true);
    if (judged.ok) expect(judged.game.reason).toBe('finished');
  }, 60000);
});
