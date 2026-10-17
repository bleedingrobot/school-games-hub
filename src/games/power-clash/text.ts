import type { GameEvent, PowerId } from '../../../shared/power-clash/types';

export const TEXT = {
  name: 'Tic-Tac-Toe: Power Clash',
  tagline: 'Tiny board. Ridiculous powers.',
};

export interface PowerInfo {
  id: PowerId;
  name: string;
  icon: string;
  blurb: string;
  /** What to tap after choosing the card, one line per target. */
  steps: string[];
}

export const POWERS: PowerInfo[] = [
  { id: 'double-trouble', name: 'Double Trouble', icon: '⚡', blurb: 'Place two symbols this turn.', steps: [] },
  {
    id: 'body-swap',
    name: 'Body Swap',
    icon: '🌀',
    blurb: 'Swap one of your symbols with one of theirs.',
    steps: ['Tap one of YOUR symbols', 'Now tap one of THEIR symbols'],
  },
  {
    id: 'freeze-ray',
    name: 'Freeze Ray',
    icon: '❄️',
    blurb: 'Your opponent can’t use an empty square on their next turn.',
    steps: ['Tap an empty square to freeze'],
  },
  {
    id: 'board-wipe',
    name: 'Board Wipe',
    icon: '💥',
    blurb: 'Blast any one symbol off the board.',
    steps: ['Tap a symbol to blast'],
  },
];

export const powerInfo = (id: PowerId) => POWERS.find((p) => p.id === id)!;

/** Short, kind, funny shouts. Picked in turn (not at random) so they are easy to test. */
export const SHOUTS = {
  'double-trouble': ['DOUBLE TROUBLE!', 'TWICE AS NICE!', 'ZAP ZAP!'],
  'body-swap': ['SWITCHEROO!', 'THAT WAS YOUR PLAN?!', 'PLOT TWIST!'],
  'freeze-ray': ['TIME CRIME!', 'BRRR! CHILLY!', 'STAY COOL!'],
  'board-wipe': ['KABOOM!', 'ABSOLUTE DISASTER.', 'YOU HAD ONE JOB.'],
  skip: ['OH NO! MISSED GO!', 'SNOOZE YOU LOSE!'],
  win: ['WHAT A MOVE!', 'THREE IN A ROW!', 'NICELY DONE!'],
  draw: ['SO CLOSE!', 'A TIE! NICE TRY!'],
  match: ['CLASH CHAMPION!', 'MATCH WINNER!'],
} as const;

export type ShoutKind = keyof typeof SHOUTS;
export const shout = (kind: ShoutKind, n: number) => SHOUTS[kind][n % SHOUTS[kind].length];

/** What the bot is called in a game, by level. */
export const BOT_NAMES: Record<'very-easy' | 'easy' | 'medium', string> = {
  'very-easy': 'The Very Easy bot',
  easy: 'The Easy bot',
  medium: 'The Medium bot',
};

const COLUMN = ['left', 'middle', 'right'];
const ROW = ['top', 'middle', 'bottom'];

/** "the middle square", "the top-left square": how a square is said out loud. */
export function squareName(i: number): string {
  const row = ROW[Math.floor(i / 3)];
  const col = COLUMN[i % 3];
  if (i === 4) return 'the middle square';
  if (row === 'middle') return `the middle-${col} square`;
  if (col === 'middle') return `the ${row}-middle square`;
  return `the ${row}-${col} square`;
}

/** What the bot just did, in a sentence for the screen reader and the message line. */
export function botLine(events: GameEvent[]): string {
  const parts: string[] = [];
  for (const e of events) {
    if (e.kind === 'double-trouble') parts.push('The bot used Double Trouble.');
    else if (e.kind === 'body-swap') parts.push(`The bot swapped ${squareName(e.squares[0])} with ${squareName(e.squares[1])}.`);
    else if (e.kind === 'freeze') parts.push(`The bot froze ${squareName(e.square)}.`);
    else if (e.kind === 'wipe') parts.push(`The bot blasted the symbol on ${squareName(e.square)}.`);
    else if (e.kind === 'place') parts.push(`The bot put ${e.player} on ${squareName(e.square)}.`);
    else if (e.kind === 'skip') parts.push('The bot missed a go.');
  }
  return parts.join(' ');
}

/** The names of the powers someone picked, as a short list for the waiting room. */
export function powerNames(powers: PowerId[] | null): string {
  if (!powers) return 'not picked yet';
  return powers.map((p) => POWERS.find((info) => info.id === p)?.name ?? p).join(', ');
}
