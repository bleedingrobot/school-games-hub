import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundProvider } from '../../sound';
import { trialBackend, type WekaBackend, type WekaFinish } from './backend';
import { WekaGame } from './WekaGame';
import { WORDS } from './words';

// The goes themselves are tested elsewhere: here the round ends the moment it is shown.
vi.mock('./Goes', () => ({ Goes: ({ onDone }: { onDone: (taps: never[]) => void }) => <button type="button" onClick={() => onDone([])}>End round</button> }));

const finish = (over: Partial<WekaFinish>): WekaFinish => ({ daysDone: 1, lastStoneDay: '2026-11-07', stoneChanged: 0, goldenBasket: false, firstRight: 9, level: 1, levelBefore: 1, ...over });

async function reachFinish(result: WekaFinish) {
  const trial = trialBackend({ storageKey: 'finish-words' });
  const backend: WekaBackend = { ...trial.backend, finish: async () => result };
  render(<SoundProvider><WekaGame backend={backend} /></SoundProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Play' }));
  await userEvent.click(await screen.findByRole('button', { name: 'End round' }));
  await screen.findByRole('button', { name: 'OK' });
}

describe("Weka's finish words (S33)", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('say how the day went, still turn the stone, and never say well done', async () => {
    await reachFinish(finish({ firstRight: 10 }));
    expect(screen.getByRole('heading', { name: `${WORDS.how.most} ${WORDS.stoneTurned('bronze')}` })).toBeTruthy();
    expect(screen.queryByText(WORDS.trickyChip)).toBeNull();
    cleanup();
    await reachFinish(finish({ firstRight: 3, stoneChanged: null, level: 2, levelBefore: 1 }));
    expect(screen.getByRole('heading', { name: `${WORDS.how.tricky} ${WORDS.doneToday}` })).toBeTruthy();
    expect(screen.getByText(WORDS.trickyChip)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/well done|so good/i);
  });
});
