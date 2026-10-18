import type { ChaosKind, GameEvent, PowerId, WildEffect } from '../../../shared/power-clash/types';

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
  {
    id: 'force-field',
    name: 'Force Field',
    icon: '🛡️',
    blurb: 'Protect one of your symbols until your next go.',
    steps: ['Tap one of YOUR symbols to protect'],
  },
  {
    id: 'portal-chaos',
    name: 'Portal Chaos',
    icon: '🌪️',
    blurb: 'Pick two symbols. Portals throw them to random squares!',
    steps: ['Tap the first symbol', 'Tap the second symbol'],
  },
  {
    id: 'wild-card',
    name: 'Wild Card',
    icon: '🎰',
    blurb: 'Spin the wheel for a random power-up.',
    steps: [],
  },
  {
    id: 'time-heist',
    name: 'Time Heist',
    icon: '⏪',
    blurb: 'Undo their last go. Once a match!',
    steps: [],
  },
];

export const WILD_NAMES: Record<WildEffect, string> = {
  bonus: 'Bonus placement',
  freeze: 'Freeze',
  swap: 'Swap',
  remove: 'Blast',
};
export const WILD_ICONS: Record<WildEffect, string> = { bonus: '⚡', freeze: '❄️', swap: '🌀', remove: '💥' };

export const CHAOS_NAMES: Record<ChaosKind, string> = {
  earthquake: 'Earthquake!',
  'frost-wave': 'Frost wave!',
  meteor: 'Meteor!',
  'lucky-star': 'Lucky star!',
  recharge: 'Recharge!',
};
export const CHAOS_ICONS: Record<ChaosKind, string> = {
  earthquake: '🌋',
  'frost-wave': '🥶',
  meteor: '☄️',
  'lucky-star': '⭐',
  recharge: '🔋',
};

export const powerInfo = (id: PowerId) => POWERS.find((p) => p.id === id)!;

/** Short, kind, funny shouts. Picked in turn (not at random) so they are easy to test. */
export const SHOUTS = {
  'bonus-move': ['BONUS MOVE!', 'TWICE AS NICE!', 'ZAP ZAP!'],
  'body-swap': ['SWITCHEROO!', 'THAT WAS YOUR PLAN?!', 'PLOT TWIST!'],
  'freeze-ray': ['TIME CRIME!', 'BRRR! CHILLY!', 'STAY COOL!'],
  'board-wipe': ['KABOOM!', 'ABSOLUTE DISASTER.', 'YOU HAD ONE JOB.'],
  'force-field': ['SHIELDS UP!', 'NOTHING GETS PAST!', 'TACTICAL GENIUS. PROBABLY.'],
  'portal-chaos': ['PORTAL CHAOS!', 'WHERE DID IT GO?!', 'WHOOSH!'],
  'wild-card': ['WILD CARD!', 'SPIN IT!', 'ANYTHING CAN HAPPEN!'],
  'time-heist': ['TIME CRIME!', 'REWIND!', 'NOBODY SAW THAT.'],
  chaos: ['CHAOS!', 'SURPRISE!', 'WHAT WAS THAT?!'],
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
    if (e.kind === 'bonus-move') parts.push('The bot got a bonus move.');
    else if (e.kind === 'body-swap') parts.push(`The bot swapped ${squareName(e.squares[0])} with ${squareName(e.squares[1])}.`);
    else if (e.kind === 'freeze') parts.push(`The bot froze ${squareName(e.square)}.`);
    else if (e.kind === 'wipe') parts.push(`The bot blasted the symbol on ${squareName(e.square)}.`);
    else if (e.kind === 'force-field') parts.push(`The bot put a Force Field on ${squareName(e.square)}.`);
    else if (e.kind === 'portal-chaos') parts.push(`The bot used Portal Chaos on ${squareName(e.from[0])} and ${squareName(e.from[1])}.`);
    else if (e.kind === 'wild-card') parts.push(`The bot spun the Wild Card and got: ${WILD_NAMES[e.effect]}.`);
    else if (e.kind === 'time-heist') parts.push('The bot used Time Heist and undid your last go.');
    else if (e.kind === 'place') parts.push(`The bot put ${e.player} on ${squareName(e.square)}.`);
    else if (e.kind === 'skip') parts.push('The bot missed a go.');
    else if (e.kind === 'chaos') parts.push(chaosLine(e));
  }
  return parts.join(' ');
}

/** The names of the powers someone picked, as a short list for the waiting room. */
export function powerNames(powers: PowerId[] | null): string {
  if (!powers) return 'not picked yet';
  return powers.map((p) => POWERS.find((info) => info.id === p)?.name ?? p).join(', ');
}

/** The one-line explanation of a Chaos Mode surprise (also read out). */
export function chaosLine(e: Extract<GameEvent, { kind: 'chaos' }>, names: { X: string; O: string } = { X: 'X', O: 'O' }): string {
  const who = names[e.affects];
  switch (e.event) {
    case 'earthquake':
      return `Earthquake! Two symbols (${squareName(e.squares[0])} and ${squareName(e.squares[1])}) traded places.`;
    case 'frost-wave':
      return `Frost wave! ${squareName(e.squares[0])} is frozen for ${who}.`;
    case 'meteor':
      return `Meteor! The symbol on ${squareName(e.squares[0])} was blasted away.`;
    case 'lucky-star':
      return `Lucky star! ${who} places two symbols this go.`;
    case 'recharge':
      return `Recharge! ${who} gets a used power back${e.power ? ` (${POWERS.find((p) => p.id === e.power)?.name ?? ''})` : ''}.`;
  }
}
