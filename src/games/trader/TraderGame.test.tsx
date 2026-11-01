import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

import { traderApi } from '../../data/trader';
import { WATER } from '../../../shared/trader/config';
import { makeGalaxy, startPlanet } from '../../../shared/trader/galaxy';
import { nzDay } from '../../../supabase/functions/trader/handler';
import { TraderGame } from './TraderGame';
import { trialBackend, type Trial } from './trialBackend';

const NOW = Date.UTC(2026, 9, 22, 1, 0, 0);

beforeEach(() => {
  calls.warps = 0;
  calls.scenes = [];
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  HTMLCanvasElement.prototype.toDataURL = (() => '') as never;
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never;
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
  it('opens on a title, then lands on a planet with the market, tabs and the top strip', async () => {
    play(undefined, 'title');
    expect(await screen.findByRole('heading', { name: 'Star Trader' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Start trading' }));
    await market();
    for (const tab of ['Trade', 'Ship', 'Bank', 'Star chart']) expect(screen.getByRole('tab', { name: tab })).toBeTruthy();
    expect(screen.getByLabelText(/jumps left today/)).toBeTruthy();
    expect(calls.scenes.some((s) => s.startsWith('planet:'))).toBe(true);
  });

  it('says so when the teacher has not switched the game on', async () => {
    play(trialBackend({ settings: { enabled: false }, now: () => NOW }));
    expect(await screen.findByText(/not switched on/i)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Market' })).toBeNull();
  });

  it('every button and tab has a name a screen reader can say', async () => {
    play();
    await market();
    for (const b of screen.getAllByRole('button')) expect((b.textContent ?? '').trim() || b.getAttribute('aria-label')).toBeTruthy();
  });

  it('a trade is sent with the next jump, not on its own, and the server saves it', async () => {
    const { trial, sent } = play();
    await market();
    const hud = screen.getByTitle('Your credits');
    const before = Number(within(hud).getByText(/\d/).textContent?.replace(/,/g, ''));
    const row = screen.getAllByRole('row').find((r) => within(r).queryByLabelText(/^Buy one Water$/));
    if (!row) throw new Error('no water row');
    fireEvent.click(within(row).getByLabelText('Buy one Water'));
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    // A maths check can come up; skip it.
    const skip = screen.queryByText('No thanks');
    if (skip) fireEvent.click(skip);
    await waitFor(() => {
      const after = Number(within(screen.getByTitle('Your credits')).getByText(/\d/).textContent?.replace(/,/g, ''));
      expect(after).toBeLessThan(before);
    });
    // Nothing but the opening request has gone to the server yet.
    expect(sent.filter((b) => b.action === 'act')).toHaveLength(0);
    expect(trial.data.game?.game.t.credits).toBe(100);
  });

  it('after a trade the picked numbers clear, so Buy max works again (it used to fail silently on an old "sell")', async () => {
    play();
    await market();
    const row = () => screen.getAllByRole('row').find((r) => within(r).queryByLabelText(/^Buy one Water$/)) as HTMLElement;
    fireEvent.click(within(row()).getByLabelText('Buy one Water'));
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const skip = screen.queryByText('No thanks');
    if (skip) fireEvent.click(skip);
    await waitFor(() => expect(screen.getByLabelText('Water: none')).toBeTruthy());
    // Sell the one Water, then buy as many as fit: both work straight after the first trade.
    fireEvent.click(within(row()).getByLabelText('Sell all Water'));
    expect(screen.getByLabelText('Water: selling 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const skip2 = screen.queryByText('No thanks');
    if (skip2) fireEvent.click(skip2);
    await waitFor(() => expect(screen.getByLabelText('Water: none')).toBeTruthy());
    fireEvent.click(within(row()).getByLabelText('Buy as many Water as you can'));
    expect(screen.getByLabelText(/^Water: buying \d+$/)).toBeTruthy();
  });

  it('Buy max says why when it cannot add even one', async () => {
    const trial = trialBackend({ seed: 'screen-test', now: () => NOW });
    await traderApi(trial.transport).load();
    trial.tools.give(-100);
    play(trial);
    await market();
    const row = screen.getAllByRole('row').find((r) => within(r).queryByLabelText(/^Buy one Water$/)) as HTMLElement;
    fireEvent.click(within(row).getByLabelText('Buy as many Water as you can'));
    expect(await screen.findByText('You cannot afford that.')).toBeTruthy();
  });

  /** Every planet's chart coordinates, read from the buttons' names. */
  function planetsOnChart() {
    return screen.getAllByRole('button', { name: /, x -?\d+, y -?\d+/ }).map((button) => {
      const m = /^(\w+), x (-?\d+), y (-?\d+)/.exec(button.getAttribute('aria-label') ?? '') as RegExpExecArray;
      return { name: m[1], x: m[2], y: m[3], here: /you are here/.test(button.getAttribute('aria-label') ?? ''), button };
    });
  }
  const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it('jumps by typing the coordinates of a planet; the server works out the fuel and the jump', async () => {
    const { trial, sent } = play();
    await market();
    fireEvent.click(screen.getByRole('tab', { name: 'Star chart' }));
    expect(screen.queryByText('Show me')).toBeNull();
    let jumped = false;
    for (const p of planetsOnChart().filter((q) => !q.here)) {
      type(/^x \(across\)/, p.x);
      type(/^y \(up\)/, p.y);
      if (!(screen.getByRole('button', { name: /^Jump!/ }) as HTMLButtonElement).disabled) {
        expect(screen.getByText(/It needs/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /^Jump!/ }));
        jumped = true;
        break;
      }
    }
    expect(jumped).toBe(true);
    await waitFor(() => expect(calls.warps).toBe(1));
    await waitFor(() => expect(trial.data.game?.game.t.jumpsLeft).toBe(9));
    expect(sent.filter((b) => b.action === 'act')).toHaveLength(1);
    await waitFor(() => expect(screen.getByLabelText(/jumps left today/).getAttribute('aria-label')).toMatch(/^[0-9] of 10/));
  });

  it('an empty spot, or a wrong number, says so and never jumps; it says which number to check once a planet has been read', async () => {
    play();
    await market();
    fireEvent.click(screen.getByRole('tab', { name: 'Star chart' }));
    const planets = planetsOnChart();
    const there = new Set(planets.map((p) => `${p.x},${p.y}`));
    const jump = () => screen.getByRole('button', { name: /^Jump!/ }) as HTMLButtonElement;
    expect(jump().disabled).toBe(true);
    const p = planets.find((q) => !q.here) as (typeof planets)[number];
    fireEvent.click(p.button);
    const wrongY = [-10, -9, -8, 1, 2, 3, 4].map(String).find((y) => !there.has(`${p.x},${y}`) && y !== p.y) as string;
    type(/^x \(across\)/, p.x);
    type(/^y \(up\)/, wrongY);
    expect(screen.getByText(/nothing at that spot/i)).toBeTruthy();
    expect(screen.getByText(new RegExp(`Check y for ${p.name}`))).toBeTruthy();
    expect(jump().disabled).toBe(true);
    type(/^x \(across\)/, '99');
    expect(screen.getByText(/whole numbers from/i)).toBeTruthy();
  });

  it('the plus/minus button flips a number, so a phone with no minus key can still type a negative', async () => {
    play();
    await market();
    fireEvent.click(screen.getByRole('tab', { name: 'Star chart' }));
    type(/^x \(across\)/, '4');
    fireEvent.click(screen.getByRole('button', { name: /Make x \(across\) negative or positive/ }));
    expect((screen.getByLabelText(/^x \(across\)/) as HTMLInputElement).value).toBe('-4');
    fireEvent.click(screen.getByRole('button', { name: /Make x \(across\) negative or positive/ }));
    expect((screen.getByLabelText(/^x \(across\)/) as HTMLInputElement).value).toBe('4');
  });

  it('a pirate fight in progress is shown on opening (so a reload keeps it) and a round goes to the server', async () => {
    const trial = trialBackend({ seed: 'screen-test', now: () => NOW });
    const api = traderApi(trial.transport);
    // Make a game and put it in a fight, as the server would have kept it.
    await api.load();
    trial.tools.setShip(3);
    trial.tools.forcePirates(0);
    const sent: Record<string, unknown>[] = [];
    render(<TraderGame api={traderApi(async (b, o) => (sent.push(b), trial.transport(b, o)))} startAt="planet" />);
    expect(await screen.findByRole('heading', { name: /attack/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Raise shields/ }));
    await waitFor(() => expect(sent.some((b) => b.action === 'fight' && b.move === 'shield')).toBe(true));
    await act(async () => {});
    await waitFor(() => expect(screen.getByRole('meter', { name: /Your hull/ })).toBeTruthy());
  });

  it('shows the school news and which prices the school has moved when you land', async () => {
    const trial = trialBackend({ seed: 'screen-test', now: () => NOW });
    const here = startPlanet(makeGalaxy('screen-test'));
    // The whole school sold lots of Water here today.
    for (let i = 0; i < 40; i++) trial.data.market.apply(nzDay(NOW), [[here, WATER, -10_000]], 5);
    play(trial);
    await market();
    expect(await screen.findByText(/Lots of traders sold Water on .*, so it's cheap there today\./, { selector: '.st-news' })).toBeTruthy();
    expect(screen.getByText('📉 lots sold')).toBeTruthy();
    expect(screen.getByText(/School news \(\d+\)/)).toBeTruthy();
  });

  it('shows where each good sells best, and a planet\'s prices with the profit on its star chart card', async () => {
    play();
    await market();
    expect((await screen.findAllByText(/^Sells best: \w+ \d+/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\(\+\d+ each\)/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: 'Star chart' }));
    const planets = await screen.findAllByRole('button', { pressed: false });
    fireEvent.click(planets.find((b) => b.className.includes('st-planet') && !b.className.includes('st-planet--here'))!);
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Profit each' })).toBeTruthy();
    expect(within(table).getAllByRole('row')).toHaveLength(11);
  });
});
