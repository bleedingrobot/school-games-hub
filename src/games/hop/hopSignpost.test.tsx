import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { penguinPairs } from '../korora';
import { SoundProvider } from '../../sound';
import { trialBackend, type HopBackend, type HopFinish } from './backend';
import { HopGame, type NextGame } from './HopGame';
import { WORDS } from './words';

// The hops themselves are tested elsewhere: here the round ends the moment it is shown.
vi.mock('./Hops', () => ({ Hops: ({ onDone }: { onDone: (taps: never[]) => void }) => <button type="button" onClick={() => onDone([])}>End round</button> }));

const finish = (over: Partial<HopFinish>): HopFinish => ({ daysDone: 1, lastPadDay: '2026-11-07', padChanged: 0, jar: false, step: 2, stepBefore: 2, topSecure: true, ...over });

async function reachFinish(result: HopFinish, nextGame: NextGame | null) {
  const trial = trialBackend({ storageKey: 'signpost' });
  const backend: HopBackend = { ...trial.backend, finish: async () => result };
  render(<SoundProvider><HopGame backend={backend} nextGame={nextGame} /></SoundProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Play' }));
  await userEvent.click(await screen.findByRole('button', { name: 'End round' }));
  await screen.findByRole('button', { name: 'OK' });
}

describe("Hop's signpost on to Penguin Pairs (R8)", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('shows the card only when the twos are secure and Penguin Pairs is on, and a tap opens Penguin Pairs', async () => {
    const open = vi.fn();
    const nextGame = { name: WORDS.signpostGame, Icon: penguinPairs.Icon, open };
    await reachFinish(finish({ topSecure: false }), nextGame);
    expect(screen.queryByText(WORDS.signpost)).toBeNull();
    cleanup();
    await reachFinish(finish({}), null);
    expect(screen.queryByText(WORDS.signpost)).toBeNull();
    cleanup();
    await reachFinish(finish({ stepBefore: 5 }), nextGame); // just moved up: the step-up news comes first
    expect(screen.queryByText(WORDS.signpost)).toBeNull();
    cleanup();
    await reachFinish(finish({}), nextGame);
    await userEvent.click(screen.getByRole('button', { name: WORDS.signpost }));
    expect(open).toHaveBeenCalledTimes(1);
  });
});
