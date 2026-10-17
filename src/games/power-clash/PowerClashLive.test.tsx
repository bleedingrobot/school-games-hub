import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newLiveGame, pressNext, playerAction, timeOut, TURN_MS, GRACE_MS, type LiveGame } from '../../../shared/power-clash/live';
import type { Action, PowerId } from '../../../shared/power-clash/types';
import type { PowerGame } from '../../data/powerGames';
import type { PowerSession } from '../../power-clash/usePowerGame';
import { SoundProvider } from '../../sound';
import { PowerClashLive } from './PowerClashLive';

const START = Date.parse('2026-10-20T09:00:00Z');
const ANA: PowerId[] = ['wild-card', 'body-swap', 'freeze-ray'];
const BEN: PowerId[] = ['board-wipe', 'body-swap', 'freeze-ray'];

const move = (g: LiveGame, seat: number, action: Action) => playerAction(g, seat, action).game;
const place = (g: LiveGame, seat: number, square: number) => move(g, seat, { type: 'place', square });

/** Ana is X (seat 0), Ben is O (seat 1). */
function rowOf(game: LiveGame, over: Partial<PowerGame> = {}): PowerGame {
  return {
    id: 'g1', code: null, in_lobby: false, host: 'ana', seat1: 'ana', seat2: 'ben', first_player: null,
    loadouts: [ANA, BEN], status: 'playing', game, events: [], version: 5, created_at: '', expires_at: '',
    started_at: new Date(START).toISOString(), deadline: new Date(START + TURN_MS).toISOString(), last_action_at: null,
    finished_at: null, ending: null, leaver: null, won: null, counts: null, stats: null, rematch_game: null, ...over,
  };
}

function sessionFor(row: PowerGame, seat: 0 | 1, over: Partial<PowerSession> = {}, clock = { now: START }) {
  const act = vi.fn(async () => true);
  const session: PowerSession = {
    game: row,
    me: seat === 0 ? 'ana' : 'ben',
    mySeat: seat,
    cards: new Map([
      ['ana', { id: 'ana', display_name: 'Ana Kiwi', avatar: {} }],
      ['ben', { id: 'ben', display_name: 'Ben Tui', avatar: {} }],
    ]) as PowerSession['cards'],
    live: 'live',
    present: ['ana', 'ben'],
    serverNow: () => clock.now,
    busy: false,
    message: '',
    clearMessage: () => {},
    act,
    reload: async () => {},
    ...over,
  };
  return { session, act, clock };
}

const ui = (session: PowerSession) => (
  <SoundProvider>
    <MemoryRouter>
      <PowerClashLive session={session} tick={20} />
    </MemoryRouter>
  </SoundProvider>
);
const show = (session: PowerSession) => render(ui(session));

const cell = (n: number) => screen.getByRole('button', { name: new RegExp(`Row ${Math.floor((n - 1) / 3) + 1}, column ${((n - 1) % 3) + 1}:`) });
const allCells = () => Array.from({ length: 9 }, (_, i) => cell(i + 1));

