import { MATHS_CHARGE_STEPS } from '../../../shared/space/engine';
import { spokenLabel } from '../../../shared/maths/banded';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { isFocusKey, type MathsFocus } from '../../../shared/maths/focus';
import { judgeSpaceGame, type SpaceGameReport } from '../../../shared/space/save';
import { SoundProvider } from '../../sound';
import { SpaceSolo, type SpaceMaths, type SpaceSaving } from './SpaceSolo';
import type { Question } from '../../../shared/maths/skillPack';

/** The latest question the game's pack made, so a test can answer questions whose spoken text it can't read (rounding, order of operations). */
const latest: { question: Question | null } = { question: null };
vi.mock('../../../shared/maths/focus', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../shared/maths/focus')>();
  return {
    ...real,
    makeFocusPack: (...args: Parameters<typeof real.makeFocusPack>) => {
      const pack = real.makeFocusPack(...args);
      const next = pack.nextQuestion.bind(pack);
      pack.nextQuestion = (ctx) => {
        const q = next(ctx);
        if (q) latest.question = q;
        return q;
      };
      return pack;
    },
  };
});

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const maths = (mode: SpaceMaths['mode']): SpaceMaths => ({ mode, enabledTables: ALL, division: false, multipleChoice: false, facts: [] });

/** Reads a question the way a screen reader does ("3 plus what equals 10", "7 times 8 equals what") and works out the answer. */
function solve(spoken: string): number {
  const t = spoken.replace(/\?$/, '');
  let m = /^(\d+) plus what equals (\d+)$/.exec(t);
  if (m) return +m[2] - +m[1];
  m = /^what plus (\d+) equals (\d+)$/.exec(t);
  if (m) return +m[2] - +m[1];
  m = /^(\d+) plus (\d+) equals what$/.exec(t);
  if (m) return +m[1] + +m[2];
  m = /^(\d+) minus (\d+) equals what$/.exec(t);
  if (m) return +m[1] - +m[2];
  m = /^Double (\d+) equals what$/.exec(t);
  if (m) return 2 * +m[1];
  m = /^Half of (\d+) equals what$/.exec(t);
  if (m) return +m[1] / 2;
  const [a, op, b, , c] = spoken.replace('?', '').replace('times', '×').replace('divided by', '÷').replace('equals', '=').split(' ');
  if (c === 'what') return op === '×' ? Number(a) * Number(b) : Number(a) / Number(b);
  return a === 'what' ? Number(c) / Number(b) : Number(c) / Number(a);
}

const teacherFocus = (skills: string[], extra: Partial<MathsFocus> = {}): MathsFocus => ({
  source: 'teacher-class', skills, onlyThese: true, endsAt: '2099-01-01T11:00:00Z', canChoose: true, own: null, ...extra,
});

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

// The play-through loops below look for the same things as getByRole would, but with plain look-ups: asking by role takes
// about 20 ms on the game page, and a loop asks a few times every few milliseconds, which was most of each game's time.
const anyDialog = () => document.querySelector('[role="dialog"]');
const podiumShown = () => document.querySelector('[role="dialog"][aria-labelledby="space-result-title"]');
const rollButton = () => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith('🎲 Roll'));
const choiceGroup = () =>
  [...document.querySelectorAll<HTMLElement>('[role="group"][aria-label]')].find((g) => /gate|card|pockets|die|aim/i.test(g.getAttribute('aria-label')!));

