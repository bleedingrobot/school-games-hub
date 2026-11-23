/**
 * The road picker opens a race, Enter starts it, Space jumps (recorded for the server), Escape goes back. The three.js
 * picture is left out (jsdom has no WebGL). (Screen test 1 of the game's 8; the server tests are 2 more.)
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SoundProvider } from '../../sound';
import { CircuitGame } from './CircuitGame';
import { pretendCircuit } from './pretend';

vi.mock('./renderer', () => ({
  createView: () => ({ draw() {}, events() {}, restart() {}, bridgesTo() {}, resize() {}, lower: () => false, dispose() {} }),
}));

let frames: FrameRequestCallback[] = [];
let clock = 0;
const runFrames = (n: number) => act(() => {
  for (let i = 0; i < n; i++) {
    const now = frames;
    frames = [];
    clock += 1000 / 30;
    for (const f of now) f(clock);
  }
});

beforeEach(() => {
  frames = [];
  clock = performance.now();
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f));
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => vi.unstubAllGlobals());

it('a new pupil’s first road is Volt’s guided go, one key at a time; Enter starts, Escape goes back to the roads', async () => {
  const user = userEvent.setup();
  render(<SoundProvider><CircuitGame backend={pretendCircuit({ today: 3 })} /></SoundProvider>);
  expect(await screen.findByText('2 races left today')).toBeTruthy();
  // Only the first road is open.
  expect((screen.getByRole('button', { name: /Clock Speed/ }) as HTMLButtonElement).disabled).toBe(true);

  await user.click(screen.getByRole('button', { name: /Power On/ }));
  expect(await screen.findByRole('button', { name: /GO/ })).toBeTruthy();
  await user.keyboard('{Enter}');
  expect(screen.queryByRole('button', { name: /GO/ })).toBeNull();

  // Volt teaches steering first: speeding up does nothing yet.
  expect(screen.getByText(/Steer left and right with the arrow keys/)).toBeTruthy();
  const speed = () => Number(screen.getByRole('meter', { name: 'Speed' }).getAttribute('aria-valuenow'));
  await user.keyboard('{ArrowUp>}');
  runFrames(12);
  await user.keyboard('{/ArrowUp}');
  expect(speed()).toBe(0);
  await user.keyboard('{ArrowLeft>}');
  runFrames(24);
  await user.keyboard('{/ArrowLeft}');
  // Then speed.
  expect(screen.getByText(/hold the up arrow to speed up/)).toBeTruthy();
  await user.keyboard('{ArrowUp>}');
  runFrames(20);
  await user.keyboard('{/ArrowUp}');
  runFrames(3);
  expect(speed()).toBeGreaterThan(0);
  expect(screen.getByLabelText('Time').textContent).not.toBe('0.0s');

  await user.keyboard('{Escape}');
  expect(await screen.findByRole('heading', { name: 'Circuit Racer' })).toBeTruthy();
});
