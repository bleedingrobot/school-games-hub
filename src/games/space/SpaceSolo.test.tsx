import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { judgeSpaceGame, type SpaceGameReport } from '../../../shared/space/save';
import { SoundProvider } from '../../sound';
import { SpaceSolo, type SpaceMaths, type SpaceSaving } from './SpaceSolo';

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const maths = (mode: SpaceMaths['mode']): SpaceMaths => ({ mode, enabledTables: ALL, division: false, multipleChoice: false, facts: [] });

function solve(spoken: string): number {
  const [a, op, b, , c] = spoken.replace('?', '').replace('times', '×').replace('equals', '=').split(' ');
  if (c === 'what') return op === '×' ? Number(a) * Number(b) : Number(a) / Number(b);
  return a === 'what' ? Number(c) / Number(b) : Number(c) / Number(a);
}

function renderGame(saving?: SpaceSaving, mathsConfig?: SpaceMaths) {
  const onLevelChange = vi.fn();
  const view = render(
    <SoundProvider>
      <SpaceSolo
        player={{ name: 'Speedy Otter 27', avatar: {} }}
        level="easy"
        onLevelChange={onLevelChange}
        saving={saving}
        maths={mathsConfig}
        timeScale={0}
      />
    </SoundProvider>,
  );
  return { onLevelChange, view };
}

/** A pretend server: hands out seeds and keeps what it's sent. */
function fakeSaving(seed: string | null = 's1-1792000000-0123456789abcdef01234567') {
  const saved: SpaceGameReport[] = [];
  const left: SpaceGameReport[] = [];
  const saving: SpaceSaving = {
    seed: vi.fn(async () => (seed ? { seed, stamp: 'x'.repeat(43) } : null)),
    save: vi.fn(async (report: SpaceGameReport) => {
      saved.push(report);
      return { countsForPoints: true };
    }),
    abandon: vi.fn((report: SpaceGameReport) => {
      left.push(report);
    }),
  };
  return { saving, saved, left };
}

