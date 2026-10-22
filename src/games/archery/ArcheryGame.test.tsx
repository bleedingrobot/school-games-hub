import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DuelRow } from '../../../shared/archery/duel';
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
const { trialBackend, trialHub } = await import('./trialBackend');

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

describe('fights against classmates', () => {
  const ANA = 'aaaaaaaa-0000-4000-8000-000000000001';
  const BEN = 'bbbbbbbb-0000-4000-8000-000000000002';

  /** Ana's and Ben's games, side by side on one pretend server. `skew` moves both the server's clock and the screens'. */
  function two(duels = true) {
    const clock = { skew: 0 };
    // The teacher's Classmate fights switch for their class (Stage 7).
    const switches = { duels };
    const listeners = new Set<(d: DuelRow) => void>();
    const hub = trialHub({
      now: () => Date.now() + clock.skew,
      duels: () => switches.duels,
      pupils: { [ANA]: { name: 'Speedy Otter 7', classId: 'room-1' }, [BEN]: { name: 'Brave Kiwi 12', classId: 'room-1' } },
      onDuel: (d) => queueMicrotask(() => listeners.forEach((l) => l(d))),
    });
    for (const id of [ANA, BEN]) hub.data.pupils[id] = { coins: 0, gear: { steel: 2 }, shields: [], bows: [], spent: 0, best: {}, rounds: [] };
    hub.here(ANA);
    hub.here(BEN);
    const game = (me: string) => {
      const link = {
        here: async () => hub.here(me),
        read: async (id: number) => hub.readDuel(me, id),
        watch: (who: string, onDuel: (d: DuelRow, id: number) => void, onLive: (s: 'live') => void) => {
          const heard = (d: DuelRow) => (d.seat_a === who || d.seat_b === who) && onDuel(d, d.id);
          listeners.add(heard);
          onLive('live');
          return () => void listeners.delete(heard);
        },
        clockOffset: async () => clock.skew,
      };
      const box = document.createElement('div');
      document.body.appendChild(box);
      render(<ArcheryGame api={archeryApi((b) => hub.sendAs(me, b), me)} duels={link} me={me} />, { container: box });
      return within(box);
    };
    return { hub, clock, switches, ana: game(ANA), ben: game(BEN) };
  }

  it('challenges a classmate, who accepts from the pop-up; both pack and take turns through the server', async () => {
    const { hub, ana, ben } = two();
    fireEvent.click(await ana.findByRole('button', { name: 'Challenge a classmate' }));
    fireEvent.click(await ana.findByRole('button', { name: /^City/ }));
    fireEvent.click(await ana.findByRole('button', { name: 'Challenge Brave Kiwi 12 in the City' }));
    await ana.findByRole('heading', { name: 'Waiting for Brave Kiwi 12 to say yes…' });

    // Ben's pop-up (its focus is checked on its own, below: here two games share one page).
    const ask = await ben.findByRole('alertdialog', { name: 'Speedy Otter 7 challenges you!' }, { timeout: 4000 });
    fireEvent.click(within(ask).getByRole('button', { name: 'Accept' }));

    // Both pack (the gear comes out of their bags), and the fight starts on both screens.
    fireEvent.click(await ben.findByRole('button', { name: 'One more Steel Arrow' }));
    fireEvent.click(ben.getByRole('button', { name: 'Fight!' }));
    await ben.findByRole('heading', { name: 'Waiting for Speedy Otter 7 to pack…' });
    expect(hub.data.pupils[BEN].gear).toEqual({ steel: 1 });
    fireEvent.click(await ana.findByRole('button', { name: 'Fight!' }));
    await ana.findByText('Your turn', {}, { timeout: 4000 });
    await ben.findByText('Speedy Otter 7 is aiming…', {}, { timeout: 4000 });
    expect(ben.getByRole('button', { name: 'Shoot' })).toHaveProperty('disabled', true);
    expect(ana.getByRole('timer').getAttribute('aria-label')).toMatch(/^(44|45) seconds left for your turn$/);

    // Ana shoots: the server plays it, and both screens move on to Ben's turn.
    fireEvent.click(ana.getByRole('button', { name: 'Shoot' }));
    await ben.findByText('Your turn', {}, { timeout: 4000 });
    await ana.findByText('Brave Kiwi 12 is aiming…', {}, { timeout: 4000 });
    const duel = Object.values(hub.data.duels!)[0];
    expect(duel.turns).toEqual([{ angle: 55, power: 60, arrow: 'plain' }]);
    // Ben's archer faces left: his 55° is the engine's 125°.
    fireEvent.click(ben.getByRole('button', { name: 'Shoot' }));
    await ana.findByText('Your turn', {}, { timeout: 4000 });
    expect(duel.turns[1]).toEqual({ angle: 125, power: 60, arrow: 'plain' });
    expect(fetch).not.toHaveBeenCalled();
  }, 20_000);

  it('uses up a turn when its time runs out, and leaving asks first: the other wins, no points', async () => {
    const { hub, clock, ana, ben } = two();
    fireEvent.click(await ana.findByRole('button', { name: 'Challenge a classmate' }));
    fireEvent.click(await ana.findByRole('button', { name: /Challenge Brave Kiwi 12/ }));
    fireEvent.click(within(await ben.findByRole('alertdialog', {}, { timeout: 4000 })).getByRole('button', { name: 'Accept' }));
    fireEvent.click(await ben.findByRole('button', { name: 'Fight!' }));
    fireEvent.click(await ana.findByRole('button', { name: 'Fight!' }));
    await ben.findByText('Speedy Otter 7 is aiming…', {}, { timeout: 4000 });

    // Ana's 45 seconds pass (the device's clock and the pretend server's): a screen asks the server, and the turn is used up.
    const realNow = Date.now.bind(Date);
    const later = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 48_000);
    try {
      await ben.findByText('Your turn', {}, { timeout: 6000 });
    } finally {
      later.mockRestore();
    }
    clock.skew = 48_000;
    expect(Object.values(hub.data.duels!)[0].turns).toEqual([{ angle: 0, power: 0, arrow: 'plain', pass: true }]);
    expect(await ana.findByText(/Your time ran out/, {}, { timeout: 4000 })).toBeTruthy();

    fireEvent.click(ana.getByRole('button', { name: 'Leave' }));
    expect(await ana.findByRole('heading', { name: 'Are you sure? Brave Kiwi 12 will win.' })).toBeTruthy();
    fireEvent.click(ana.getByRole('button', { name: 'Leave the fight' }));
    await ana.findByRole('heading', { name: 'You left. Brave Kiwi 12 wins' }, { timeout: 4000 });
    await ben.findByRole('heading', { name: 'Speedy Otter 7 left, so you win' }, { timeout: 4000 });
    expect(ben.getByText("No points this time, because the fight didn't finish.")).toBeTruthy();
    expect(hub.data.points).toEqual([]);
    fireEvent.click(ben.getByRole('button', { name: 'Done' }));
    await ben.findByRole('button', { name: 'Challenge a classmate' });
  }, 20_000);

  it('says so kindly when a classmate says no', async () => {
    const { ana, ben } = two();
    fireEvent.click(await ana.findByRole('button', { name: 'Challenge a classmate' }));
    fireEvent.click(await ana.findByRole('button', { name: /Challenge Brave Kiwi 12/ }));
    fireEvent.click(within(await ben.findByRole('alertdialog', {}, { timeout: 4000 })).getByRole('button', { name: 'Say no' }));
    expect(await ana.findByRole('heading', { name: 'Brave Kiwi 12 said no' }, { timeout: 4000 })).toBeTruthy();
    await waitFor(() => expect(ben.queryByRole('alertdialog')).toBeNull());
  });

  it('shows both pupils the end of a fight played to the finish, with the points', async () => {
    const { chooseForRun } = await import('../../../shared/archery/bot');
    const { duelSetup, replayDuel } = await import('../../../shared/archery/duel');
    const { hub, ana, ben } = two();
    fireEvent.click(await ana.findByRole('button', { name: 'Challenge a classmate' }));
    fireEvent.click(await ana.findByRole('button', { name: /Challenge Brave Kiwi 12/ }));
    fireEvent.click(within(await ben.findByRole('alertdialog', {}, { timeout: 4000 })).getByRole('button', { name: 'Accept' }));
    fireEvent.click(await ben.findByRole('button', { name: 'Fight!' }));
    fireEvent.click(await ana.findByRole('button', { name: 'Fight!' }));
    await ana.findByText('Your turn', {}, { timeout: 4000 });
    // Both "pupils" shoot like the Hard bot, straight to the server, while the two screens show every turn.
    let d = Object.values(hub.data.duels!)[0];
    while (d.status === 'playing') {
      const { run } = replayDuel(d.seed, duelSetup(d.world, [d.packs[0]!, d.packs[1]!]), d.turns);
      const who = run.round.turn === 0 ? ANA : BEN;
      const r = await hub.sendAs<{ duel: DuelRow }>(who, { action: 'shot', duel: d.id, version: d.version, shot: chooseForRun(run, 'hard').shot });
      expect(r.status).toBe(200);
      d = r.body.duel;
    }
    const winner = d.winner === 0 ? ana : d.winner === 1 ? ben : null;
    const loser = d.winner === 0 ? ben : ana;
    if (winner) {
      expect(await winner.findByRole('heading', { name: 'You won the fight!' }, { timeout: 15000 })).toBeTruthy();
      expect(winner.getByText('+4 points for finishing and winning.')).toBeTruthy();
      expect(await loser.findByRole('heading', { name: /won the fight$/ }, { timeout: 15000 })).toBeTruthy();
      expect(loser.getByText('+3 points for finishing.')).toBeTruthy();
    } else {
      expect(await ana.findByRole('heading', { name: 'The fight is a draw' }, { timeout: 15000 })).toBeTruthy();
    }
    expect(hub.data.points.map((x) => x.points).sort()).toEqual(d.winner === null ? [3, 3] : [3, 4]);
  }, 40_000);

  it('lets a challenge run out after a minute, on both screens', async () => {
    const { ana, ben } = two();
    fireEvent.click(await ana.findByRole('button', { name: 'Challenge a classmate' }));
    fireEvent.click(await ana.findByRole('button', { name: /Challenge Brave Kiwi 12/ }));
    await ben.findByRole('alertdialog', {}, { timeout: 4000 });
    const realNow = Date.now.bind(Date);
    const later = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 62_000);
    try {
      expect(await ana.findByRole('heading', { name: 'The challenge ran out' }, { timeout: 5000 })).toBeTruthy();
      expect(ana.getByText("Brave Kiwi 12 didn't answer in time.")).toBeTruthy();
      await waitFor(() => expect(ben.queryByRole('alertdialog')).toBeNull(), { timeout: 3000 });
    } finally {
      later.mockRestore();
    }
  }, 15_000);

  it('moves the focus to a challenge as it pops up, and it can be answered from the keyboard', async () => {
    const { ChallengeAsk } = await import('./Classmates');
    const answered: string[] = [];
    render(
      <ChallengeAsk
        ask={{ duel: 1, from: 'Speedy Otter 7', world: 'snow', deadline: new Date(Date.now() + 60_000).toISOString() }}
        serverNow={() => Date.now()} busy={false} problem="" onAccept={() => answered.push('yes')} onDecline={() => answered.push('no')}
      />,
    );
    await waitFor(() => expect(document.activeElement?.id).toBe('ar-ask-title'));
    expect(screen.getByRole('alertdialog', { name: 'Speedy Otter 7 challenges you!' }).textContent).toMatch(/Snow: one round.*within (59|60) seconds/);
    screen.getByRole('button', { name: 'Say no' }).focus();
    fireEvent.click(document.activeElement!);
    expect(answered).toEqual(['no']);
  });

  it('hides everything to do with classmates while the teacher has classmate fights off', async () => {
    const { hub, ana } = two(false);
    await ana.findByRole('button', { name: 'Play' });
    // "I'm here" has answered (and said classmate fights are off), so nothing about classmates shows.
    await waitFor(() => expect(hub.data.here?.[ANA]).toBeUndefined());
    await act(async () => {});
    expect(ana.queryByRole('button', { name: 'Challenge a classmate' })).toBeNull();
    fireEvent.click(ana.getByRole('button', { name: 'Play' }));
    await ana.findByRole('heading', { name: 'Pick your fight' });
    expect(ana.queryByRole('button', { name: 'Against a classmate instead' })).toBeNull();
    expect(ana.queryByText(/Or a classmate\?/)).toBeNull();
  }, 20_000);

  it('ends a fight fairly when classmate fights are switched off part-way, on both screens', async () => {
    const { hub, switches, ana, ben } = two();
    fireEvent.click(await ana.findByRole('button', { name: 'Challenge a classmate' }));
    fireEvent.click(await ana.findByRole('button', { name: /Challenge Brave Kiwi 12/ }));
    fireEvent.click(within(await ben.findByRole('alertdialog', {}, { timeout: 4000 })).getByRole('button', { name: 'Accept' }));
    fireEvent.click(await ben.findByRole('button', { name: 'One more Steel Arrow' }));
    fireEvent.click(ben.getByRole('button', { name: 'Fight!' }));
    fireEvent.click(await ana.findByRole('button', { name: 'Fight!' }));
    await ana.findByText('Your turn', {}, { timeout: 4000 });
    expect(hub.data.pupils[BEN].gear).toEqual({ steel: 1 });

    switches.duels = false;
    fireEvent.click(ana.getByRole('button', { name: 'Shoot' }));
    for (const who of [ana, ben]) {
      await who.findByRole('heading', { name: 'The fight has stopped' }, { timeout: 4000 });
      expect(who.getByText(/Your teacher switched classmate fights off for now/)).toBeTruthy();
    }
    expect(hub.data.points).toEqual([]);
    expect(hub.data.pupils[BEN].gear).toEqual({ steel: 2 });
    fireEvent.click(ana.getByRole('button', { name: 'Done' }));
    await ana.findByRole('button', { name: 'Play' });
    await waitFor(() => expect(ana.queryByRole('button', { name: 'Challenge a classmate' })).toBeNull(), { timeout: 4000 });
  }, 20_000);
});
