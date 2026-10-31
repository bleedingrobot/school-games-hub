import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { botSetup, chooseForRun } from '../../../shared/archery/bot';
import { startFight, takeShot } from '../../../shared/archery/fight';
import { START_COINS } from '../../../shared/archery/shop';
import { markQuestion } from '../../../shared/archery/speed';
import type { PlayerSetup, Shot, WorldId } from '../../../shared/archery/types';

// The fight itself is a stand-in with two buttons, so a test can end a fight or a round at once; the loot chest and
// the restock over it are the real game, on the trial server (which checks the fight like the real one).
vi.mock('./FightScreen', () => ({
  FightScreen: ({ world, level, seed, pack, onFinished, onRoundOver }: {
    world: WorldId; level: 'easy' | 'medium' | 'hard'; seed: number; pack: PlayerSetup;
    onFinished: (shots: Shot[]) => Promise<unknown>; onRoundOver: (played: number) => void;
  }) => (
    <div>
      <h2 id="ar-fight-title" tabIndex={-1}>Pretend fight</h2>
      <button type="button" onClick={() => onRoundOver(1)}>End round 1</button>
      <button
        type="button"
        onClick={() => {
          const run = startFight(seed, { world, players: [pack, botSetup(level)] });
          const shots: Shot[] = [];
          while (run.winner === null) {
            const shot = chooseForRun(run, run.round.turn === 0 ? 'hard' : level).shot;
            takeShot(run, shot);
            shots.push(shot);
          }
          void onFinished(shots);
        }}
      >
        End the fight
      </button>
    </div>
  ),
}));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));

const { ArcheryGame } = await import('./ArcheryGame');
const { archeryApi } = await import('../../data/archery');
const { trialBackend } = await import('./trialBackend');

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('the game must only talk through its api'))));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Opens the game on the trial server and starts a (pretend) fight. */
async function inFight() {
  const trial = trialBackend();
  render(<ArcheryGame api={archeryApi((b) => trial.send(b))} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Forest' }));
  fireEvent.click(await screen.findByRole('button', { name: /Hawk/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: pack your quiver' }));
  // The supply chest comes first: skip it straight to packing.
  await screen.findByRole('heading', { name: 'Supply chest' });
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Fight!' }));
  await screen.findByRole('button', { name: 'End the fight' });
  return trial;
}

/** Answers the question on screen (the server's own marking is read from the trial data). */
async function answer(trial: Awaited<ReturnType<typeof inFight>>, slot: number, seed: string) {
  await screen.findByRole('dialog', { name: new RegExp(`^Question ${slot + 1} of 3$`) });
  const right = markQuestion(trial.data.rounds[seed].questions[slot])!.answer;
  for (const key of [...String(right), 'Enter']) {
    await act(async () => {
      fireEvent.keyDown(document.querySelector('.question')!, { key });
    });
  }
}

describe('the loot chest and the restock over a bot fight', () => {
  it('opens a loot chest when the fight is saved, and pays 20 a right for a win or 10 for a loss, plus the streak bonus', async () => {
    const trial = await inFight();
    fireEvent.click(screen.getByRole('button', { name: 'End the fight' }));
    expect(await screen.findByRole('heading', { name: 'Loot chest' })).toBeTruthy();
    const fight = Object.values(trial.data.fights)[0];
    expect(fight.status).toBe('done');
    const per = fight.won ? 20 : 10;
    expect(screen.getByText(new RegExp(`Fill your chest: 3 questions, ${per} coins for each one right!`))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open the chest' }));
    const seed = await waitFor(() => {
      const s = Object.keys(trial.data.rounds)[0];
      expect(s).toBeTruthy();
      return s;
    });
    expect(trial.data.rounds[seed].kind).toBe('chest');
    for (let slot = 0; slot < 3; slot++) {
      await answer(trial, slot, seed);
      await waitFor(() => expect(trial.data.rounds[seed].answered[String(slot)]).toBeTruthy());
    }
    expect(trial.data.pupils['preview-pupil'].coins).toBe(START_COINS + 3 * per + 5);
    expect(await screen.findByText(new RegExp(`You got 3 of 3 right and earned ${3 * per + 5} coins`))).toBeTruthy();
  }, 20_000);

  it('closes the chest on Skip, with no questions asked and no coins, leaving the fight screen underneath', async () => {
    const trial = await inFight();
    fireEvent.click(screen.getByRole('button', { name: 'End the fight' }));
    await screen.findByRole('heading', { name: 'Loot chest' });
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Loot chest' })).toBeNull());
    expect(screen.getByRole('button', { name: 'End the fight' })).toBeTruthy();
    expect(Object.keys(trial.data.rounds)).toEqual([]);
    expect(trial.data.pupils['preview-pupil'].coins).toBe(START_COINS);
  });

  it('shows a restock between rounds, paying 10 a right, and Skip goes back to the fight', async () => {
    const trial = await inFight();
    fireEvent.click(screen.getByRole('button', { name: 'End round 1' }));
    expect(await screen.findByRole('heading', { name: 'Restock' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    const seed = await waitFor(() => {
      const s = Object.keys(trial.data.rounds)[0];
      expect(s).toBeTruthy();
      return s;
    });
    expect(trial.data.rounds[seed]).toMatchObject({ kind: 'restock', perRight: 10 });
    for (let slot = 0; slot < 3; slot++) {
      await answer(trial, slot, seed);
      await waitFor(() => expect(trial.data.rounds[seed].answered[String(slot)]).toBeTruthy());
    }
    expect(trial.data.pupils['preview-pupil'].coins).toBe(START_COINS + 35);
    // Another round ending is a new restock; its Skip leaves it unopened.
    cleanup();
    const second = await inFight();
    fireEvent.click(screen.getByRole('button', { name: 'End round 1' }));
    await screen.findByRole('heading', { name: 'Restock' });
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Restock' })).toBeNull());
    expect(Object.keys(second.data.rounds)).toEqual([]);
  }, 20_000);

  it('shows a goal to save up for under the speed round button', async () => {
    const trial = trialBackend();
    render(<ArcheryGame api={archeryApi((b) => trial.send(b))} />);
    expect(await screen.findByText(/25 more coins for the Hunter's Bow/)).toBeTruthy();
  });
});

describe('the supply chest before a bot fight', () => {
  it('comes after picking the fight, pays 10 a right answer, then goes on to packing', async () => {
    const trial = trialBackend();
    render(<ArcheryGame api={archeryApi((b) => trial.send(b))} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Forest' }));
    fireEvent.click(await screen.findByRole('button', { name: /Hawk/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: pack your quiver' }));
    await screen.findByRole('heading', { name: 'Supply chest' });
    fireEvent.click(screen.getByRole('button', { name: 'Open the chest' }));
    await screen.findByRole('dialog', { name: /^Question 1 of 3$/ });
    const round = Object.values(trial.data.rounds)[0];
    expect(round).toMatchObject({ kind: 'supply', perRight: 10 });
  });
});