/** Plays until the podium shows. */
async function playToTheEnd(user: ReturnType<typeof userEvent.setup>) {
  let actions = 0;
  for (let guard = 0; guard < 400; guard++) {
    if (screen.queryByRole('dialog')) break;
    const roll = screen.queryByRole('button', { name: /^🎲 Roll/ });
    const choice = screen.queryByRole('group', { name: /gate|card|pockets|die|aim/i });
    if (choice) {
      await user.click(within(choice).getAllByRole('button')[0]);
      actions++;
    } else if (roll && !roll.hasAttribute('disabled')) {
      await user.click(roll);
      actions++;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  return { podium: await waitFor(() => screen.getByRole('dialog')), actions };
}

describe('Wormholes & Black Holes against bots', () => {
  it('shows the settings, remembers them, and passes on the bot level', async () => {
    const user = userEvent.setup();
    const { onLevelChange } = renderGame();
    expect(screen.getByRole('heading', { name: /Wormholes & Black Holes/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Nebula/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Pilot' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /Asteroid Belt/ }));
    await user.click(screen.getByRole('radio', { name: 'Commander' }));
    expect(onLevelChange).toHaveBeenCalledWith('medium');
    expect(JSON.parse(localStorage.getItem('sgh-space-settings')!).board).toBe('asteroid-belt');
  });

  it('refuses a galaxy code that isn’t one', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('radio', { name: /Random Galaxy/ }));
    const code = screen.getByLabelText('Galaxy code');
    expect((code as HTMLInputElement).value).toMatch(/^\w+-\w+-\d\d$/); // galaxy of the day
    await user.clear(code);
    await user.type(code, 'not a code');
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/doesn’t look right/);
  });

  it('plays a whole game to the podium', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('radio', { name: /Asteroid Belt/ }));
    await user.click(screen.getByRole('radio', { name: '1' }));
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    expect(screen.getByRole('img', { name: /Asteroid Belt board, 50 squares/ })).toBeInTheDocument();

    const { podium, actions } = await playToTheEnd(user);
    expect(actions).toBeGreaterThan(3);
    expect(within(podium).getByRole('heading')).toHaveTextContent(/You (docked first|got the furthest|came 2nd)/);
    expect(screen.getByRole('log')).toHaveTextContent(/Speedy Otter 27 rolled/);
    await user.click(within(podium).getByRole('button', { name: 'Look at the board' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: /Launch/ })).toBeInTheDocument();
  }, 60_000);

  it('rolls with the space bar', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('radio', { name: '1' }));
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    const roll = screen.getByRole('button', { name: /^🎲 Roll/ });
    await waitFor(() => expect(roll).toBeEnabled());
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard(' ');
    await waitFor(() => expect(screen.getByRole('log')).toHaveTextContent(/Speedy Otter 27 rolled/));
  });

  it('saves a finished game with everything the server needs to replay it', async () => {
    const user = userEvent.setup();
    const { saving, saved, left } = fakeSaving();
    renderGame(saving);
    expect(screen.getByText(/earns points for taking part/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Asteroid Belt/ }));
    await user.click(screen.getByRole('radio', { name: '1' }));
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    expect(saving.seed).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: /Mission log/ })).toHaveTextContent('Saved when you finish');
    const { podium } = await playToTheEnd(user);
    await waitFor(() => expect(within(podium).getByRole('status')).toHaveTextContent('Saved! You earned points for taking part.'));
    expect(saved).toHaveLength(1);
    expect(left).toEqual([]);
    const report = saved[0];
    expect(report).toEqual(
      expect.objectContaining({
        game: 'space',
        seed: 's1-1792000000-0123456789abcdef01234567',
        stamp: 'x'.repeat(43),
        board: { id: 'asteroid-belt' },
        bots: 1,
        level: 'easy',
        ending: 'finished',
      }),
    );
    // The server's replay of what was sent agrees with the podium.
    const judged = judgeSpaceGame(report);
    expect(judged.ok).toBe(true);
    if (judged.ok) {
      const place = judged.game.place === 1 ? /You (docked first|got the furthest)/ : /You came 2nd/;
      expect(within(podium).getByRole('heading')).toHaveTextContent(place);
    }
  }, 60_000);

  it('plays a practice game when there’s no seed to be had', async () => {
    const user = userEvent.setup();
    const { saving, saved } = fakeSaving(null);
    renderGame(saving);
    await user.click(screen.getByRole('radio', { name: /Asteroid Belt/ }));
    await user.click(screen.getByRole('radio', { name: '1' }));
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    expect(screen.getByRole('heading', { name: /Mission log/ })).toHaveTextContent('Practice game: not saved');
    const { podium } = await playToTheEnd(user);
    expect(within(podium).getByRole('status')).toHaveTextContent(/Practice game/);
    expect(saved).toEqual([]);
  }, 60_000);

  it('records a game the student leaves part-way, once', async () => {
    const user = userEvent.setup();
    const { saving, left } = fakeSaving();
    const { view } = renderGame(saving);
    await user.click(screen.getByRole('radio', { name: '1' }));
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    // Leaving before doing anything records nothing.
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(left).toEqual([]);
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    const roll = screen.getByRole('button', { name: /^🎲 Roll/ });
    await waitFor(() => expect(roll).toBeEnabled());
    await user.click(roll);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    view.unmount();
    expect(left).toHaveLength(1);
    expect(left[0]).toEqual(expect.objectContaining({ ending: 'abandoned', actions: ['roll'] }));
  });

  it('opens How to play and the Star chart from the settings, and Escape closes them', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    renderGame();
    const howButton = screen.getByRole('button', { name: /How to play/ });
    await user.click(howButton);
    const help = screen.getByRole('dialog', { name: /help/ });
    expect(within(help).getByRole('tab', { name: /How to play/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(help).getByText(/Land on its mouth to zoom up/)).toBeInTheDocument();
    expect(within(help).getByText(/Nobody can aim at the rocket in last place/)).toBeInTheDocument();
    await user.click(within(help).getByRole('tab', { name: /Star chart/ }));
    expect(within(help).getByText(/You’ve found/)).toHaveTextContent('You’ve found 0 of 19');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(howButton).toHaveFocus();
  });

  it('opens How to play with ?, and the space bar doesn’t roll behind it', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    const roll = await screen.findByRole('button', { name: /^🎲 Roll/ });
    await waitFor(() => expect(roll).toBeEnabled());
    await user.keyboard('?');
    const help = screen.getByRole('dialog', { name: /help/ });
    within(help).getByRole('tabpanel').focus(); // not a button, so only the open help stops the roll
    await user.keyboard(' ');
    expect(screen.queryByText(/Speedy Otter 27 rolled/)).not.toBeInTheDocument();
    // Starting a game puts Earth on the Star chart.
    await user.click(within(help).getByRole('tab', { name: /Star chart/ }));
    expect(within(help).getByText(/You’ve found/)).toHaveTextContent('You’ve found 1 of 19');
    await user.click(within(help).getByRole('button', { name: 'Close help' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard(' ');
    expect(await screen.findAllByText(/Speedy Otter 27 rolled/)).not.toHaveLength(0);
  });

  it('plays a pass-and-play game: everyone takes turns, nothing is saved', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    const { saving, saved, left } = fakeSaving();
    const { view } = renderGame(saving);
    await user.click(screen.getByRole('radio', { name: /Pass-and-play/ }));
    expect(screen.queryByRole('radio', { name: 'Pilot' })).not.toBeInTheDocument();
    expect(screen.getByText(/aren’t saved and don’t earn points/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Asteroid Belt/ }));
    await user.click(screen.getByRole('radio', { name: '4' }));
    expect(screen.getByLabelText('Player 1')).toHaveAttribute('placeholder', 'Speedy Otter 27');
    await user.type(screen.getByLabelText('Player 2'), 'Mia');
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    expect(saving.seed).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /Mission log/ })).toHaveTextContent('Pass-and-play: not saved');
    await waitFor(() => expect(screen.getByRole('status', { name: '' })).toHaveTextContent(/Speedy Otter 27’s turn/));

    const { podium } = await playToTheEnd(user);
    const log = screen.getByRole('log');
    expect(log).toHaveTextContent(/Speedy Otter 27 rolled/);
    expect(log).toHaveTextContent(/Mia rolled/);
    expect(log).toHaveTextContent(/Player 3 rolled/);
    expect(log).toHaveTextContent(/Player 4 rolled/);
    expect(within(podium).getByRole('heading')).toHaveTextContent(/(Speedy Otter 27|Mia|Player 3|Player 4) (docked first|got the furthest)!/);
    expect(within(podium).getByRole('status')).toHaveTextContent('Pass-and-play games aren’t saved.');
    view.unmount();
    expect(saved).toEqual([]);
    expect(left).toEqual([]);
    expect(JSON.parse(localStorage.getItem('sgh-space-settings')!)).toEqual(
      expect.objectContaining({ who: 'pass', players: 4, names: ['', 'Mia', '', ''] }),
    );
  }, 60_000);
});

