import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundProvider } from '../../sound';
import { judgeCard101Game, type Card101GameReport } from '../../../shared/card101/save';
import { Card101Solo, type Card101Saving } from './Card101Solo';
import { barLevel, placesFrom } from './parts';

function renderGame(saving?: Card101Saving) {
  const onLevelChange = vi.fn();
  const view = render(
    <SoundProvider>
      <Card101Solo
        player={{ name: 'Speedy Otter 27', avatar: {} }}
        level="very-easy"
        onLevelChange={onLevelChange}
        saving={saving}
        timeScale={0}
      />
    </SoundProvider>,
  );
  return { onLevelChange, view };
}

/** A pretend server: hands out seeds and keeps what it's sent. */
function fakeSaving(seed: string | null = 's1-1792000000-0123456789abcdef01234567') {
  const saved: Card101GameReport[] = [];
  const left: Card101GameReport[] = [];
  const saving: Card101Saving = {
    seed: vi.fn(async () => (seed ? { seed, stamp: 'x'.repeat(43) } : null)),
    save: vi.fn(async (report: Card101GameReport) => {
      saved.push(report);
      return { countsForPoints: true };
    }),
    abandon: vi.fn((report: Card101GameReport) => {
      left.push(report);
    }),
  };
  return { saving, saved, left };
}

// The play-through loop looks for the same things getByRole would, with plain look-ups: asking by role is slow on the
// game page, and the loop asks several times every few milliseconds, which was most of each game's time.
const nameOf = (el: Element) =>
  el.getAttribute('aria-label') ?? (el.getAttribute('aria-labelledby') ? document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent : el.textContent) ?? '';
const buttons = (name: RegExp) => [...document.querySelectorAll('button')].filter((b) => name.test(nameOf(b).trim()));
const dialogShown = (name: RegExp) => [...document.querySelectorAll('[role="dialog"]')].some((d) => name.test(nameOf(d)));

/** Plays (as a not-very-careful student) until the podium shows. Returns the number of scoring shows. */
async function playToTheEnd(user: ReturnType<typeof userEvent.setup>, onScores: () => void = () => {}) {
  let rounds = 0;
  for (let guard = 0; guard < 3000; guard++) {
    if (dialogShown(/You (won|came|shared)/)) break;
    const [see] = buttons(/See who won/);
    const [next] = buttons(/Next round/);
    const [peek] = buttons(/remembered them/);
    const pick = buttons(/^Swap with/);
    const [throwIt] = buttons(/Throw it away/);
    const [stack] = buttons(/^Stack:/);
    if (see || next) {
      expect(screen.getByRole('dialog', { name: /Round \d+ scores/ })).toBeInTheDocument();
      onScores();
      rounds++;
      await user.click((see ?? next)!);
    } else if (peek) await user.click(peek);
    else if (pick.length) await user.click(pick[pick.length - 1]);
    else if (throwIt) await user.click(throwIt);
    else if (stack && !stack.hasAttribute('disabled')) await user.click(stack);
    else await tick();
  }
  return { podium: await screen.findByRole('dialog', { name: /You (won|came|shared)/ }), rounds };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

async function deal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Deal the cards/ }));
  await user.click(await screen.findByRole('button', { name: /remembered them/ }));
}

beforeEach(() => localStorage.clear());

