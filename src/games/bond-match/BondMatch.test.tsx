import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOND_SETS, findBondSet } from '../../../shared/bond-match/bonds';
import { BOARD_SIZES, arePartners, buildDeck, pairsOnBoard, partnersOf, type BoardSize } from '../../../shared/bond-match/deck';
import { newGame } from '../../../shared/bond-match/engine';
import { STAR_CONFIG } from '../../../shared/bond-match/score';
import { sideText } from '../../../shared/bond-match/exact';
import { perfectFlips } from '../../../shared/bond-match/perfectPlayer';
import type { BondMatchSaver } from '../../data/bondMatch';
import type { SaveResult } from '../../../shared/bond-match/save';
import { SoundProvider } from '../../sound';
import { GAMES, findGame } from '../registry';
import { BondMatchPlay } from './BondMatchPlay';
import type { BondSuggestion } from './suggest';
import { bondMatch } from './index';

const SEED = 7;

afterEach(() => vi.unstubAllGlobals());

function setup(props: { makeSeed?: () => number; mismatchMs?: number; saver?: BondMatchSaver; makeRunId?: () => string; suggested?: BondSuggestion | null } = {}) {
  const user = userEvent.setup();
  const makeSeed = props.makeSeed ?? vi.fn(() => SEED);
  render(
    <SoundProvider>
      <BondMatchPlay makeSeed={makeSeed} finishMs={0} mismatchMs={props.mismatchMs ?? 60_000} saver={props.saver} makeRunId={props.makeRunId} suggested={props.suggested} />
    </SoundProvider>,
  );
  return { user, makeSeed };
}

const card = (n: number) => screen.getByRole('button', { name: new RegExp(`^card ${n + 1},`) });
const deckFor = (id: string, size: BoardSize, seed = SEED) => buildDeck(findBondSet(id)!, size, seed);

async function pick(user: ReturnType<typeof userEvent.setup>, label: string, size?: string) {
  if (size) await user.click(screen.getByRole('button', { name: size }));
  await user.click(screen.getByRole('button', { name: new RegExp(`^${label}, `) }));
}

