/**
 * Every word a student sees in Bond Match, in one place (NZ English).
 */
import type { Shelf } from '../../../shared/bond-match/bonds';
import type { BoardSize } from '../../../shared/bond-match/deck';
import type { Stars } from '../../../shared/bond-match/score';

const DENOMINATORS: Record<number, [string, string]> = {
  2: ['half', 'halves'],
  3: ['third', 'thirds'],
  4: ['quarter', 'quarters'],
  5: ['fifth', 'fifths'],
  6: ['sixth', 'sixths'],
  8: ['eighth', 'eighths'],
  10: ['tenth', 'tenths'],
};

/** How a card or sum is said aloud: "3/8" is "3 eighths", "0.30" is "0.30". */
export function speak(text: string): string {
  const m = /^(\d+)\/(\d+)$/.exec(text);
  if (!m) return text;
  const num = Number(m[1]);
  const words = DENOMINATORS[Number(m[2])];
  if (!words) return `${num} over ${m[2]}`;
  return num === 1 ? `1 ${words[0]}` : `${num} ${words[1]}`;
}

/** A time in whole seconds as m:ss. */
export const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export const SHELVES: { id: Exclude<Shelf, 'mixed'>; name: string }[] = [
  { id: 'whole', name: 'Whole numbers' },
  { id: 'decimal', name: 'Decimals' },
  { id: 'fraction', name: 'Fractions' },
];

export const SIZE_NAMES: Record<BoardSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' };

export const STAR_NAMES: Record<Stars, string> = { 3: 'Gold', 2: 'Silver', 1: 'Bronze' };

/** The two colour sets: a shape and a letter as well as a colour, so nobody has to tell them apart by colour. */
export const COLOUR_SETS = [
  { name: 'blue circle', letter: 'A', shape: '●' },
  { name: 'orange diamond', letter: 'B', shape: '◆' },
] as const;

export const TEXT = {
  name: 'Bond Match',
  tagline: 'Find the pairs that make the number!',
  pickTitle: 'What are you practising?',
  pickHelp: 'Flip two cards. If they add up to the number, they stay up.',
  sizeTitle: 'Board size',
  sizeOption: (size: BoardSize, cards: number) => `${SIZE_NAMES[size]} (${cards} cards)`,
  pairs: (n: number) => (n === 1 ? '1 pair' : `${n} pairs`),
  bondButton: (label: string, size: BoardSize, pairs: number) => `${label}, ${SIZE_NAMES[size]} board, ${pairs === 1 ? '1 pair' : `${pairs} pairs`}`,
  pairsEachHelp: 'Under each bond: how many pairs it makes on a Small, Medium and Large board. Your board size is in bold.',
  board: (setLabel: string) => `${setLabel} board`,
  flips: 'Flips',
  time: 'Time',
  hideStats: 'Hide flips and time',
  showStats: 'Show flips and time',
  statsHidden: 'Flips and time are hidden.',
  quit: 'Pick another bond',
  cardDown: (n: number) => `card ${n}, face down`,
  cardUp: (n: number, face: string) => `card ${n}, ${speak(face)}`,
  cardMatched: (n: number, face: string, partner: number) => `card ${n}, ${speak(face)}, matched with card ${partner}`,
  setOf: (name: string) => `${name} set`,
  tick: 'matched',
  mismatch: (a: string, b: string, sum: string) => `${a} + ${b} = ${sum}`,
  mismatchNeed: (target: string) => `You need ${target}. Keep going!`,
  mismatchWrongSet: (target: string) => `That makes ${target}, but it is the wrong colour set. Pair cards with the same mark.`,
  spokenMismatch: (a: string, b: string, sum: string) => `${speak(a)} plus ${speak(b)} equals ${speak(sum)}`,
  match: 'A match!',
  finishTitle: 'All matched!',
  starsLine: (stars: Stars) => `${STAR_NAMES[stars]}: ${stars} ${stars === 1 ? 'star' : 'stars'}`,
  flipsDone: (n: number) => `${n} ${n === 1 ? 'flip' : 'flips'}`,
  bestLine: (flips: number, seconds: number) => `Your best: ${flips} ${flips === 1 ? 'flip' : 'flips'}, ${clock(seconds)}`,
  bestLineSplit: (flips: number, seconds: number) => `Your fewest flips: ${flips}. Your fastest time: ${clock(seconds)}.`,
  newBestFlips: 'New best for fewest flips!',
  newBestTime: 'New best time!',
  firstGame: 'That is your first game on this board. Beat it next time!',
  minHint: (min: number) => `The fewest possible is ${min}.`,
  again: 'Play again',
  another: 'Pick another bond',
};
