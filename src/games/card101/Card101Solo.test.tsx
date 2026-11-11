import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundProvider } from '../../sound';
import { judgeCard101Game, type Card101GameReport } from '../../../shared/card101/save';
import { Card101Solo, type Card101Saving } from './Card101Solo';

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

beforeEach(() => localStorage.clear());

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

});

