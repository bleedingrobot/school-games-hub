import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SoundProvider } from '../../sound';
import { BonkersGame } from './BonkersGame';
import { trialBackend } from './trial';

// Bonkers Quest's screens on the trial backend (the same rules as the server).
const play = (key: string) => {
  const trial = trialBackend({ storageKey: key });
  trial.tools.reset();
  render(<SoundProvider><BonkersGame backend={trial.backend} /></SoundProvider>);
  return trial;
};

describe('Bonkers Quest screens', () => {
  it('picks a hero, shows the inn with two quests, and a quest starts a fight with a special move', async () => {
    play('bq-test-1');
    fireEvent.click(await screen.findByRole('button', { name: /Pirate Granny/ }));
    fireEvent.click(screen.getByRole('button', { name: /Be the Pirate Granny!/ }));
    expect(await screen.findByText('Today’s quests')).toBeInTheDocument();
    const quests = screen.getAllByRole('button', { name: /Go!/ });
    expect(quests).toHaveLength(2);
    fireEvent.click(quests[0]);
    expect(await screen.findByRole('button', { name: /Bonk it!/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wool Whirlwind/ })).toBeEnabled();
    expect(screen.getByLabelText('3 of 3 hearts')).toBeInTheDocument();
  });

  it('the server marks the answer, then the bonk lands (a wrong one costs a heart)', async () => {
    play('bq-test-2');
    fireEvent.click(await screen.findByRole('button', { name: /Kitchen Knight/ }));
    fireEvent.click(screen.getByRole('button', { name: /Be the Kitchen Knight!/ }));
    fireEvent.click((await screen.findAllByRole('button', { name: /Go!/ }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: /Bonk it!/ }));
    const dialog = await screen.findByRole('dialog');
    // The answer the server marked is shown after; pick a choice and see what happens.
    const choices = dialog.querySelectorAll('button');
    fireEvent.click(choices[choices.length - 1]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 8000 });
    const hearts = screen.getByLabelText(/of 3 hearts/).getAttribute('aria-label');
    const line = screen.getByText(/BONK!|little bonk/).textContent ?? '';
    expect(line.includes('little bonk') ? hearts === '2 of 3 hearts' : hearts === '3 of 3 hearts').toBe(true);
  }, 15_000);
});
