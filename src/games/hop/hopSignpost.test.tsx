import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundProvider } from '../../sound';
import { trialBackend, type HopBackend, type HopFinish } from './backend';
import { HopGame, type NextGame } from './HopGame';
import { WORDS } from './words';

// The hops themselves are tested elsewhere: here the round ends the moment it is shown.
vi.mock('./Hops', () => ({ Hops: ({ onDone }: { onDone: (taps: never[]) => void }) => <button type="button" onClick={() => onDone([])}>End round</button> }));

const finish = (over: Partial<HopFinish>): HopFinish => ({ daysDone: 1, lastPadDay: '2026-11-07', padChanged: 0, jar: false, firstRight: 9, step: 2, stepBefore: 2, topSecure: true, ...over });

async function reachFinish(result: HopFinish, nextGame: NextGame | null) {
  const trial = trialBackend({ storageKey: 'signpost' });
  const backend: HopBackend = { ...trial.backend, finish: async () => result };
  render(<SoundProvider><HopGame backend={backend} nextGame={nextGame} /></SoundProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Play' }));
  await userEvent.click(await screen.findByRole('button', { name: 'End round' }));
  await screen.findByRole('button', { name: 'OK' });
}

describe("Hop's finish words (S33)", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('say how the day went, still turn the pad, and never say well done', async () => {
    await reachFinish(finish({ firstRight: 10, topSecure: false }), null);
    expect(screen.getByRole('heading', { name: `${WORDS.how.most} ${WORDS.padTurned('bronze')}` })).toBeTruthy();
    expect(screen.queryByText(WORDS.trickyChip)).toBeNull();
    cleanup();
    await reachFinish(finish({ firstRight: 3, padChanged: null, topSecure: false }), null);
    expect(screen.getByRole('heading', { name: `${WORDS.how.tricky} ${WORDS.doneToday}` })).toBeTruthy();
    expect(screen.getByText(WORDS.trickyChip)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/well done|so good/i);
  });
});
