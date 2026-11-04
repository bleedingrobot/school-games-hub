import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./loadViewer', () => ({ loadViewer: async () => null }));

import { FriendlyError } from '../../../data/profile';
import { pieceName, type SystemDesign } from '../../../../shared/trader/system';
import { PRETEND_CLASSMATES } from '../trialClassmates';
import { ProjectorTour, TOUR_SECONDS } from './ProjectorTour';

const designs: SystemDesign[] = PRETEND_CLASSMATES.slice(0, 3).map((c) => c.design);
const nameOf = (d: SystemDesign) => `The ${pieceName(d)} System`;

beforeEach(() => {
  vi.useFakeTimers();
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never;
  HTMLElement.prototype.requestFullscreen = (() => Promise.resolve()) as never;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function start(load: (id: string) => Promise<SystemDesign[]>, onClose = vi.fn()) {
  render(<ProjectorTour classId="class-1" onClose={onClose} load={load} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  return onClose;
}
const heading = () => screen.getByRole('heading', { level: 2 }).textContent;

describe('The teacher projector tour', () => {
  it('shows each system name big, in order, with "n of m"', async () => {
    await start(async () => designs);
    expect(heading()).toBe(nameOf(designs[0]));
    expect(screen.getByText('1 of 3')).toBeTruthy();
  });

  it('Next moves on, and goes round again after the last', async () => {
    await start(async () => designs);
    fireEvent.click(screen.getByRole('button', { name: 'Next ▶' }));
    expect(heading()).toBe(nameOf(designs[1]));
    expect(screen.getByText('2 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next ▶' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next ▶' }));
    expect(heading()).toBe(nameOf(designs[0]));
  });

  it('moves on by itself after a minute', async () => {
    await start(async () => designs);
    await act(async () => { await vi.advanceTimersByTimeAsync((TOUR_SECONDS - 1) * 1000); });
    expect(heading()).toBe(nameOf(designs[0]));
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(heading()).toBe(nameOf(designs[1]));
    expect(screen.getByText('2 of 3')).toBeTruthy();
  });

  it('Skip leaves one out, and after skipping all it says so', async () => {
    await start(async () => designs);
    fireEvent.click(screen.getByRole('button', { name: 'Skip this one' }));
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(heading()).toBe(nameOf(designs[1]));
    fireEvent.click(screen.getByRole('button', { name: 'Skip this one' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip this one' }));
    expect(screen.getByText(/That was every system/)).toBeTruthy();
    expect(screen.queryByText(/of \d+$/)).toBeNull();
  });

  it('Stop and Esc both close it', async () => {
    const onClose = await start(async () => designs);
    fireEvent.click(screen.getByRole('button', { name: /^Stop/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('says so when nobody has built a sun', async () => {
    await start(async () => []);
    expect(screen.getByText('Nobody in this class has built a sun yet.')).toBeTruthy();
  });

  it('shows the message when the systems cannot be loaded', async () => {
    await start(async () => { throw new FriendlyError('We couldn’t load the class’s systems.'); });
    expect(screen.getByText('We couldn’t load the class’s systems.')).toBeTruthy();
  });

  it('only gets the class id and shows designs, never pupils’ names', async () => {
    const load = vi.fn(async (_id: string) => designs);
    await start(load);
    expect(load).toHaveBeenCalledWith('class-1');
    for (const c of PRETEND_CLASSMATES) expect(document.body.textContent).not.toContain(c.name);
  });
});
