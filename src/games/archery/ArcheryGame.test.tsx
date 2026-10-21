import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markQuestion } from '../../../shared/archery/speed';

// The fight's picture is a stand-in (no canvas here); everything else is the real game on the trial server, with the
// real bots (the server checks every bot shot).
vi.mock('./renderer', () => ({
  createFightView: () => ({
    setRound: () => {}, setAim: () => {}, aimTo: async () => {}, setTurn: () => {}, playShot: async () => {}, celebrate: () => {},
    resize: () => {}, setOptions: () => {}, archerOnScreen: () => ({ x: 100, y: 300 }),
    stats: () => ({ fps: 60, frameMs: 1, quality: 'full', pixelRatio: 1, particles: 0, slowSwitches: 0 }), dispose: () => {},
  }),
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

function setup(opts: Parameters<typeof trialBackend>[0] = {}) {
  const trial = trialBackend(opts);
  const api = archeryApi((b) => trial.send(b));
  render(<ArcheryGame api={api} />);
  return trial;
}

describe('Archery Challenge', () => {
  it('opens on the home screen with the pupil\'s buttons', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: /Archery/ })).toBeTruthy();
    for (const name of ['Forest', 'Desert', 'Snow', 'City', 'Play', 'More Bows', 'Armory', 'How to play']) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Earn coins: speed round/ })).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.id).toBe('ar-home-title'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('says so when the game is switched off', async () => {
    setup({ enabled: () => false });
    expect(await screen.findByRole('heading', { name: 'Archery Challenge is closed' })).toBeTruthy();
  });

  it('plays a speed round and earns coins for right answers', async () => {
    const trial = setup();
    fireEvent.click(await screen.findByRole('button', { name: /Earn coins: speed round/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    for (let slot = 0; slot < 2; slot++) {
      await screen.findByRole('dialog', { name: `Question ${slot + 1} of 10` });
      const round = Object.values(trial.data.rounds)[0];
      const answer = markQuestion(round.questions[slot])!.answer;
      for (const key of [...String(answer), 'Enter']) {
        await act(async () => {
          fireEvent.keyDown(document.querySelector('.question')!, { key });
        });
      }
      await waitFor(() => expect(trial.data.pupils['preview-pupil'].coins).toBe(10 * (slot + 1)));
    }
    expect(screen.getAllByText(/20/).length).toBeGreaterThan(0);
  });

  it('buys in the Armory, packs the quiver, and starts a fight from the server\'s seed', async () => {
    const trial = setup();
    await screen.findByRole('heading', { name: /Archery/ });
    trial.data.pupils['preview-pupil'] = { coins: 300, gear: {}, shields: [], bows: [], spent: 0, best: {}, rounds: [] };
    fireEvent.click(screen.getByRole('button', { name: 'Armory' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Buy Steel Arrow for 50 coins' }));
    expect(await screen.findByText('Bought 2 Steel Arrows!')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Shields' }));
    fireEvent.click(screen.getByRole('button', { name: 'Buy Wooden Shield for 100 coins' }));
    await screen.findByText('Bought Wooden Shield!');
    expect(trial.data.pupils['preview-pupil']).toMatchObject({ coins: 150, gear: { steel: 2 }, shields: ['wood'] });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Snow' }));
    fireEvent.click(await screen.findByRole('button', { name: /Hawk/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: pack your quiver' }));
    fireEvent.click(await screen.findByRole('button', { name: 'One more Steel Arrow' }));
    fireEvent.click(screen.getByRole('button', { name: /Wooden Shield/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fight!' }));
    await screen.findByText('Your turn', {}, { timeout: 4000 });
    const fight = Object.values(trial.data.fights)[0];
    expect(fight).toMatchObject({ world: 'snow', opponent: 'hard', status: 'playing', pack: { quiver: { steel: 1 }, shield: 'wood' } });
    expect(trial.data.pupils['preview-pupil'].gear).toEqual({ steel: 1 });
    expect(screen.getByRole('meter', { name: 'Your Wooden Shield' })).toBeTruthy();
    // Leaving after a shot gives back what wasn't used.
    fireEvent.click(screen.getByRole('button', { name: 'Shoot' }));
    await screen.findByText('Your turn', {}, { timeout: 4000 });
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    await screen.findByRole('button', { name: 'Play' });
    expect(fight.status).toBe('left');
    expect(trial.data.pupils['preview-pupil'].gear).toEqual({ steel: 2 });
  });

  it('opens How to play, with the numbers from the rules', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'How to play' }));
    expect(await screen.findByRole('heading', { name: 'How to play' })).toBeTruthy();
    expect(screen.getByText(/Each right answer in time earns 10 coins/)).toBeTruthy();
  });
});
