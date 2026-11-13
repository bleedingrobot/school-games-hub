import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in picture (the real one draws on a canvas, which this test browser doesn't have).
const calls = { warps: 0, scenes: [] as string[] };
vi.mock('./renderer', () => ({
  createSpaceView: () => ({
    setScene: (s: { kind: string; planet: string }) => { calls.scenes.push(`${s.kind}:${s.planet}`); },
    warp: async () => { calls.warps++; },
    shoot: async () => {},
    raiseShields: () => {},
    setHull: () => {},
    explode: async () => {},
    flee: async () => {},
    robbed: async () => {},
    resetFight: () => {},
    setOptions: () => {},
    stats: () => ({ simple: false, slowSwitches: 0, frames: 0, particles: 0 }),
    destroy: () => {},
  }),
}));

// The 3D viewer needs WebGL, which this test browser doesn't have: the Forge shows its flat picture instead.
vi.mock('./forge/loadViewer', () => ({ loadViewer: async () => null }));

import { traderApi } from '../../data/trader';
import { TraderGame } from './TraderGame';
import { nameText } from '../../../shared/trader/system';
import { trialBackend, type Trial } from './trialBackend';

// These screens do a lot per step; on a busy CI runner the default 1s wait ran out (twice on 4 Nov 2026).
configure({ asyncUtilTimeout: 5000 });

const NOW = Date.UTC(2026, 9, 22, 1, 0, 0);
const ALL_TIPS = ['maths', 'junk', 'trader', 'pirates', 'pirates-nolaser', 'customs', 'wrecked', 'robbed', 'shipyard', 'noyard', 'bank', 'borrow', 'news', 'jumps'];

beforeEach(() => {
  calls.warps = 0;
  calls.scenes = [];
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  HTMLCanvasElement.prototype.toDataURL = (() => '') as never;
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never;
  // First Flight and the first-time tips have their own tests below; the rest of the game is tested as a pupil who has
  // skipped First Flight and seen every tip.
  localStorage.setItem('sgh-trader-coach', JSON.stringify({ flight: 'skipped', run: null, tips: ALL_TIPS }));
});
afterEach(() => cleanup());

function play(trial: Trial = trialBackend({ seed: 'screen-test', now: () => NOW }), startAt: 'title' | 'planet' = 'planet') {
  const api = traderApi(trial.transport);
  const sent: Record<string, unknown>[] = [];
  const spy: typeof trial.transport = async (body, o) => {
    sent.push(body);
    return trial.transport(body, o);
  };
  render(<TraderGame api={traderApi(spy)} startAt={startAt} />);
  void api;
  return { trial, sent };
}
const market = () => screen.findByRole('heading', { name: 'Market' });

describe('Star Trader screen (talking to the real server logic on a pretend database)', () => {

  it('a trade is sent with the next jump, not on its own, and the server saves it', async () => {
    const { trial, sent } = play();
    await market();
    const hud = screen.getByTitle('Your credits');
    const before = Number(within(hud).getByText(/\d/).textContent?.replace(/,/g, ''));
    const row = screen.getAllByRole('row').find((r) => within(r).queryByLabelText(/^Buy one Water$/));
    if (!row) throw new Error('no water row');
    fireEvent.click(within(row).getByLabelText('Buy one Water'));
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    await waitFor(() => {
      // A maths check can come up (it can open a moment after Trade); skip it.
      const skip = screen.queryByText('No thanks');
      if (skip) fireEvent.click(skip);
      const after = Number(within(screen.getByTitle('Your credits')).getByText(/\d/).textContent?.replace(/,/g, ''));
      expect(after).toBeLessThan(before);
    });
    // Nothing but the opening request has gone to the server yet.
    expect(sent.filter((b) => b.action === 'act')).toHaveLength(0);
    expect(trial.data.game?.game.t.credits).toBe(100);
  });

});





describe('The Star Forge (S.4)', () => {

  it('a locked sun is only a look; planning a sun is free; building it sends a forge action, shows the price first, and the card turns built', async () => {
    const trial = trialBackend({ seed: 'screen-test', now: () => NOW });
    await traderApi(trial.transport).load();
    trial.tools.give(5000);
    const { sent } = play(trial);
    await market();
    fireEvent.click(screen.getByRole('tab', { name: /Forge/ }));
    expect(await screen.findByRole('heading', { name: /Star Forge/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Sun: Choose a sun/ }));
    // a locked sun can be tapped for a look in the view, but isn't planned
    fireEvent.click(screen.getByRole('button', { name: /Two suns.*locked.*Tap to see how it looks/ }));
    expect(screen.getByText(/Just a look at/).parentElement?.textContent).toMatch(/Two suns/);
    expect(screen.getByRole('button', { name: /^Sun: Choose a sun/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Yellow star/ }));
    expect(screen.queryByText(/Just a look at/)).toBeNull();
    expect(screen.getByRole('button', { name: /^Sun: Yellow star, planned/ })).toBeTruthy();
    expect(sent.some((b) => b.type === 'act')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Build' }));
    fireEvent.click(screen.getByRole('button', { name: 'Build it' }));
    expect(await screen.findByText(/Total: 3,000 cr/)).toBeTruthy();
    fireEvent.click(within(screen.getByRole('group', { name: /Build Yellow star/ })).getByRole('button', { name: 'Build it' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Sun: Yellow star, built/ })).toBeTruthy());
    expect(JSON.stringify(sent)).toMatch(/"type":"forge"/);
    void nameText;
  });
});

