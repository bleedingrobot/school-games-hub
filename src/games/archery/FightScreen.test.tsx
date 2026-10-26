import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  // Less motion keeps the pauses between shots short.
  localStorage.setItem('archery-prefs-v1', JSON.stringify({ lessMotion: true }));
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('the preview must never call a server'))));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the fight screen', () => {
  it('shoots, then the bot takes its turn, then it is your turn again', async () => {
    render(<FightScreen world="desert" level="medium" seed={7} onExit={() => {}} />);
    await screen.findByText('Your turn', {}, { timeout: 4000 });
    fireEvent.click(screen.getByRole('button', { name: 'Shoot' }));
    await waitFor(() => expect(calls.shots).toBe(2), { timeout: 4000 });
    await screen.findByText('Your turn', {}, { timeout: 4000 });
    expect(document.querySelector('.ar-toast')?.textContent ?? '').not.toMatch(/can't/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