describe('the picker', () => {
  it('asks what you are practising and lists every bond set on three shelves', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'What are you practising?' })).toBeInTheDocument();
    for (const shelf of ['Whole numbers', 'Decimals', 'Fractions']) expect(screen.getByRole('group', { name: shelf })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /board, \d+ pairs?$/ })).toHaveLength(BOND_SETS.length);
    expect(within(screen.getByRole('group', { name: 'Decimals' })).getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByText(/mixed|auto/i)).toBeNull();
  });

  it('offers Small, Medium and Large, with Medium chosen to start', () => {
    setup();
    const size = screen.getByRole('group', { name: 'Board size' });
    expect(within(size).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Small', 'Medium', 'Large']);
    // Each size says how many cards it has, so Small, Medium and Large mean something.
    expect(within(size).getAllByRole('button').map((b) => b.textContent)).toEqual(['Small12 cards', 'Medium16 cards', 'Large20 cards']);
    expect(within(size).getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('says how many pairs each set really gives on the chosen board', async () => {
    const { user } = setup();
    for (const size of BOARD_SIZES) {
      await user.click(screen.getByRole('button', { name: size[0].toUpperCase() + size.slice(1) }));
      for (const set of BOND_SETS) {
        const n = pairsOnBoard(set, size);
        expect(screen.getByRole('button', { name: `${set.label}, ${size[0].toUpperCase() + size.slice(1)} board, ${n === 1 ? '1 pair' : `${n} pairs`}` })).toBeInTheDocument();
      }
    }
    // The small fraction sets make smaller boards.
    expect(screen.getByRole('button', { name: 'Halves, Large board, 2 pairs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quarters, Large board, 4 pairs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eighths, Large board, 8 pairs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'To 10, Large board, 10 pairs' })).toBeInTheDocument();
  });

  it('starts a board with the right number of cards for the set and size', async () => {
    const { user } = setup();
    await pick(user, 'Thirds', 'Large');
    expect(screen.getAllByRole('button', { name: /^card \d+,/ })).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: /Pick another bond/ }));
    await pick(user, 'To 10', 'Small');
    expect(screen.getAllByRole('button', { name: /^card \d+,/ })).toHaveLength(12);
  });
});

describe('a suggested bond (maths focus or auto, stage M.5)', () => {
  const tiles = (shelf: string) => within(screen.getByRole('group', { name: shelf })).getAllByRole('button');

  it("puts the teacher's bond first on its shelf with one badge, said aloud too", () => {
    setup({ suggested: { bondId: 'whole-100-any', why: 'teacher' } });
    expect(screen.getAllByTestId('bond-suggested')).toHaveLength(1);
    expect(screen.getByTestId('bond-suggested')).toHaveTextContent('Teacher’s pick');
    expect(tiles('Whole numbers')[0]).toHaveAccessibleName(/^Your teacher picked this: To 100 \(any\), Medium board/);
    expect(tiles('Whole numbers')).toHaveLength(6);
    expect(tiles('Whole numbers')[1]).toHaveAccessibleName(/^To 10, /);
  });

  it('marks the bond for the ladder place "Good for you now", and a student\'s own focus "Your focus"', () => {
    const { unmount } = render(<SoundProvider><BondMatchPlay suggested={{ bondId: 'decimal-1-tenths', why: 'auto' }} /></SoundProvider>);
    expect(screen.getByTestId('bond-suggested')).toHaveTextContent('Good for you now');
    expect(tiles('Decimals')[0]).toHaveAccessibleName(/^Good for you now: To 1 \(tenths\)/);
    unmount();
    render(<SoundProvider><BondMatchPlay suggested={{ bondId: 'fraction-thirds', why: 'own' }} /></SoundProvider>);
    expect(screen.getByTestId('bond-suggested')).toHaveTextContent('Your focus');
    expect(tiles('Fractions')[0]).toHaveAccessibleName(/^Your focus: Thirds/);
  });

  it('never starts a game by itself, and any bond can still be picked', async () => {
    const { user } = setup({ suggested: { bondId: 'whole-100-tens', why: 'teacher' } });
    expect(screen.getByRole('heading', { name: 'What are you practising?' })).toBeInTheDocument();
    await pick(user, 'Halves');
    expect(screen.getByRole('group', { name: 'Halves board' })).toBeInTheDocument();
  });

  it('changes nothing with no suggestion: same order, no badge', () => {
    setup({ suggested: null });
    expect(screen.queryByTestId('bond-suggested')).toBeNull();
    expect(tiles('Whole numbers').map((b) => b.getAttribute('aria-label')!.split(',')[0])).toEqual(BOND_SETS.filter((b) => b.shelf === 'whole').map((b) => b.label));
  });
});

describe('the board', () => {
  it('gives every card a spoken label, face down, with no set marks (any two cards that make the number match)', async () => {
    const { user } = setup();
    await pick(user, 'To 10');
    const deck = deckFor('whole-10', 'medium');
    expect(card(2)).toHaveAccessibleName(/^card 3, face down$/);
    expect(card(2).textContent).not.toMatch(/[●◆]/);
    await user.click(card(2));
    expect(card(2)).toHaveAccessibleName(new RegExp(`^card 3, ${sideText(deck.cards[2].side)}$`));
  });

  it('draws fractions stacked and decimals with fixed places', async () => {
    const { user } = setup();
    await pick(user, 'To 1 \\(hundredths\\)', 'Small');
    const decimals = deckFor('decimal-1-hundredths', 'small');
    await user.click(card(0));
    expect(card(0)).toHaveAccessibleName(new RegExp(`^card 1, ${sideText(decimals.cards[0].side).replace('.', '\\.')}($|,)`));
    expect(sideText(decimals.cards[0].side)).toMatch(/^0\.\d\d$/);
    await user.click(screen.getByRole('button', { name: /Pick another bond/ }));
    await pick(user, 'Eighths', 'Small');
    await user.click(card(0));
    const face = card(0).querySelector('.bm-frac');
    expect(face?.querySelector('.bm-frac__top')?.textContent).toMatch(/^\d$/);
    expect(face?.querySelector('.bm-frac__bottom')?.textContent).toBe('8');
    expect(card(0)).toHaveAccessibleName(/^card 1, \d eighths?$/);
  });

  it('plays a whole game by clicking, and ends on the finish screen with gold stars', async () => {
    const { user } = setup();
    await pick(user, 'To 10', 'Small');
    const deck = deckFor('whole-10', 'small');
    for (const i of perfectFlips(newGame(deck))) await user.click(card(i));
    expect(await screen.findByRole('heading', { name: 'All matched!' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Gold: 3 stars' })).toBeInTheDocument();
    expect(screen.getByText('Gold', { selector: '.bm-stars__name' })).toBeInTheDocument();
    expect(screen.getByTestId('finish-flips')).toHaveTextContent(String(deck.pairCount));
    expect(screen.getByTestId('finish-time')).toHaveTextContent(/^\d+:\d\d$/);
    expect(screen.getByTestId('best-line')).toHaveTextContent(`Your best: ${deck.pairCount} flips`);
  });

  it('shows a mismatch with its sum, keeps it up until the next flip, and that flip turns it back', async () => {
    const { user } = setup();
    await pick(user, 'To 10', 'Small');
    const deck = deckFor('whole-10', 'small');
    const partners = partnersOf(deck);
    const sums = (a: number, b: number) => deck.cards[a].side.kind === 'whole' && deck.cards[b].side.kind === 'whole';
    const a = 0;
    const b = deck.cards.findIndex((_, j) => j !== a && !partners[a].includes(j) && sums(a, j));
    const sum = (deck.cards[a].side as { n: number }).n + (deck.cards[b].side as { n: number }).n;
    await user.click(card(a));
    await user.click(card(b));
    const line = screen.getByRole('status');
    expect(line).toHaveTextContent(`${sideText(deck.cards[a].side)} + ${sideText(deck.cards[b].side)} = ${sum}`);
    expect(line).toHaveTextContent('You need 10');
    // Both stay face up until the next flip.
    expect(card(a)).not.toHaveAccessibleName(/face down/);
    expect(card(b)).not.toHaveAccessibleName(/face down/);
    const c = deck.cards.findIndex((_, j) => j !== a && j !== b);
    await user.click(card(c));
    expect(card(a)).toHaveAccessibleName(/face down/);
    expect(card(b)).toHaveAccessibleName(/face down/);
    expect(card(c)).not.toHaveAccessibleName(/face down/);
    expect(line).toBeEmptyDOMElement();
  });

  it('matches two cards from different deals of a repeated pair: any 3 goes with any 7', async () => {
    const { user } = setup();
    await pick(user, 'To 10', 'Large');
    const deck = deckFor('whole-10', 'large');
    let found: [number, number] | undefined;
    deck.cards.forEach((x, i) => deck.cards.forEach((y, j) => {
      if (!found && i < j && x.pair !== y.pair && arePartners(deck.target, x, y)) found = [i, j];
    }));
    expect(found).toBeDefined();
    await user.click(card(found![0]));
    await user.click(card(found![1]));
    expect(screen.getByRole('status')).toHaveTextContent('= 10');
    expect(card(found![0])).toHaveAccessibleName(new RegExp(`matched with card ${found![1] + 1}$`));
    expect(card(found![1])).toHaveAccessibleName(new RegExp(`matched with card ${found![0] + 1}$`));
    expect(card(found![0]).dataset.matchColour).toBe(card(found![1]).dataset.matchColour);
  });

  it('turns a mismatch back by itself after a few seconds', async () => {
    const { user } = setup({ mismatchMs: 150 });
    await pick(user, 'To 20', 'Small');
    const deck = deckFor('whole-20', 'small');
    const partners = partnersOf(deck);
    const b = deck.cards.findIndex((_, j) => j !== 0 && !partners[0].includes(j));
    await user.click(card(0));
    await user.click(card(b));
    expect(screen.getByRole('status')).toHaveTextContent('You need 20');
    await waitFor(() => expect(screen.getByRole('status')).toBeEmptyDOMElement());
    expect(card(0)).toHaveAccessibleName(/face down/);
    expect(card(b)).toHaveAccessibleName(/face down/);
    // And the board still works: the same two cards can be flipped again.
    await user.click(card(0));
    expect(card(0)).not.toHaveAccessibleName(/face down/);
  });

  it('writes matched pairs with a tick and their own colour, and says who matched', async () => {
    const { user } = setup();
    await pick(user, 'To 10', 'Small');
    const deck = deckFor('whole-10', 'small');
    const [first, second, third, fourth] = perfectFlips(newGame(deck));
    for (const i of [first, second, third, fourth]) await user.click(card(i));
    expect(card(first)).toHaveAccessibleName(new RegExp(`matched with card ${second + 1}`));
    expect(card(first).textContent).toContain('✓');
    const colours = [first, third].map((i) => card(i).getAttribute('data-match-colour'));
    expect(colours[0]).not.toBeNull();
    expect(colours[0]).not.toBe(colours[1]);
    expect(card(first).getAttribute('data-match-colour')).toBe(card(second).getAttribute('data-match-colour'));
    expect(screen.getByRole('status')).toHaveTextContent('A match!');
  });

  it('can hide the flips and the time', async () => {
    const { user } = setup();
    await pick(user, 'To 10', 'Small');
    expect(screen.getByTestId('flips')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide flips and time' }));
    expect(screen.queryByTestId('flips')).toBeNull();
    expect(screen.queryByTestId('time')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show flips and time' }));
    expect(screen.getByTestId('flips')).toHaveTextContent('0');
  });

  it('counts the time in the screen and passes whole seconds to the score (the real clock runs a little during the clicks)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { user } = setup();
      await pick(user, 'To 10', 'Small');
      const deck = deckFor('whole-10', 'small');
      const flips = perfectFlips(newGame(deck));
      await user.click(card(flips[0]));
      await act(async () => { await vi.advanceTimersByTimeAsync(65_400); });
      for (const i of flips.slice(1)) await user.click(card(i));
      expect(await screen.findByTestId('finish-time')).toHaveTextContent(/^1:0[5-9]$/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('fraction pictures', () => {
  afterEach(() => localStorage.clear());

  it('draws a bar under each fraction, with the right parts filled, and still says the fraction aloud', async () => {
    const { user } = setup();
    await pick(user, 'Eighths', 'Small');
    const deck = deckFor('fraction-eighths', 'small');
    await user.click(card(0));
    const side = deck.cards[0].side as { num: number; den: number };
    const bar = card(0).querySelector('[data-testid="fraction-picture"]')!;
    expect(bar.querySelectorAll('.bm-bar-pic__part')).toHaveLength(side.den);
    expect(bar.querySelectorAll('.bm-bar-pic__part--on')).toHaveLength(side.num);
    // The picture is only a hint: hidden from screen readers, and the label and the stacked fraction are still there.
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    expect(card(0)).toHaveAccessibleName(/^card 1, \d eighths?$/);
    expect(card(0).querySelector('.bm-frac__bottom')).toHaveTextContent('8');
  });

  it('can be switched off, and the choice is remembered for the next game', async () => {
    const { user } = setup();
    await pick(user, 'Thirds', 'Small');
    const toggle = screen.getByRole('button', { name: 'Hide pictures' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Show pictures' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelector('[data-testid="fraction-picture"]')).toBeNull();
    expect(localStorage.getItem('sgh-bond-match-pictures')).toBe('false');
    await user.click(screen.getByRole('button', { name: /Pick another bond/ }));
    await pick(user, 'Quarters', 'Small');
    expect(screen.getByRole('button', { name: 'Show pictures' })).toBeInTheDocument();
    expect(document.querySelector('[data-testid="fraction-picture"]')).toBeNull();
  });

  it('is not offered, and not drawn, on whole-number and decimal decks', async () => {
    const { user } = setup();
    await pick(user, 'To 10', 'Small');
    expect(screen.queryByRole('button', { name: /pictures/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Pick another bond/ }));
    await pick(user, 'To 1 \\(tenths\\)', 'Small');
    expect(screen.queryByRole('button', { name: /pictures/ })).toBeNull();
    expect(document.querySelector('[data-testid="fraction-picture"]')).toBeNull();
  });

  it('is on when localStorage is blocked', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {}, clear: () => {} });
    const { user } = setup();
    await pick(user, 'Halves', 'Small');
    expect(document.querySelector('[data-testid="fraction-picture"]')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Hide pictures' }));
    expect(document.querySelector('[data-testid="fraction-picture"]')).toBeNull();
  });
});

describe('decimals that look alike', () => {
  it('always writes the same number of places, so 0.05 and 0.50 differ in their text, not only in a small dot', () => {
    const texts = deckFor('decimal-1-hundredths', 'large').cards.map((c) => sideText(c.side));
    expect(texts.every((x) => /^0\.\d\d$/.test(x))).toBe(true);
    expect(new Set(['0.05', '0.50']).size).toBe(2);
  });

  it('gives the decimal text room: the number is not shrunk on a card, and a card is never under 64px', () => {
    const css = readFileSync(resolve(__dirname, 'bond-match.css'), 'utf8');
    expect(css).toMatch(/--bm-card: clamp\(64px/);
    expect(css).toMatch(/\.bm-card__front \.bm-num \{\s*font-size: 0\.85em;/);
  });
});

describe('the finish screen', () => {
  it('says how stars work, from the real star numbers', async () => {
    const { user } = setup();
    await pick(user, 'To 10', 'Small');
    for (const i of perfectFlips(newGame(deckFor('whole-10', 'small')))) await user.click(card(i));
    await screen.findByRole('heading', { name: 'All matched!' });
    const rule = screen.getByTestId('stars-rule');
    expect(rule).toHaveTextContent(`gold is within ${STAR_CONFIG.goldWithin} times the fewest flips`);
    expect(rule).toHaveTextContent(`silver is within ${STAR_CONFIG.silverWithin} times`);
    expect(STAR_CONFIG).toEqual({ goldWithin: 1.5, silverWithin: 2.5 });
  });
});

describe('saving a finished game', () => {
  const answer = (over: Partial<Extract<SaveResult, { status: 'saved' | 'duplicate' }>> = {}): SaveResult =>
    ({ status: 'saved', points: 2, stars: 3, best: { flips: 6, seconds: 5, stars: 3 }, ...over }) as SaveResult;
  const fakeSaver = (result: SaveResult | null | 'reject', bests: Awaited<ReturnType<BondMatchSaver['loadBests']>> = []) => ({
    save: vi.fn(async () => { if (result === 'reject') throw new Error('offline'); return result; }),
    loadBests: vi.fn(async () => bests),
  });
  const playTo10 = async (user: ReturnType<typeof userEvent.setup>) => {
    await pick(user, 'To 10', 'Small');
    for (const i of perfectFlips(newGame(deckFor('whole-10', 'small')))) await user.click(card(i));
    await screen.findByRole('heading', { name: 'All matched!' });
  };

  it('sends the game itself: run id, seed, bond, size, every flip and the seconds (no stars, they are worked out by the server)', async () => {
    const saver = fakeSaver(answer());
    const { user } = setup({ saver, makeRunId: () => 'run-1' });
    await playTo10(user);
    expect(saver.save).toHaveBeenCalledTimes(1);
    const sent = (saver.save.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(sent).toMatchObject({ runId: 'run-1', seed: SEED, bondId: 'whole-10', size: 'small', flips: perfectFlips(newGame(deckFor('whole-10', 'small'))) });
    expect(Number.isInteger(sent.seconds)).toBe(true);
    expect(Object.keys(sent).sort()).toEqual(['bondId', 'flips', 'mode', 'runId', 'seconds', 'seed', 'size']);
    expect(sent.mode).toBe('solo');
  });

  it('says Saved and how many points were earned', async () => {
    const { user } = setup({ saver: fakeSaver(answer({ points: 2 })) });
    await playTo10(user);
    expect(await screen.findByTestId('save-line')).toHaveTextContent('Saved ✓ You earned 2 points.');
  });

  it('says Saved, with no more points today, when the cap is reached', async () => {
    const { user } = setup({ saver: fakeSaver(answer({ points: 0 })) });
    await playTo10(user);
    expect(await screen.findByTestId('save-line')).toHaveTextContent('No more points today, but your stars are saved.');
  });

  it('says only Saved when the game earned no points to talk about (null)', async () => {
    const { user } = setup({ saver: fakeSaver(answer({ points: null })) });
    await playTo10(user);
    expect(await screen.findByTestId('save-line')).toHaveTextContent(/^Saved ✓$/);
  });

  it('says it will save later when the server cannot be reached', async () => {
    for (const result of [null, 'reject'] as const) {
      const { user } = setup({ saver: fakeSaver(result) });
      await playTo10(user);
      expect(await screen.findByTestId('save-line')).toHaveTextContent('Will save when you are back online.');
      document.body.innerHTML = '';
    }
  });

  it('says nothing more when the server refuses the game for good', async () => {
    const { user } = setup({ saver: fakeSaver({ status: 'invalid', problem: 'too fast' }) });
    await playTo10(user);
    await waitFor(() => expect(screen.queryByTestId('save-line')).toBeNull());
  });

  it('still shows the finish screen and local bests while it is saving', async () => {
    const saver = { save: vi.fn(() => new Promise<SaveResult | null>(() => {})), loadBests: vi.fn(async () => []) };
    const { user } = setup({ saver });
    await playTo10(user);
    expect(screen.getByTestId('save-line')).toHaveTextContent('Saving…');
    expect(screen.getByTestId('best-line')).toHaveTextContent('Your best: 6 flips');
    expect(screen.getByRole('button', { name: 'Play again' })).toBeEnabled();
  });

  it('has no save line, and no stars on the picker, when there is no server', async () => {
    const { user } = setup();
    await playTo10(user);
    expect(screen.queryByTestId('save-line')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Pick another bond' }));
    expect(screen.queryByTestId('stars-whole-10')).toBeNull();
  });

  it('gives Play again a new run id, so each game is saved on its own', async () => {
    const saver = fakeSaver(answer());
    let n = 0;
    const { user } = setup({ saver, makeRunId: () => `run-${++n}` });
    await playTo10(user);
    await user.click(screen.getByRole('button', { name: 'Play again' }));
    for (const i of perfectFlips(newGame(deckFor('whole-10', 'small')))) await user.click(card(i));
    await waitFor(() => expect(saver.save).toHaveBeenCalledTimes(2));
    expect(saver.save.mock.calls.map((c) => (c as unknown[])[0] as { runId: string }).map((g) => g.runId)).toEqual(['run-1', 'run-2']);
  });

  it('shows the stars the student already has on each bond, in words for a screen reader too', async () => {
    const bests = [
      { bondId: 'whole-10', size: 'small', flips: 6, seconds: 30, stars: 3, plays: 2 },
      { bondId: 'whole-10', size: 'large', flips: 20, seconds: 90, stars: 1, plays: 1 },
    ];
    setup({ saver: fakeSaver(answer(), bests) });
    const stars = await screen.findByTestId('stars-whole-10');
    const lit = () => screen.getByTestId('stars-whole-10').querySelectorAll('.bm-bond__star--on').length;
    // The tile shows the stars for the board size that is picked (Medium to start: none yet).
    expect(stars.querySelectorAll('.bm-bond__star')).toHaveLength(3);
    expect(lit()).toBe(0);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Small' }));
    expect(lit()).toBe(3);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Large' }));
    expect(lit()).toBe(1);
    expect(screen.getByRole('button', { name: /^To 10, Large board.*Your best stars: Small 3 stars, Large 1 star$/ })).toBeInTheDocument();
    expect(screen.queryByTestId('stars-whole-20')).toBeNull();
  });

  it('adds the new stars to the picker straight after a game', async () => {
    const { user } = setup({ saver: fakeSaver(answer({ best: { flips: 6, seconds: 5, stars: 3 } })) });
    await playTo10(user);
    await screen.findByText(/Saved ✓/);
    await user.click(screen.getByRole('button', { name: 'Pick another bond' }));
    // Back on the picker, the board size played is still picked, and its new stars show.
    expect(screen.getByRole('button', { name: 'Small' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('stars-whole-10').querySelectorAll('.bm-bond__star--on')).toHaveLength(3);
  });
});

describe('moving less', () => {
  const stubMotion = (reduce: boolean) =>
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));

  it('turns the 3D flip off when the device asks for reduced motion', async () => {
    stubMotion(true);
    const { user } = setup();
    await pick(user, 'To 10', 'Small');
    expect(screen.getByRole('group', { name: 'To 10 board' })).toHaveClass('bm-board--still');
  });

  it('keeps the flip otherwise', async () => {
    stubMotion(false);
    const { user } = setup();
    await pick(user, 'To 10', 'Small');
    expect(screen.getByRole('group', { name: 'To 10 board' })).not.toHaveClass('bm-board--still');
  });
});

describe('keyboard play', () => {
  it('moves between cards with the arrow keys and flips with Enter', async () => {
    const { user } = setup();
    await pick(user, 'To 10', 'Small'); // 12 cards, 4 across
    const deck = deckFor('whole-10', 'small');
    card(0).focus();
    await user.keyboard('{ArrowRight}');
    expect(card(1)).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(card(5)).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowUp}');
    expect(card(0)).toHaveFocus();
    // The edges stop you.
    await user.keyboard('{ArrowUp}{ArrowLeft}');
    expect(card(0)).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(card(8)).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(card(8)).toHaveAccessibleName(new RegExp(`^card 9, ${sideText(deck.cards[8].side)}$`));
  });

  it('plays a whole game with the keyboard alone', async () => {
    const { user } = setup();
    await pick(user, 'Halves', 'Small'); // 4 cards, 2 across
    const deck = deckFor('fraction-halves', 'small');
    const flips = perfectFlips(newGame(deck));
    card(0).focus();
    let at = 0;
    for (const i of flips) {
      // Walk to the card: 2 across.
      while (at !== i) {
        const dx = (i % 2) - (at % 2);
        const dy = Math.floor(i / 2) - Math.floor(at / 2);
        await user.keyboard(dx > 0 ? '{ArrowRight}' : dx < 0 ? '{ArrowLeft}' : dy > 0 ? '{ArrowDown}' : '{ArrowUp}');
        at = Number((document.activeElement as HTMLElement).dataset.index);
      }
      await user.keyboard(' ');
    }
    expect(await screen.findByRole('heading', { name: 'All matched!' })).toBeInTheDocument();
  });
});

describe('best scores', () => {
  const playPerfect = async (user: ReturnType<typeof userEvent.setup>) => {
    for (const i of perfectFlips(newGame(deckFor('whole-10', 'small')))) await user.click(card(i));
    await screen.findByRole('heading', { name: 'All matched!' });
  };

  it('saves the best for this bond and board size in localStorage', async () => {
    const { user } = setup();
    await pick(user, 'To 10', 'Small');
    await playPerfect(user);
    const saved = JSON.parse(localStorage.getItem('sgh-bond-match-bests')!);
    expect(saved['whole-10:small']).toMatchObject({ flips: 6 });
    expect(saved['whole-10:medium']).toBeUndefined();
  });

  it('says when a game beats the saved best, and plays again with a new seed and the same bond', async () => {
    localStorage.setItem('sgh-bond-match-bests', JSON.stringify({ 'whole-10:small': { flips: 20, seconds: 0 } }));
    let n = 0;
    const makeSeed = vi.fn(() => SEED + (n++ % 2)); // seeds 7 then 8
    const { user } = setup({ makeSeed });
    await pick(user, 'To 10', 'Small');
    await playPerfect(user);
    expect(screen.getByTestId('best-line')).toHaveTextContent('Your best: 6 flips');
    expect(screen.getByTestId('best-line')).toHaveTextContent('New best for fewest flips!');
    expect(screen.getByTestId('best-line')).not.toHaveTextContent('New best time!');
    await user.click(screen.getByRole('button', { name: 'Play again' }));
    expect(makeSeed).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('group', { name: 'To 10 board' })).toBeInTheDocument();
    // The second game used the second seed: its deck is laid out as that seed's deck is.
    const deck = deckFor('whole-10', 'small', SEED + 1);
    for (const i of perfectFlips(newGame(deck))) await user.click(card(i));
    expect(await screen.findByTestId('finish-flips')).toHaveTextContent('6');
    await user.click(screen.getByRole('button', { name: 'Pick another bond' }));
    expect(screen.getByRole('heading', { name: 'What are you practising?' })).toBeInTheDocument();
  });

  it('still plays when localStorage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const { user } = setup();
    await pick(user, 'To 10', 'Small');
    await playPerfect(user);
    expect(screen.getByTestId('best-line')).toHaveTextContent('Your best: 6 flips');
    vi.restoreAllMocks();
  });
});

describe('in the hub', () => {
  it('is in the game registry, behind the teacher\'s per-class switch', () => {
    expect(GAMES.map((g) => g.id)).toContain('bond-match');
    expect(findGame('bond-match')).toBe(bondMatch);
    expect(bondMatch.useTeacherSwitch).toBeTypeOf('function');
    expect(bondMatch.teacher?.switch).toBeDefined();
    expect(bondMatch.teacher?.StudentPanel).toBeDefined();
    expect(bondMatch.group).toBe('easy-maths');
  });

  it('is never ranked', () => {
    expect(bondMatch.name).toBe('Bond Match');
    expect(bondMatch.ranked).toBe(false);
  });
});

describe('two players and the computer', () => {
  function setupVersus(props: { saver?: BondMatchSaver; random?: () => number } = {}) {
    const user = userEvent.setup();
    render(
      <SoundProvider>
        <BondMatchPlay makeSeed={() => SEED} finishMs={0} mismatchMs={60_000} saver={props.saver} botMs={0} botAfterMismatchMs={0} random={props.random ?? (() => 0.99)} />
      </SoundProvider>,
    );
    return { user };
  }
  const deck = () => deckFor('whole-10', 'small');
  const wrongFor = (i: number) => deck().cards.findIndex((_, j) => j !== i && !partnersOf(deck())[i].includes(j));

  it('offers Just me, Two players and Me vs the computer, with Just me to start', () => {
    setupVersus();
    const group = screen.getByRole('group', { name: 'Who’s playing?' });
    expect(within(group).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Just me', 'Two players', 'Me vs the computer']);
    expect(within(group).getByRole('button', { name: 'Just me' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('group', { name: 'How good is the computer?' })).toBeNull();
  });

  it('two players take turns: a match goes again, a mismatch passes; most pairs wins', async () => {
    const saver = { save: vi.fn(async () => ({ status: 'saved', points: 2, stars: 1, best: null }) as SaveResult), loadBests: vi.fn(async () => []) };
    const { user } = setupVersus({ saver });
    await user.click(screen.getByRole('button', { name: 'Two players' }));
    await pick(user, 'To 10', 'Small');
    expect(screen.getByTestId('turn')).toHaveTextContent('Player 1’s turn');
    // Player 1 misses, so it is Player 2's turn, and Player 2 finds every pair.
    await user.click(card(0));
    await user.click(card(wrongFor(0)));
    expect(screen.getByTestId('turn')).toHaveTextContent('Player 2’s turn');
    for (const i of perfectFlips(newGame(deck()))) await user.click(card(i));
    expect(await screen.findByTestId('winner')).toHaveTextContent('Player 2 wins!');
    expect(screen.getByTestId('pairs-score')).toHaveTextContent('Player 1: 0 pairs. Player 2: 6 pairs.');
    expect(screen.queryByText(/Gold|Silver|Bronze/)).toBeNull();
    const sent = (saver.save.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(sent.mode).toBe('pass');
    expect(await screen.findByTestId('save-line')).toHaveTextContent('Saved ✓ You earned 2 points.');
  });

  it('the computer takes its turn by itself, and the child cannot flip while it does', async () => {
    const saver = { save: vi.fn(async () => ({ status: 'saved', points: 2, stars: 1, best: null }) as SaveResult), loadBests: vi.fn(async () => []) };
    const { user } = setupVersus({ saver });
    await user.click(screen.getByRole('button', { name: 'Me vs the computer' }));
    const levels = screen.getByRole('group', { name: 'How good is the computer?' });
    expect(within(levels).getAllByRole('button').map((b) => b.textContent)).toEqual(['Very Easy', 'Easy', 'Medium']);
    await user.click(within(levels).getByRole('button', { name: 'Medium' }));
    await pick(user, 'To 10', 'Small');
    expect(screen.getByTestId('turn')).toHaveTextContent('Your turn');
    // A miss hands the board to the computer, which plays on until the board is clear or it misses.
    await user.click(card(0));
    await user.click(card(wrongFor(0)));
    // Then take turns until the board is clear: the computer plays its own turns, the test plays the child's.
    for (let n = 0; n < 200 && !screen.queryByTestId('winner'); n++) {
      if (screen.getByTestId('turn').textContent?.includes('Your turn')) {
        const down = deck().cards.findIndex((_, i) => card(i).getAttribute('aria-label')?.includes('face down'));
        if (down < 0) break;
        await user.click(card(down));
      } else {
        await act(() => new Promise((r) => setTimeout(r, 5)));
      }
    }
    expect(await screen.findByTestId('winner')).toHaveTextContent(/You win!|The computer wins this time!|It’s a tie!/);
    const sent = (saver.save.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(sent.mode).toBe('bot');
  });

  it('the computer\'s flips are ignored for a tap: tapping during its turn does nothing', async () => {
    const user = userEvent.setup();
    render(
      <SoundProvider>
        <BondMatchPlay makeSeed={() => SEED} finishMs={0} mismatchMs={60_000} botMs={60_000} botAfterMismatchMs={60_000} random={() => 0.99} />
      </SoundProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Me vs the computer' }));
    await pick(user, 'To 10', 'Small');
    await user.click(card(0));
    await user.click(card(wrongFor(0)));
    expect(screen.getByTestId('turn')).toHaveTextContent('The computer’s turn');
    const other = deck().cards.findIndex((_, i) => i !== 0 && i !== wrongFor(0));
    await user.click(card(other));
    expect(card(other)).toHaveAccessibleName(/face down/);
  });
});