describe('101 against bots', () => {
  it('shows the settings, remembers them, and passes on the bot level', async () => {
    const user = userEvent.setup();
    const { onLevelChange } = renderGame();
    expect(screen.getByRole('heading', { name: /101/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '2' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Normal: to 101/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: '3' }));
    await user.click(screen.getByRole('radio', { name: /Quick: to 50/ }));
    await user.click(screen.getByRole('radio', { name: 'Medium' }));
    expect(onLevelChange).toHaveBeenCalledWith('medium');
    expect(JSON.parse(localStorage.getItem('sgh-101-prefs')!)).toEqual({ bots: 3, target: 50 });
  });

  it('deals 4 face-down cards each and shows only your bottom two during the peek', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('button', { name: /Deal the cards/ }));
    await screen.findByRole('button', { name: /remembered them/ });
    const mine = screen.getByRole('group', { name: 'Your four cards' });
    const labels = within(mine).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(labels[0]).toMatch(/top left: face down/);
    expect(labels[1]).toMatch(/top right: face down/);
    expect(labels[2]).toMatch(/bottom left: .+ of .+, face up/);
    expect(labels[3]).toMatch(/bottom right: .+ of .+, face up/);
    // The bots' cards are all face down.
    for (const name of ['Kea’s cards', 'Tūī’s cards']) {
      const seat = screen.getByRole('region', { name });
      expect(within(seat).getAllByRole('img', { name: /face down/ })).toHaveLength(4);
    }
    await user.click(screen.getByRole('button', { name: /remembered them/ }));
    await waitFor(() => expect(within(mine).getAllByRole('button', { name: /face down/ })).toHaveLength(4));
  });

  it('take a card, swap it in: it goes face up and that spot is locked; the knock waits for everyone’s first turn', async () => {
    const user = userEvent.setup();
    renderGame();
    await deal(user);
    const stack = () => screen.getByRole('button', { name: /^Stack:/ });
    await waitFor(() => expect(stack()).toBeEnabled());
    expect(screen.getByRole('button', { name: /Knock/ })).toBeDisabled();
    expect(screen.getByText(/knock once everyone has had a turn/)).toBeInTheDocument();
    await user.click(stack());
    const card = screen.getByRole('img', { name: /Your new card: / }).getAttribute('aria-label')!.replace('Your new card: ', '');
    const mine = screen.getByRole('group', { name: 'Your four cards' });
    expect(within(mine).getAllByRole('button', { name: /^Swap with/ })).toHaveLength(4);
    await user.click(within(mine).getByRole('button', { name: /Swap with your top left/ }));
    expect(within(mine).getAllByRole('button')[0]).toHaveAccessibleName(`Your card, top left: ${card}, face up`);
    expect(screen.getByText(new RegExp(`You put the ${card} face up in your top left spot`))).toBeInTheDocument();
    // Next turn: the face-up spot can't be picked again.
    await waitFor(() => expect(stack()).toBeEnabled());
    await user.click(stack());
    expect(within(mine).getAllByRole('button', { name: /^Swap with/ })).toHaveLength(3);
    expect(within(mine).getAllByRole('button')[0]).toBeDisabled();
  });

  it('works from the keyboard: S takes from the stack, T throws it away, D takes the discard', async () => {
    const user = userEvent.setup();
    renderGame();
    await deal(user);
    await waitFor(() => expect(screen.getByRole('button', { name: /^Stack:/ })).toBeEnabled());
    await user.keyboard('s');
    const held = screen.getByRole('img', { name: /Your new card: / }).getAttribute('aria-label')!.replace('Your new card: ', '');
    await user.keyboard('t');
    // (The bots play straight away in tests, so check the log, not the pile.)
    expect(screen.getByText(`You threw away the ${held}.`)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Stack:/ })).toBeEnabled());
    const top = screen.getByRole('button', { name: /^Discard pile:/ }).getAttribute('aria-label')!.match(/: (.+)\. Take it/)![1];
    await user.keyboard('d');
    expect(screen.getByRole('img', { name: /Your new card: / })).toHaveAccessibleName(`Your new card: ${top}`);
  });

  it('plays a whole Quick game to the podium, with the scoring show after every round', async () => {
    const user = userEvent.setup();
    localStorage.setItem('sgh-101-prefs', JSON.stringify({ bots: 1, target: 50 }));
    renderGame();
    await user.click(screen.getByRole('button', { name: /Deal the cards/ }));
    const { podium, rounds } = await playToTheEnd(user, () => expect(screen.getAllByText(/^Hand: /).length).toBe(2));
    expect(rounds).toBeGreaterThan(1);
    expect(within(podium).getAllByRole('listitem')).toHaveLength(2);
    expect(within(podium).getByRole('button', { name: 'Play again' })).toBeInTheDocument();
  }, 30_000);
});

