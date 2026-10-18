import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOND_SETS, findBondSet } from '../../../shared/bond-match/bonds';
import { BOARD_SIZES, arePartners, buildDeck, pairsOnBoard, partnersOf, type BoardSize } from '../../../shared/bond-match/deck';
import { newGame } from '../../../shared/bond-match/engine';
import { sideText } from '../../../shared/bond-match/exact';
import { perfectFlips } from '../../../shared/bond-match/perfectPlayer';
import { SoundProvider } from '../../sound';
import { GAMES, findGame } from '../registry';
import { BondMatchPlay } from './BondMatchPlay';
import { bondMatch } from './index';

const SEED = 7;

afterEach(() => vi.unstubAllGlobals());

function setup(props: { makeSeed?: () => number; mismatchMs?: number } = {}) {
  const user = userEvent.setup();
  const makeSeed = props.makeSeed ?? vi.fn(() => SEED);
  render(
    <SoundProvider>
      <BondMatchPlay makeSeed={makeSeed} finishMs={0} mismatchMs={props.mismatchMs ?? 60_000} />
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
    expect(within(size).getAllByRole('button').map((b) => b.textContent)).toEqual(['Small', 'Medium', 'Large']);
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

describe('the board', () => {
  it('gives every card a spoken label, face down, and shows the set on it', async () => {
    const { user } = setup();
    await pick(user, 'To 10');
    const deck = deckFor('whole-10', 'medium');
    expect(card(2)).toHaveAccessibleName(/^card 3, face down/);
    // The deck repeats pairs, so both colour sets are in use and are said aloud.
    expect(deck.cards.some((c) => c.set === 1)).toBe(true);
    expect(card(2)).toHaveAccessibleName(/(blue circle|orange diamond) set$/);
    // The mark is on the card face down: a shape and a letter, not just a colour.
    expect(card(2).textContent).toMatch(/[●◆][AB]/);
    await user.click(card(2));
    expect(card(2)).toHaveAccessibleName(new RegExp(`^card 3, ${sideText(deck.cards[2].side)},`));
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
    expect(card(0)).toHaveAccessibleName(/^card 1, \d eighths?,/);
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

  it('says so when two cards make the target but are the wrong colour', async () => {
    const { user } = setup();
    await pick(user, 'To 10', 'Large');
    const deck = deckFor('whole-10', 'large');
    let found: [number, number] | undefined;
    deck.cards.forEach((x, i) => deck.cards.forEach((y, j) => {
      if (!found && i < j && x.set !== y.set && arePartners(deck.target, x, { ...y, set: x.set })) found = [i, j];
    }));
    expect(found).toBeDefined();
    await user.click(card(found![0]));
    await user.click(card(found![1]));
    expect(screen.getByRole('status')).toHaveTextContent('That makes 10, but it is the wrong colour set');
    expect(screen.getByRole('status')).toHaveTextContent('= 10');
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
    expect(card(8)).toHaveAccessibleName(new RegExp(`^card 9, ${sideText(deck.cards[8].side)},`));
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

describe('not live yet', () => {
  it('is not in the game registry', () => {
    expect(GAMES.map((g) => g.id)).not.toContain('bond-match');
    expect(findGame('bond-match')).toBeUndefined();
  });

  it('has a game definition ready for M.7', () => {
    expect(bondMatch.id).toBe('bond-match');
    expect(bondMatch.name).toBe('Bond Match');
    expect(bondMatch.ranked).toBe(false);
  });

  it('is not imported by anything outside its own folder, the preview and its tests', async () => {
    const { execSync } = await import('node:child_process');
    const hits = execSync("grep -rIl 'games/bond-match\\|from \\./bond-match\\|bond-match/index' src preview supabase --include=*.ts --include=*.tsx || true", { cwd: process.cwd() })
      .toString().split('\n').filter(Boolean)
      .filter((f) => !f.startsWith('src/games/bond-match/'));
    expect(hits).toEqual(['preview/bond-match/main.tsx']);
  });
});