beforeEach(() => {
  // Reduced motion keeps the animation lock to a blink.
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => vi.unstubAllGlobals());

describe('Power Clash with a classmate: the board', () => {
  it('shows both players, the score, the round and each one’s powers', () => {
    const { session } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 0);
    show(session);
    expect(screen.getByLabelText('Score')).toHaveTextContent('You X 0');
    expect(screen.getByLabelText('Score')).toHaveTextContent('Ben Tui O 0');
    expect(screen.getByLabelText('Score')).toHaveTextContent('Round 1');
    expect(screen.getAllByRole('button', { name: /Wild Card/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Board Wipe/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Freeze Ray/ })).toHaveLength(2);
  });

  it('on my turn: I can press squares and my own powers, and only mine', () => {
    const { session } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 0);
    show(session);
    expect(screen.getByText('Your go: pick a power or a square')).toBeInTheDocument();
    expect(allCells().every((c) => c.hasAttribute('disabled') === false)).toBe(true);
    // Ana's Wild Card works; Ben's Board Wipe is on the other side and never presses
    expect(screen.getByRole('button', { name: /Wild Card/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Board Wipe/ })).toBeDisabled();
  });

  it('on their turn: nothing can be pressed, and it says whose turn it is by name', () => {
    const { session, act } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 1);
    show(session);
    expect(screen.getByText('Waiting for Ana Kiwi…')).toBeInTheDocument();
    expect(allCells().every((c) => c.hasAttribute('disabled'))).toBe(true);
    for (const button of screen.getAllByRole('button', { name: /Wild Card|Body Swap|Freeze Ray|Board Wipe/ })) {
      expect(button).toBeDisabled();
    }
    expect(act).not.toHaveBeenCalled();
  });

  it('sends the move with the version it was looking at, and draws nothing itself', async () => {
    const user = userEvent.setup();
    const { session, act } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 0);
    show(session);
    await user.click(cell(5));
    expect(act).toHaveBeenCalledWith({ action: 'place', gameId: 'g1', version: 5, square: 4 });
    // The page waits for the server: the square is still empty on screen.
    expect(cell(5)).toHaveTextContent('');
  });

  it('sends a power with its targets, one tap at a time', async () => {
    const user = userEvent.setup();
    let g = newLiveGame(ANA, BEN);
    g = place(g, 0, 0);
    g = place(g, 1, 4);
    const { session, act } = sessionFor(rowOf(g), 0);
    show(session);
    await user.click(screen.getAllByRole('button', { name: /Body Swap/ })[0]);
    expect(screen.getByText('Tap one of YOUR symbols')).toBeInTheDocument();
    await user.click(cell(1));
    await user.click(cell(5));
    expect(act).toHaveBeenCalledWith({ action: 'use-power', gameId: 'g1', version: 5, power: 'body-swap', targets: [0, 4] });
    // a power with no target goes straight away
    act.mockClear();
    await user.click(screen.getByRole('button', { name: /Wild Card/ }));
    expect(act).toHaveBeenCalledWith({ action: 'use-power', gameId: 'g1', version: 5, power: 'wild-card', targets: [] });
  });

  it('while a request is on its way nothing else can be pressed (so a double tap sends one move)', () => {
    const { session } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 0, { busy: true });
    show(session);
    expect(allCells().every((c) => c.hasAttribute('disabled'))).toBe(true);
    expect(screen.getByRole('button', { name: /Wild Card/ })).toBeDisabled();
  });

  it('keyboard: the number keys 1 to 9 place on a square, only on my turn', async () => {
    const user = userEvent.setup();
    const mine = sessionFor(rowOf(newLiveGame(ANA, BEN)), 0);
    const { unmount } = show(mine.session);
    await user.keyboard('7');
    expect(mine.act).toHaveBeenCalledWith({ action: 'place', gameId: 'g1', version: 5, square: 6 });
    unmount();
    const theirs = sessionFor(rowOf(newLiveGame(ANA, BEN)), 1);
    show(theirs.session);
    await user.keyboard('7');
    expect(theirs.act).not.toHaveBeenCalled();
  });

  it('squares can be reached and pressed with Tab and Enter', async () => {
    const user = userEvent.setup();
    const { session, act } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 0);
    show(session);
    cell(1).focus();
    await user.keyboard('{Enter}');
    expect(act).toHaveBeenCalledWith({ action: 'place', gameId: 'g1', version: 5, square: 0 });
  });

  it('draws what the server says happened: their move arrives, with its animation', async () => {
    const first = newLiveGame(ANA, BEN);
    const { session } = sessionFor(rowOf(first, { version: 5 }), 0);
    const { rerender } = show(session);
    expect(cell(5)).toHaveTextContent('');
    const after = playerAction(playerAction(first, 0, { type: 'place', square: 0 }).game, 1, { type: 'place', square: 4 });
    const arrived = { ...session, game: rowOf(after.game, { version: 7, events: after.events }) };
    rerender(ui(arrived));
    await waitFor(() => expect(cell(5)).toHaveTextContent('O'));
    expect(cell(5).className).toContain('pc__cell--pop');
    expect(screen.getByText('Your go: pick a power or a square')).toBeInTheDocument();
  });

  it('a Freeze Ray from them shows the ice and says so', async () => {
    const first = newLiveGame(ANA, BEN);
    const g1 = place(first, 0, 0);
    const { session } = sessionFor(rowOf(g1, { version: 6 }), 0);
    const { rerender } = show(session);
    const frozen = playerAction(g1, 1, { type: 'use-power', power: 'freeze-ray', targets: [8] });
    const g2 = frozen.game;
    rerender(ui({ ...session, game: rowOf(g2, { version: 7, events: frozen.events }) }));
    await waitFor(() => expect(screen.getByText(/Ben Tui: Freeze Ray!/)).toBeInTheDocument());
    expect(cell(9).className).toContain('pc__cell--frozen');
  });
});

