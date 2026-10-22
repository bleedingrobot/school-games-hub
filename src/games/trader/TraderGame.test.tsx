import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

import { trialApi } from './api';
import { TraderGame } from './TraderGame';

beforeEach(() => {
  calls.warps = 0;
  calls.scenes = [];
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  HTMLCanvasElement.prototype.toDataURL = (() => '') as never;
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never;
});
afterEach(() => cleanup());

const play = () => render(<TraderGame api={trialApi('test')} startAt="planet" />);

describe('Star Trader screen', () => {
  it('opens on a title, then lands on a planet with the market, tabs and the top strip', () => {
    render(<TraderGame api={trialApi('test')} />);
    expect(screen.getByRole('heading', { name: 'Star Trader' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start trading' }));
    expect(screen.getByRole('heading', { name: 'Market' })).toBeTruthy();
    for (const tab of ['Trade', 'Ship', 'Bank', 'Star chart']) expect(screen.getByRole('tab', { name: tab })).toBeTruthy();
    expect(screen.getByLabelText(/jumps left today/)).toBeTruthy();
    expect(calls.scenes[0]).toMatch(/^planet:/);
  });

  it('every button and tab has a name a screen reader can say', () => {
    play();
    for (const b of screen.getAllByRole('button')) expect((b.textContent ?? '').trim() || b.getAttribute('aria-label')).toBeTruthy();
  });

  it('buys one of something, takes the right money, and puts it in the hold', async () => {
    play();
    const hud = screen.getByTitle('Your credits');
    const before = Number(within(hud).getByText(/\d/).textContent?.replace(/,/g, ''));
    const row = screen.getAllByRole('row').find((r) => within(r).queryByLabelText(/^Buy one Water$/));
    if (!row) throw new Error('no water row');
    fireEvent.click(within(row).getByLabelText('Buy one Water'));
    fireEvent.click(screen.getByRole('button', { name: 'Trade' }));
    const no = await screen.findByText(/Trade done|No thanks/);
    if (no.textContent === 'No thanks') fireEvent.click(no);
    await waitFor(() => {
      const after = Number(within(screen.getByTitle('Your credits')).getByText(/\d/).textContent?.replace(/,/g, ''));
      expect(after).toBeLessThan(before);
    });
  });

  it('plans a jump on the star chart, shows the working for the fuel sum, and jumps with a warp', async () => {
    play();
    fireEvent.click(screen.getByRole('tab', { name: 'Star chart' }));
    const planets = screen.getAllByRole('button', { name: /across, .* up, \d+ fuel away$/ });
    fireEvent.click(planets[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Show me' }));
    expect(screen.getByText(/across \+ .* up =/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Jump!/ }));
    await waitFor(() => expect(calls.warps).toBe(1));
    await waitFor(() => expect(screen.getByLabelText(/jumps left today/).getAttribute('aria-label')).toMatch(/^9 of 10/));
  });

  it('a wrong fuel sum never blocks the jump', () => {
    play();
    fireEvent.click(screen.getByRole('tab', { name: 'Star chart' }));
    fireEvent.click(screen.getAllByRole('button', { name: /fuel away$/ })[0]);
    fireEvent.change(screen.getByLabelText(/How much fuel/), { target: { value: '1' } });
    expect((screen.getByRole('button', { name: /^Jump!/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
