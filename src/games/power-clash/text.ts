import type { PowerId } from '../../../shared/power-clash/types';

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