describe('the new powers from a classmate', () => {
  const NEW_A: PowerId[] = ['force-field', 'portal-chaos', 'time-heist'];
  const NEW_B: PowerId[] = ['wild-card', 'time-heist', 'freeze-ray'];

  /** Ana plays first; the screen is Ana's and has seen the game before `action` arrives from Ben. */
  async function benPlays(setup: (g: LiveGame) => LiveGame, action: Action, dice: () => number = () => 0.4) {
    const first = setup(place(newLiveGame(NEW_A, NEW_B), 0, 4));
    const { session } = sessionFor(rowOf(first, { version: 6, loadouts: [NEW_A, NEW_B] }), 0);
    const { rerender } = show(session);
    const played = playerAction(first, 1, action, dice);
    rerender(ui({ ...session, game: rowOf(played.game, { version: 7, events: played.events, loadouts: [NEW_A, NEW_B] }) }));
    return played;
  }

  it('shows all seven kinds of card, and my own can be pressed on my go', async () => {
    const user = userEvent.setup();
    const { session, act } = sessionFor(rowOf(newLiveGame(NEW_A, NEW_B), { loadouts: [NEW_A, NEW_B] }), 0);
    show(session);
    expect(screen.getByRole('button', { name: /Force Field/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Wild Card/ })).toBeDisabled(); // Ben's
    // Time Heist is greyed out on the first go, with the reason on the card.
    expect(screen.getAllByRole('button', { name: /Time Heist/ })[0]).toBeEnabled();
    await user.click(screen.getAllByRole('button', { name: /Time Heist/ })[0]);
    expect(act).not.toHaveBeenCalled();
    expect(document.querySelector('.pc__message')!.textContent).toBe('Nobody has finished a go yet');
  });

  it('Force Field: pick my symbol, then it is sent as a power with one target', async () => {
    const user = userEvent.setup();
    const g = place(place(newLiveGame(NEW_A, NEW_B), 0, 4), 1, 0);
    const { session, act } = sessionFor(rowOf(g, { loadouts: [NEW_A, NEW_B] }), 0);
    show(session);
    await user.click(screen.getByRole('button', { name: /Force Field/ }));
    await waitFor(() => expect(cell(5)).toBeEnabled());
    expect(cell(1)).toBeDisabled(); // their symbol
    await user.click(cell(5));
    expect(act).toHaveBeenCalledWith({ action: 'use-power', gameId: 'g1', version: 5, power: 'force-field', targets: [4] });
  });

  it('Portal Chaos: two taps send two targets', async () => {
    const user = userEvent.setup();
    const g = place(place(newLiveGame(NEW_A, NEW_B), 0, 4), 1, 0);
    const { session, act } = sessionFor(rowOf(g, { loadouts: [NEW_A, NEW_B] }), 0);
    show(session);
    await user.click(screen.getByRole('button', { name: /Portal Chaos/ }));
    expect(screen.getByText('Tap the first symbol')).toBeInTheDocument();
    await user.click(cell(5));
    expect(screen.getByText('Tap the second symbol')).toBeInTheDocument();
    await user.click(cell(1));
    expect(act).toHaveBeenCalledWith({ action: 'use-power', gameId: 'g1', version: 5, power: 'portal-chaos', targets: [4, 0] });
  });

  it('their Wild Card shows the wheel and what it landed on, in the message', async () => {
    await benPlays((g) => g, { type: 'use-power', power: 'wild-card', targets: [] });
    await waitFor(() => expect(screen.getByText(/Ben Tui: Wild Card! The wheel landed on/)).toBeInTheDocument());
    expect(document.querySelector('.pc__wheel')).not.toBeNull();
  });

  it('their Time Heist rewinds my go, and the board shows it', async () => {
    const first = newLiveGame(NEW_A, NEW_B);
    const g1 = place(first, 0, 4);
    const g2 = place(g1, 1, 0);
    const g3 = place(g2, 0, 8); // my go
    const { session } = sessionFor(rowOf(g3, { version: 6, loadouts: [NEW_A, NEW_B] }), 0);
    const { rerender } = show(session);
    expect(cell(9)).toHaveTextContent('X');
    const heist = playerAction(g3, 1, { type: 'use-power', power: 'time-heist', targets: [] });
    rerender(ui({ ...session, game: rowOf(heist.game, { version: 7, events: heist.events, loadouts: [NEW_A, NEW_B] }) }));
    await waitFor(() => expect(cell(9)).toHaveTextContent(''));
    expect(screen.getByText(/Ben Tui: Time Heist! The last go never happened/)).toBeInTheDocument();
    expect(cell(9).className).toContain('pc__cell--rewind');
    expect(document.querySelector('.pc__board')!.className).toContain('pc__board--rewind');
  });

  it('a protected symbol shows its shield and is named as protected', () => {
    const g = place(playerAction(place(newLiveGame(NEW_A, NEW_B), 0, 4), 1, { type: 'place', square: 0 }).game, 0, 8);
    const guarded = playerAction(g, 1, { type: 'place', square: 1 }).game;
    const withShield = { ...guarded, match: { ...guarded.match, state: { ...guarded.match.state, shields: [{ square: 4, owner: 'X' as const }] } } };
    const { session } = sessionFor(rowOf(withShield, { loadouts: [NEW_A, NEW_B] }), 0);
    show(session);
    expect(cell(5).getAttribute('aria-label')).toMatch(/X, protected/);
    expect(document.querySelector('.pc__shield')).not.toBeNull();
    expect(document.querySelector('.pc__chaosbadge')).toBeNull(); // classmates games are never Chaos Mode
  });
});