/** Plays until the podium shows. */
async function playToTheEnd(user: ReturnType<typeof userEvent.setup>) {
  let actions = 0;
  for (let guard = 0; guard < 400; guard++) {
    if (anyDialog()) break;
    const roll = rollButton();
    const choice = choiceGroup();
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

  it('plays a whole game to the podium, and saves it with everything the server needs to replay it', async () => {
    const user = userEvent.setup();
    const { saving, saved, left } = fakeSaving();
    renderGame(saving);
    expect(screen.getByText(/earns points for taking part/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Asteroid Belt/ }));
    await user.click(screen.getByRole('radio', { name: '1' }));
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    expect(saving.seed).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: /Mission log/ })).toHaveTextContent('Saved when you finish');
    expect(screen.getByRole('img', { name: /Asteroid Belt board, 50 squares/ })).toBeInTheDocument();
    const { podium, actions } = await playToTheEnd(user);
    expect(actions).toBeGreaterThan(3);
    expect(screen.getByRole('log')).toHaveTextContent(/Speedy Otter 27 rolled/);
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
    // After the podium: look at the board, then back to the settings for another game.
    await user.click(within(podium).getByRole('button', { name: 'Look at the board' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: /Launch/ })).toBeInTheDocument();
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
  /** Plays to the end, answering every maths question (right, wrong, right, wrong…), the side card after each turn too. */
  async function playWithMaths(user: ReturnType<typeof userEvent.setup>) {
    let asked = 0;
    for (let guard = 0; guard < 4000; guard++) {
      if (podiumShown()) break;
      const fact = screen.queryByLabelText(/equals/);
      if (fact) {
        // The side card is not a pop-up, so it doesn't grab the keyboard: click into it first.
        if (!anyDialog()) (fact.closest('.question') as HTMLElement).focus();
        const answer = solve(fact.getAttribute('aria-label')!);
        await user.keyboard(`${asked % 2 === 0 ? answer : answer + 1}{Enter}`);
        asked++;
        await waitFor(() => expect(document.querySelector('.question[data-result]')).toBeNull(), { timeout: 4000 });
        continue;
      }
      const roll = rollButton();
      const choice = choiceGroup();
      if (choice) await user.click(within(choice).getAllByRole('button')[0]);
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

  it('plays with maths off: no questions and no side card', async () => {
    const user = userEvent.setup();
    localStorage.setItem('sgh-space-settings', JSON.stringify({ board: 'asteroid-belt', bots: 1, maths: false }));
    renderGame(undefined, maths('choose'));
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    await screen.findByRole('button', { name: /^🎲 Roll/ });
    expect(screen.queryByRole('group', { name: /Mission Control/ })).not.toBeInTheDocument();
    localStorage.clear();
  });

  it('the Roll button says what rolling past an open question costs, and rolling past it skips it', async () => {
    const user = userEvent.setup();
    localStorage.setItem('sgh-space-settings', JSON.stringify({ board: 'asteroid-belt', bots: 1, maths: true }));
    renderGame(undefined, maths('choose'));
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    // Play on (answering any wormhole question, taking any choice) until my turn comes with the card still open.
    let skipped = false;
    for (let guard = 0; guard < 4000 && !skipped; guard++) {
      const waiting = screen.queryByRole('button', { name: `🎲 Roll without the +${MATHS_CHARGE_STEPS}` });
      if (waiting && !waiting.hasAttribute('disabled')) {
        expect(screen.getByRole('group', { name: 'Mission Control' })).toBeInTheDocument();
        await user.click(waiting);
        skipped = true;
        break;
      }
      const dialog = anyDialog();
      const choice = choiceGroup();
      const roll = rollButton();
      if (dialog) {
        const fact = within(dialog as HTMLElement).queryByLabelText(/equals/);
        if (fact) await user.keyboard(`${solve(fact.getAttribute('aria-label')!)}{Enter}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
      } else if (choice) await user.click(within(choice).getAllByRole('button')[0]);
      else if (roll && !roll.hasAttribute('disabled')) await user.click(roll);
      else await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(skipped).toBe(true);
    // Rolling past it closes the card: the button is a plain Roll again.
    await waitFor(() => expect(screen.queryByRole('button', { name: /without the/ })).not.toBeInTheDocument());
    localStorage.clear();
  }, 40_000);

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
    // An answer to the side card after the very last turn has no next turn to carry it, so it isn't sent.
    expect(report.answers!.length).toBeGreaterThanOrEqual(asked - 1);
    expect(report.answers!.length).toBeLessThanOrEqual(asked);
    expect(report.actions.filter((a) => a.startsWith('charge:')).length).toBeGreaterThan(0);
    expect(report.answers![0]).toMatchObject({ given: expect.any(Number), parts: expect.any(Array) });
    // The server's own check accepts every answer the screen sent (the seed can't be checked here, so
    // judge the game directly).
    const judged = judgeSpaceGame(report);
    expect(judged).toMatchObject({ ok: true });
    if (judged.ok) expect(judged.game.answers).toHaveLength(report.answers!.length);
    localStorage.clear();
  }, 60_000);

  describe('with a maths focus', () => {
    it('says why the questions are what they are, on the settings screen', () => {
      renderGame(undefined, { ...maths('on'), focus: teacherFocus(['facts-10']) });
      expect(screen.getByText(/Your teacher picked Number facts to 10 until/)).toBeInTheDocument();
    });

    it('says nothing when the maths is switched off, or there is no focus', () => {
      const { view } = renderGame(undefined, { ...maths('off'), focus: teacherFocus(['facts-10']) });
      expect(screen.queryByText(/Your teacher picked/)).not.toBeInTheDocument();
      view.unmount();
      renderGame(undefined, maths('on'));
      expect(screen.queryByText(/Your teacher picked/)).not.toBeInTheDocument();
    });

    it('asks the focus, and saves each answer with the record it was for so the server can check it', async () => {
      const user = userEvent.setup();
      const { saving, saved } = fakeSaving();
      localStorage.setItem('sgh-space-settings', JSON.stringify({ board: 'asteroid-belt', bots: 1, maths: true }));
      renderGame(saving, { ...maths('choose'), focus: teacherFocus(['facts-10', 'dbl-half-10']) });
      await user.click(screen.getByRole('button', { name: /Launch/ }));
      const asked = await playWithMaths(user);
      await waitFor(() => expect(saved).toHaveLength(1), { timeout: 5000 });
      expect(asked).toBeGreaterThan(0);
      const report = saved[0];
      expect(report.answers!.every((a) => a.key && isFocusKey(a.key) && !a.key.startsWith('mul:'))).toBe(true);
      expect(report.answers!.some((a) => a.parts.includes('×'))).toBe(false);
      const judged = judgeSpaceGame(report);
      expect(judged).toMatchObject({ ok: true });
      if (judged.ok) expect(judged.game.answers.map((a) => a.key)).toEqual(report.answers!.map((a) => a.key));
      localStorage.clear();
    }, 60_000);

    it('on auto (the class has the switch on) asks from the whole ladder: early facts for a new student, each saved under its own record', async () => {
      const user = userEvent.setup();
      const { saving, saved } = fakeSaving();
      localStorage.setItem('sgh-space-settings', JSON.stringify({ board: 'asteroid-belt', bots: 1, maths: true }));
      const auto: MathsFocus = {
        source: 'auto', skills: [], onlyThese: false, endsAt: null, canChoose: true, own: null,
        ladder: { on: true, placed: null, placement: null, furthest: null },
      };
      renderGame(saving, { ...maths('choose'), focus: auto });
      await user.click(screen.getByRole('button', { name: /Launch/ }));
      await playWithMaths(user);
      await waitFor(() => expect(saved).toHaveLength(1), { timeout: 5000 });
      const keys = saved[0].answers!.map((a) => a.key ?? '');
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.every((k) => isFocusKey(k))).toBe(true);
      expect(keys.filter((k) => !k.startsWith('mul:')).length).toBeGreaterThan(keys.length / 2); // number facts, not tables
      expect(judgeSpaceGame(saved[0])).toMatchObject({ ok: true });
      localStorage.clear();
    }, 60_000);

    it('asks the generated skills (rounding, order of operations...): choices to tap, a point key, big answers, all saved and checked', async () => {
      const user = userEvent.setup();
      const { saving, saved } = fakeSaving();
      localStorage.setItem('sgh-space-settings', JSON.stringify({ board: 'asteroid-belt', bots: 1, maths: true }));
      const focus = teacherFocus(['bonds-100', 'round-10-100', 'round-big', 'round-million', 'times-tens', 'factor-pairs', 'squares-cubes', 'bedmas']);
      renderGame(saving, { ...maths('choose'), focus });
      await user.click(screen.getByRole('button', { name: /Launch/ }));
      const seen = { choices: 0, point: 0, typed: 0 };
      let asked = 0;
      for (let guard = 0; guard < 4000; guard++) {
        if (podiumShown()) break;
        const fact = document.querySelector('.question__fact');
        if (fact && latest.question) {
          const q = latest.question;
          const right = asked % 2 === 0;
          if (!anyDialog()) (fact.closest('.question') as HTMLElement).focus();
          if (q.choices) {
            seen.choices++;
            const target = right ? q.answer : q.choices.find((c) => c !== q.answer)!;
            await user.click(screen.getByRole('button', { name: String(target) }));
          } else {
            seen.typed++;
            if (q.input === 'decimal') {
              seen.point++;
              expect(screen.getByRole('button', { name: 'Point' })).toBeInTheDocument();
            } else expect(screen.queryByRole('button', { name: 'Point' })).not.toBeInTheDocument();
            await user.keyboard(`${right ? q.answer : Number((q.answer + 1).toFixed(2))}{Enter}`);
          }
          asked++;
          await waitFor(() => expect(document.querySelector('.question[data-result]')).toBeNull(), { timeout: 4000 });
          continue;
        }
        const roll = rollButton();
        const choice = choiceGroup();
        if (choice) await user.click(within(choice).getAllByRole('button')[0]);
        else if (roll && !roll.hasAttribute('disabled')) await user.click(roll);
        else await new Promise((resolve) => setTimeout(resolve, 5));
      }
      await waitFor(() => expect(saved).toHaveLength(1), { timeout: 5000 });
      const report = saved[0];
      expect(report.answers!.length).toBeLessThanOrEqual(asked); // an answer given as the game ends is not part of it
      expect(report.answers!.length).toBeGreaterThan(3);
      expect(report.answers!.every((a) => a.key && isFocusKey(a.key) && !a.key.startsWith('mul:'))).toBe(true);
      expect(judgeSpaceGame(report)).toMatchObject({ ok: true });
      expect(seen.typed + seen.choices).toBe(asked);
      localStorage.clear();
    }, 120_000);

    it('asks the fraction, decimal and percentage skills: fractions to tap, a point key, all saved with their numbers and checked by the server', async () => {
      const user = userEvent.setup();
      const { saving, saved } = fakeSaving();
      localStorage.setItem('sgh-space-settings', JSON.stringify({ board: 'asteroid-belt', bots: 1, maths: true }));
      const focus = teacherFocus(['unit-fraction-of', 'tenths', 'add-tenths', 'decimal-equivalents', 'percent-basic', 'fraction-of', 'times-decimals', 'equivalent-fractions', 'fdp-equivalents', 'percent-of', 'whole-from-fraction']);
      renderGame(saving, { ...maths('choose'), focus });
      await user.click(screen.getByRole('button', { name: /Launch/ }));
      const seen = { choices: 0, point: 0, typed: 0 };
      let asked = 0;
      for (let guard = 0; guard < 4000; guard++) {
        if (podiumShown()) break;
        const fact = document.querySelector('.question__fact');
        if (fact && latest.question) {
          const q = latest.question;
          const right = asked % 2 === 0;
          if (!anyDialog()) (fact.closest('.question') as HTMLElement).focus();
          if (q.choices) {
            seen.choices++;
            const target = right ? q.answer : q.choices.find((c) => c !== q.answer)!;
            await user.click(screen.getByRole('button', { name: q.choiceLabels ? spokenLabel(q.choiceLabels[target]) : String(target) }));
          } else {
            seen.typed++;
            if (q.input === 'decimal') {
              seen.point++;
              expect(screen.getByRole('button', { name: 'Point' })).toBeInTheDocument();
            } else expect(screen.queryByRole('button', { name: 'Point' })).not.toBeInTheDocument();
            await user.keyboard(`${right ? q.answer : Number((q.answer + 1).toFixed(3))}{Enter}`);
          }
          asked++;
          await waitFor(() => expect(document.querySelector('.question[data-result]')).toBeNull(), { timeout: 4000 });
          continue;
        }
        const roll = rollButton();
        const choice = choiceGroup();
        if (choice) await user.click(within(choice).getAllByRole('button')[0]);
        else if (roll && !roll.hasAttribute('disabled')) await user.click(roll);
        else await new Promise((resolve) => setTimeout(resolve, 5));
      }
      await waitFor(() => expect(saved).toHaveLength(1), { timeout: 5000 });
      const report = saved[0];
      expect(report.answers!.length).toBeLessThanOrEqual(asked); // an answer given as the game ends is not part of it
      expect(report.answers!.length).toBeGreaterThan(3);
      expect(report.answers!.every((a) => a.key && isFocusKey(a.key) && !a.key.startsWith('mul:'))).toBe(true);
      // Every answer carries the numbers its question was made from, and the server check accepts the whole game.
      expect(report.answers!.every((a) => a.params && a.params.length > 0)).toBe(true);
      expect(judgeSpaceGame(report)).toMatchObject({ ok: true });
      expect(seen.typed + seen.choices).toBe(asked);
      localStorage.clear();
    }, 120_000);

    it('looks for a new focus as a game starts, and follows it', async () => {
      const user = userEvent.setup();
      const { saving, saved } = fakeSaving();
      const refreshFocus = vi.fn(async () => teacherFocus(['dbl-half-10']));
      localStorage.setItem('sgh-space-settings', JSON.stringify({ board: 'asteroid-belt', bots: 1, maths: true }));
      renderGame(saving, { ...maths('choose'), refreshFocus });
      expect(refreshFocus).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: /Launch/ }));
      await playWithMaths(user);
      await waitFor(() => expect(saved).toHaveLength(1), { timeout: 5000 });
      expect(refreshFocus).toHaveBeenCalledTimes(1);
      expect(saved[0].answers!.every((a) => /^(dbl|half):/.test(a.key ?? ''))).toBe(true);
      localStorage.clear();
    }, 60_000);

    it('keeps the focus it has if the lookup fails', async () => {
      const user = userEvent.setup();
      const { saving, saved } = fakeSaving();
      const refreshFocus = vi.fn(async () => {
        throw new Error('offline');
      });
      localStorage.setItem('sgh-space-settings', JSON.stringify({ board: 'asteroid-belt', bots: 1, maths: true }));
      renderGame(saving, { ...maths('choose'), focus: teacherFocus(['dbl-half-10']), refreshFocus });
      await user.click(screen.getByRole('button', { name: /Launch/ }));
      await playWithMaths(user);
      await waitFor(() => expect(saved).toHaveLength(1), { timeout: 5000 });
      expect(saved[0].answers!.every((a) => /^(dbl|half):/.test(a.key ?? ''))).toBe(true);
      localStorage.clear();
    }, 60_000);
  });

  it('pass-and-play has no side question and saves and records nothing', async () => {
    const user = userEvent.setup();
    const { saving, saved } = fakeSaving();
    localStorage.setItem('sgh-space-settings', JSON.stringify({ board: 'asteroid-belt', who: 'pass', players: 2, maths: true }));
    const facts = [{ key: 'mul:2x5', attempts: 4, correct: 4, avgMs: 1500, box: 3, lastSeen: 1, quickDays: [] }];
    renderGame(saving, { ...maths('choose'), facts });
    await user.click(screen.getByRole('button', { name: /Launch/ }));
    await playWithMaths(user);
    // Wormholes and black holes may ask (only if someone lands on one); the side card never appears.
    expect(screen.queryByRole('group', { name: /Mission Control/ })).not.toBeInTheDocument();
    expect(saved).toEqual([]);
    expect(saving.seed).not.toHaveBeenCalled();
    localStorage.clear();
  }, 60_000);
});

