import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shot } from '../../../shared/archery/types';

// A stand-in picture (the real one draws on a canvas, which this test browser doesn't have) that
// records what the screen tells it, and a bot that always lobs the same shot.
const calls: { aims: [number, number, number][]; shots: number; rounds: number } = { aims: [], shots: 0, rounds: 0 };
vi.mock('./renderer', () => ({
  createFightView: () => ({
    setRound: () => { calls.rounds++; },
    setAim: (p: number, angle: number, pull: number) => { calls.aims.push([p, angle, pull]); },
    aimTo: async () => {},
    setTurn: () => {},
    playShot: async () => { calls.shots++; },
    celebrate: () => {},
    resize: () => {},
    setOptions: () => {},
    archerOnScreen: () => ({ x: 100, y: 300 }),
    stats: () => ({ fps: 60, frameMs: 1, quality: 'full', pixelRatio: 1, particles: 0, slowSwitches: 0 }),
    dispose: () => {},
  }),
}));
const botShot: Shot = { angle: 120, power: 20, arrow: 'plain' };
vi.mock('./botThread', () => ({
  startArcheryBot: () => ({ decide: async () => botShot, close: () => {} }),
}));

const { FightScreen } = await import('./FightScreen');

beforeEach(() => {
  calls.aims = [];
  calls.shots = 0;
  calls.rounds = 0;
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('the preview must never call a server'))));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the fight screen', () => {
  it('starts on your turn with plain numbers, and keys change them', async () => {
    render(<FightScreen world="forest" level="easy" seed={42} onExit={() => {}} />);
    await screen.findByText('Your turn', {}, { timeout: 4000 });
    expect(screen.getByText('55°')).toBeTruthy();
    expect(screen.getByText('60')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowUp', shiftKey: true });
    expect(screen.getByText('56°')).toBeTruthy();
    expect(screen.getByText('65')).toBeTruthy();
    // The archer's pose follows the angle; nothing else is sent to the picture.
    await waitFor(() => expect(calls.aims.at(-1)).toEqual([0, 56, 0.15]));
  });

  it('shoots, then the bot takes its turn, then it is your turn again', async () => {
    render(<FightScreen world="desert" level="medium" seed={7} onExit={() => {}} />);
    await screen.findByText('Your turn', {}, { timeout: 4000 });
    fireEvent.click(screen.getByRole('button', { name: 'Shoot' }));
    await waitFor(() => expect(calls.shots).toBe(2), { timeout: 4000 });
    await screen.findByText('Your turn', {}, { timeout: 4000 });
    expect(document.querySelector('.ar-toast')?.textContent ?? '').not.toMatch(/can't/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('picks a special arrow from the picker, uses it up, and shows how many are left', async () => {
    const pack = { quiver: { steel: 4, rain: 1 }, shield: null, bow: 'starter' as const };
    render(<FightScreen world="city" level="easy" seed={3} pack={pack} onExit={() => {}} />);
    await screen.findByText('Your turn', {}, { timeout: 4000 });
    expect(screen.getByLabelText('5 special arrows left')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Choose another arrow/ }));
    await waitFor(() => expect(document.activeElement?.id).toBe('ar-picker-title'));
    fireEvent.click(screen.getByRole('button', { name: /Steel Arrow 4 left/ }));
    expect(screen.getByRole('button', { name: /Arrow: Steel Arrow, 4 left/ })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shoot' }));
    });
    await waitFor(() => expect(screen.getByLabelText('4 special arrows left')).toBeTruthy());
    // Arrows not packed aren't offered.
    await screen.findByText('Your turn', {}, { timeout: 4000 });
    fireEvent.click(screen.getByRole('button', { name: /Choose another arrow/ }));
    expect(screen.queryByRole('button', { name: /Giant Arrow/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Arrow Rain 1 left/ })).toBeTruthy();
  });

  it('eats an Apple with a shot when you are hurt', async () => {
    const pack = { quiver: { apple: 2 }, shield: 'wood' as const, bow: 'hunter' as const };
    render(<FightScreen world="forest" level="easy" seed={5} pack={pack} onExit={() => {}} />);
    await screen.findByText('Your turn', {}, { timeout: 4000 });
    // Full health: no Apple yet.
    expect(screen.getByRole('button', { name: /Eat an Apple/ }).hasAttribute('disabled')).toBe(true);
    // The Wooden Shield shows, and the Hunter's Bow shows next round's wind.
    expect(screen.getByRole('meter', { name: 'Your Wooden Shield' })).toBeTruthy();
    expect(screen.getByText(/from your Hunter's Bow/)).toBeTruthy();
  });

  it('opens settings with simpler graphics and less motion, and remembers them', async () => {
    render(<FightScreen world="snow" level="hard" seed={1} onExit={() => {}} />);
    await screen.findByText('Your turn', {}, { timeout: 4000 });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const simple = screen.getByLabelText(/Simpler graphics/);
    fireEvent.click(simple);
    expect(JSON.parse(localStorage.getItem('archery-prefs-v1')!).simple).toBe(true);
    await waitFor(() => expect(document.activeElement?.id).toBe('ar-settings-title'));
  });
});