describe('the clock', () => {
  it('shows the server’s countdown as a number', () => {
    const { session, clock } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 0);
    clock.now = START + 15_000;
    show(session);
    expect(screen.getByLabelText('Score')).toHaveTextContent('⏱ 45');
  });

  it('warns out loud at 10 seconds on my turn, once, and never flashes (no animation on the number)', async () => {
    const { session, clock } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 0);
    clock.now = START + 30_000;
    show(session);
    expect(screen.queryByText(/seconds left on your turn/)).not.toBeInTheDocument();
    clock.now = START + TURN_MS - 9_500;
    await waitFor(() => expect(screen.getByText('10 seconds left on your turn.')).toBeInTheDocument());
    clock.now = START + TURN_MS - 5_000;
    await waitFor(() => expect(screen.getByLabelText('Score')).toHaveTextContent('⏱ 5'));
    // still the first warning: the text isn't replaced every second
    expect(screen.getByText('10 seconds left on your turn.')).toBeInTheDocument();
    expect(document.querySelector('.pcl__clock')?.getAttribute('style')).toBeNull();
  });

  it('does not warn when it is their turn', async () => {
    const { session, clock } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 1);
    clock.now = START + TURN_MS - 5_000;
    show(session);
    await waitFor(() => expect(screen.getByLabelText('Score')).toHaveTextContent('⏱ 5'));
    expect(screen.queryByText(/seconds left on your turn/)).not.toBeInTheDocument();
  });

  it('asks the server to end a turn only once the time has really run out', async () => {
    const { session, act, clock } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 1);
    clock.now = START + TURN_MS + 200;
    show(session);
    await new Promise((r) => setTimeout(r, 80));
    expect(act).not.toHaveBeenCalled();
    clock.now = START + TURN_MS + GRACE_MS + 400;
    await waitFor(() => expect(act).toHaveBeenCalledWith({ action: 'times-up', gameId: 'g1' }));
  });

  it('says a missed turn was missed because of the clock', async () => {
    const first = newLiveGame(ANA, BEN);
    const { session } = sessionFor(rowOf(first, { version: 5 }), 0);
    const { rerender } = show(session);
    const out = timeOut(first);
    rerender(ui({ ...session, game: rowOf(out.game, { version: 6, events: out.events }) }));
    await waitFor(() => expect(screen.getByText('Time ran out, so you missed your go.')).toBeInTheDocument());
  });
});

describe('the connection', () => {
  it('says so when the live connection drops, and stops saying so when it is back', () => {
    const { session } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 0, { live: 'down' });
    const { rerender } = show(session);
    expect(screen.getByText(/We lost the connection/)).toBeInTheDocument();
    expect(screen.getByText(/Your game is safe/)).toBeInTheDocument();
    rerender(ui({ ...session, live: 'live' }));
    expect(screen.queryByText(/We lost the connection/)).not.toBeInTheDocument();
  });

  it('says so when the browser goes offline', async () => {
    const { session } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 0);
    show(session);
    expect(screen.queryByText(/We lost the connection/)).not.toBeInTheDocument();
    window.dispatchEvent(new Event('offline'));
    await waitFor(() => expect(screen.getByText(/We lost the connection/)).toBeInTheDocument());
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(screen.queryByText(/We lost the connection/)).not.toBeInTheDocument());
  });

  it('a game opened mid-way (after a reload) shows its state and animates nothing', () => {
    let g = newLiveGame(ANA, BEN);
    g = place(g, 0, 0);
    g = place(g, 1, 4);
    const { session } = sessionFor(rowOf(g, { events: [{ kind: 'place', player: 'O', square: 4 }] }), 0);
    show(session);
    expect(cell(1)).toHaveTextContent('X');
    expect(cell(5)).toHaveTextContent('O');
    expect(cell(5).className).not.toContain('pc__cell--pop');
  });
});

