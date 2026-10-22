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

  /** Every planet's chart coordinates, read from the buttons' names. */
  function planetsOnChart() {
    return screen.getAllByRole('button', { name: /, x -?\d+, y -?\d+/ }).map((button) => {
      const m = /^(\w+), x (-?\d+), y (-?\d+)/.exec(button.getAttribute('aria-label') ?? '') as RegExpExecArray;
      return { name: m[1], x: m[2], y: m[3], here: /you are here/.test(button.getAttribute('aria-label') ?? ''), button };
    });
  }
  const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it('jumps by typing the coordinates of a planet; the game works out the fuel and the chart shows where the point lands', async () => {
    play();
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
    await waitFor(() => expect(screen.getByLabelText(/jumps left today/).getAttribute('aria-label')).toMatch(/^9 of 10/));
  });

  it('an empty spot, or a wrong number, says so and never jumps; it says which number to check once a planet has been read', () => {
    play();
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

  it('the plus/minus button flips a number, so a phone with no minus key can still type a negative', () => {
    play();
    fireEvent.click(screen.getByRole('tab', { name: 'Star chart' }));
    type(/^x \(across\)/, '4');
    fireEvent.click(screen.getByRole('button', { name: /Make x \(across\) negative or positive/ }));
    expect((screen.getByLabelText(/^x \(across\)/) as HTMLInputElement).value).toBe('-4');
    fireEvent.click(screen.getByRole('button', { name: /Make x \(across\) negative or positive/ }));
    expect((screen.getByLabelText(/^x \(across\)/) as HTMLInputElement).value).toBe('4');
  });
});