describe('saving 101 games', () => {
  it('saves a finished game with everything the server needs to replay it', async () => {
    const user = userEvent.setup();
    localStorage.setItem('sgh-101-prefs', JSON.stringify({ bots: 1, target: 50 }));
    const { saving, saved, left } = fakeSaving();
    renderGame(saving);
    expect(screen.getByText(/Games you finish are saved and earn points/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Deal the cards/ }));
    expect(saving.seed).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: /What happened/ })).toHaveTextContent('Saved when you finish');
    const { podium } = await playToTheEnd(user);
    await waitFor(() => expect(within(podium).getByRole('status')).toHaveTextContent('Saved! Points added.'));
    expect(saved).toHaveLength(1);
    expect(left).toEqual([]);
    const report = saved[0];
    expect(report).toEqual(
      expect.objectContaining({
        game: '101',
        seed: 's1-1792000000-0123456789abcdef01234567',
        stamp: 'x'.repeat(43),
        bots: 1,
        level: 'very-easy',
        settings: { target: 50 },
        ending: 'finished',
      }),
    );
    // The server's replay of what was sent agrees with the podium.
    const judged = judgeCard101Game(report);
    expect(judged.ok).toBe(true);
    if (judged.ok) {
      expect(within(podium).getByRole('heading')).toHaveTextContent(judged.game.outcome === 'won' ? /You (won|shared the win)/ : /You came 2nd/);
      expect(judged.game.countsForPoints).toBe(true);
    }
  }, 30_000);

  it('plays a practice game when there’s no seed to be had', async () => {
    const user = userEvent.setup();
    localStorage.setItem('sgh-101-prefs', JSON.stringify({ bots: 1, target: 50 }));
    const { saving, saved } = fakeSaving(null);
    renderGame(saving);
    await user.click(screen.getByRole('button', { name: /Deal the cards/ }));
    expect(await screen.findByRole('heading', { name: /What happened/ })).toHaveTextContent('Practice game: not saved');
    const { podium } = await playToTheEnd(user);
    expect(within(podium).getByRole('status')).toHaveTextContent(/Practice game/);
    expect(saved).toEqual([]);
  }, 30_000);

  it('records a game the student leaves part-way, once', async () => {
    const user = userEvent.setup();
    const { saving, left } = fakeSaving();
    const { view } = renderGame(saving);
    await user.click(screen.getByRole('button', { name: /Deal the cards/ }));
    await screen.findByRole('button', { name: /remembered them/ });
    // Leaving before doing anything records nothing.
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(left).toEqual([]);
    await deal(user);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    view.unmount();
    expect(left).toHaveLength(1);
    expect(left[0]).toEqual(expect.objectContaining({ ending: 'abandoned', actions: ['peek'] }));
  });

  it('says so on the settings screen when games aren’t saved', () => {
    renderGame();
    expect(screen.getByText(/practice copy/)).toBeInTheDocument();
  });
});

describe('101 screen helpers', () => {
  it('places go lowest first, and ties share a place', () => {
    expect(placesFrom([40, 12, 55], [false, false, false])).toEqual([2, 1, 3]);
    expect(placesFrom([20, 20, 30, 5], [false, false, false, false])).toEqual([2, 2, 4, 1]);
    expect(placesFrom([20, 0, 30], [false, true, false])).toEqual([1, 0, 2]);
  });

  it('score bars turn amber after 75% of the way and red after 90%', () => {
    expect(barLevel(70, 101)).toBe('ok');
    expect(barLevel(76, 101)).toBe('warn');
    expect(barLevel(91, 101)).toBe('danger');
    expect(barLevel(46, 50)).toBe('danger');
  });
});