describe('between rounds and at the end', () => {
  const xWins = (): LiveGame => {
    let g = newLiveGame(ANA, BEN);
    for (const [seat, sq] of [[0, 0], [1, 3], [0, 1], [1, 4], [0, 2]] as const) g = place(g, seat, sq);
    return g;
  };

  it('a won round says so, and Next round asks the server for that round', async () => {
    const user = userEvent.setup();
    const { session, act } = sessionFor(rowOf(xWins()), 0);
    show(session);
    expect(screen.getByText('You win the round!')).toBeInTheDocument();
    expect(allCells().every((c) => c.hasAttribute('disabled'))).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Next round' }));
    expect(act).toHaveBeenCalledWith({ action: 'next', gameId: 'g1', round: 1 });
  });

  it('after I press Next it waits for my classmate, by name', () => {
    const pressed = pressNext(xWins(), 0).game;
    const { session } = sessionFor(rowOf(pressed), 0);
    show(session);
    expect(screen.getByRole('button', { name: 'Waiting for Ben Tui…' })).toBeDisabled();
  });

  it('a lost round says who won', () => {
    const { session } = sessionFor(rowOf(xWins()), 1);
    show(session);
    expect(screen.getByText('Ana Kiwi wins the round.')).toBeInTheDocument();
  });

  it('a finished match shows the result, Rematch and the lobby', async () => {
    const user = userEvent.setup();
    const won: LiveGame = { ...xWins(), match: { ...xWins().match, winner: 'X', score: { X: 3, O: 1 } } };
    const { session, act } = sessionFor(rowOf(won, { status: 'finished', ending: 'finished', won: [true, false], counts: [true, true] }), 1);
    show(session);
    expect(screen.getByText('Ana Kiwi wins the match.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rematch' }));
    expect(act).toHaveBeenCalledWith({ action: 'rematch', gameId: 'g1' });
    expect(screen.getByRole('link', { name: 'Back to the lobby' })).toHaveAttribute('href', '/lobby');
    expect(screen.queryByRole('button', { name: 'Leave game' })).not.toBeInTheDocument();
  });

  it('offers to join a rematch the other player already started', () => {
    const won: LiveGame = { ...xWins(), match: { ...xWins().match, winner: 'X' } };
    const { session } = sessionFor(rowOf(won, { status: 'finished', ending: 'finished', rematch_game: 'g2' }), 1);
    show(session);
    expect(screen.getByRole('button', { name: 'Join the rematch' })).toBeInTheDocument();
    expect(screen.getByText('Ana Kiwi wants a rematch!')).toBeInTheDocument();
  });

  it('tells me when my classmate left, and that nobody earns points', () => {
    const { session } = sessionFor(rowOf(newLiveGame(ANA, BEN), { status: 'finished', ending: 'abandoned', leaver: 'ana', won: [false, false], counts: [false, false] }), 1);
    show(session);
    expect(screen.getByText('Ana Kiwi left the game.')).toBeInTheDocument();
    expect(screen.getByText(/doesn’t earn points for anyone/)).toBeInTheDocument();
  });

  it('leaving asks first, then tells the server', async () => {
    const user = userEvent.setup();
    const { session, act } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 0);
    show(session);
    await user.click(screen.getByRole('button', { name: 'Leave game' }));
    expect(act).not.toHaveBeenCalled();
    expect(screen.getByText(/Ben Tui will be told, and nobody earns points/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(act).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Leave game' }));
    await user.click(screen.getByRole('button', { name: 'Yes, leave' }));
    expect(act).toHaveBeenCalledWith({ action: 'leave', gameId: 'g1' });
  });

  it('says when my classmate seems to be away', async () => {
    const { session } = sessionFor(rowOf(newLiveGame(ANA, BEN)), 0, { present: ['ana'] });
    vi.useFakeTimers();
    try {
      show(session);
      expect(screen.queryByText(/isn’t here right now/)).not.toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(8_100);
      expect(screen.getByText(/Ben Tui isn’t here right now/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