describe('Mission Control maths on the game screen', () => {
  /** Plays to the end, answering every maths question (right, wrong, right, wrong…) and taking each Mission Boost. */
  async function playWithMaths(user: ReturnType<typeof userEvent.setup>) {
    let asked = 0;
    for (let guard = 0; guard < 4000; guard++) {
      if (screen.queryByRole('dialog', { name: /Wormhole boost|Black hole escape|Mission Boost/ }) === null && screen.queryByRole('dialog')) break;
      const fact = screen.queryByLabelText(/equals/);
      if (fact) {
        const answer = solve(fact.getAttribute('aria-label')!);
        await user.keyboard(`${asked % 2 === 0 ? answer : answer + 1}{Enter}`);
        asked++;
        await waitFor(() => expect(document.querySelector('.question[data-result]')).toBeNull(), { timeout: 4000 });
        continue;
      }
      const boost = screen.queryByRole('button', { name: /Mission Boost/ });
      const roll = screen.queryByRole('button', { name: /^🎲 Roll/ });
      const choice = screen.queryByRole('group', { name: /gate|card|pockets|die|aim/i });
      if (boost && !boost.hasAttribute('disabled')) await user.click(boost);
      else if (choice) await user.click(within(choice).getAllByRole('button')[0]);
      else if (roll && !roll.hasAttribute('disabled')) await user.click(roll);
      else await new Promise((resolve) => setTimeout(resolve, 5));
    }
    return asked;
  }

  it('shows the maths switch only when the teacher lets students choose', () => {
    const { view } = renderGame(undefined, maths('choose'));
    expect(screen.getByRole('group', { name: 'Mission Control maths' })).toBeInTheDocument();
    view.unmount();
    renderGame(undefined, maths('off'));
    expect(screen.queryByText('Mission Control maths')).not.toBeInTheDocument();
  });

  it('says maths is on (with no switch) when the teacher turns it on for everyone', () => {
    renderGame(undefined, maths('on'));
    expect(screen.queryByRole('group', { name: 'Mission Control maths' })).not.toBeInTheDocument();
    expect(screen.getByText(/Mission Control maths is on/)).toBeInTheDocument();
  });

  it('plays with maths off: no questions and no boost button', async () => {
    const user = userEvent.setup();
    localStorage.setItem('sgh-space-settings', JSON.stringify({ board: 'asteroid-belt', bots: 1, maths: false }));
    renderGame(undefined, maths('choose'));
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    await screen.findByRole('button', { name: /^🎲 Roll/ });
    expect(screen.queryByRole('button', { name: /Mission Boost/ })).not.toBeInTheDocument();
    localStorage.clear();
  });

  it('asks questions, applies the answers, and saves them with the game so the server can check each one', async () => {
    const user = userEvent.setup();
    const { saving, saved } = fakeSaving();
    localStorage.setItem('sgh-space-settings', JSON.stringify({ board: 'asteroid-belt', bots: 1, maths: true }));
    renderGame(saving, maths('choose'));
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    const asked = await playWithMaths(user);
    await waitFor(() => expect(saved).toHaveLength(1), { timeout: 5000 });
    expect(asked).toBeGreaterThan(0);
    const report = saved[0];
    expect(report.settings.maths).toBe(true);
    expect(report.answers).toHaveLength(asked);
    expect(report.answers![0]).toMatchObject({ given: expect.any(Number), parts: expect.any(Array) });
    // The server's own check accepts every answer the screen sent (the seed can't be checked here, so
    // judge the game directly).
    const judged = judgeSpaceGame(report);
    expect(judged).toMatchObject({ ok: true });
    if (judged.ok) expect(judged.game.answers).toHaveLength(asked);
    localStorage.clear();
  }, 60_000);

  it('pass-and-play asks questions but saves and records nothing', async () => {
    const user = userEvent.setup();
    const { saving, saved } = fakeSaving();
    localStorage.setItem('sgh-space-settings', JSON.stringify({ board: 'asteroid-belt', who: 'pass', players: 2, maths: true }));
    const facts = [{ key: 'mul:2x5', attempts: 4, correct: 4, avgMs: 1500, box: 3, lastSeen: 1, quickDays: [] }];
    renderGame(saving, { ...maths('choose'), facts });
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    const asked = await playWithMaths(user);
    expect(asked).toBeGreaterThan(0);
    expect(saved).toEqual([]);
    expect(saving.seed).not.toHaveBeenCalled();
    localStorage.clear();
  }, 60_000);
});

