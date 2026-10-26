import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { findBondSet } from '../../../shared/bond-match/bonds';
import { buildDeck, type BoardSize } from '../../../shared/bond-match/deck';
import { newGame } from '../../../shared/bond-match/engine';
import { perfectFlips } from '../../../shared/bond-match/perfectPlayer';
import type { BondMatchSaver } from '../../data/bondMatch';
import type { SaveResult } from '../../../shared/bond-match/save';
import { SoundProvider } from '../../sound';
import { BondMatchPlay } from './BondMatchPlay';

const SEED = 7;

function setup(props: { saver?: BondMatchSaver; makeRunId?: () => string } = {}) {
  render(
    <SoundProvider>
      <BondMatchPlay makeSeed={() => SEED} finishMs={0} mismatchMs={60_000} saver={props.saver} makeRunId={props.makeRunId} />
    </SoundProvider>,
  );
}

const card = (n: number) => screen.getByRole('button', { name: new RegExp(`^card ${n + 1},`) });
const deckFor = (id: string, size: BoardSize) => buildDeck(findBondSet(id)!, size, SEED);

function pick(label: string, size: string) {
  fireEvent.click(screen.getByRole('button', { name: size }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}, `) }));
}

describe('a game of Bond Match', () => {
  it('plays a whole game to gold stars and sends the server the game itself, not the stars', async () => {
    const save = vi.fn(async (): Promise<SaveResult> => ({ status: 'saved', points: 2, stars: 3, best: { flips: 6, seconds: 5, stars: 3 } }));
    const saver = { save, loadBests: vi.fn(async () => []) } as unknown as BondMatchSaver;
    setup({ saver, makeRunId: () => 'run-1' });
    pick('To 10', 'Small');
    const flips = perfectFlips(newGame(deckFor('whole-10', 'small')));
    for (const i of flips) fireEvent.click(card(i));
    expect(await screen.findByRole('heading', { name: 'All matched!' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Gold: 3 stars' })).toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(1);
    const sent = (save.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(sent).toMatchObject({ runId: 'run-1', seed: SEED, bondId: 'whole-10', size: 'small', flips, mode: 'solo' });
    expect(Object.keys(sent).sort()).toEqual(['bondId', 'flips', 'mode', 'runId', 'seconds', 'seed', 'size']);
  });
});
