/** Everything the game says. Short, because it is read aloud to children of 5 to 7. */
import type { Metal } from '../../../shared/korora/progress';
import type { Level } from '../../../shared/korora/round';

const LEVEL_WORDS: Record<Level, string> = {
  1: 'Doubles to 5',
  2: 'Halves to 10',
  3: 'Doubles to 10',
  4: 'Halves to 20',
};

export const WORDS = {
  title: 'Penguin Pairs',
  wants: (name: string) => `${name} wants a pair of dancing shoes! Help ${name} across the stepping stones.`,
  nextFriend: (name: string) => `Now ${name} wants dancing shoes too!`,
  level: (level: Level) => LEVEL_WORDS[level],
  dayCount: (day: number) => `Day ${day} of 30`,
  play: 'Play',
  playAgain: 'Play again',
  pickNumber: 'Tap the right number.',
  goesDone: (n: number, of: number) => `${n} of ${of} done`,
  guideHere: 'try this one',
  tryAgain: 'Try again!',
  /** The second wrong tap: the pictures come back and Bella counts the fish with the child. */
  countWithMe: 'Let’s count them together.',
  yes: (n: number) => `${n}!`,
  fair: 'Fair share',
  notFair: 'One left over',
  fairYes: 'Yes! They share them fairly.',
  notFairYes: 'Yes! There is one left over.',
  afterDouble: (n: number) => `Double ${n} is ${2 * n}. So what is half of ${2 * n}?`,
  hearAgain: 'Hear it again',
  tapToCount: 'Tap the fish to count them.',
  tapToShare: 'Tap a fish to give it to a chick.',
  shareAgain: 'Start again',
  pebbleTurned: (metal: Metal) => `Well done! A stepping stone turned ${metal}!`,
  doneToday: 'Well done! Come back tomorrow to change another stepping stone.',
  levelUp: (level: Level) => `You are so good at this! Next time: ${LEVEL_WORDS[level].toLowerCase()}.`,
  /** A crossing done: bronze shoes, then silver, then (all the stones gold) the dazzling gold ones. */
  shoesWon: (metal: Exclude<Metal, 'grey'>, name: string) =>
    metal === 'gold' ? `All the stones are gold! ${name} won the dazzling gold dancing shoes!` : `${name} crossed the water and won ${metal} dancing shoes!`,
  shoesName: (metal: Exclude<Metal, 'grey'>) => (metal === 'gold' ? 'Dazzling gold dancing shoes' : `${metal[0].toUpperCase()}${metal.slice(1)} dancing shoes`),
  wentWrong: 'Something went wrong. Please try again soon.',
  home: 'Home',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  goldShoesWon: (n: number) => `${n} ${n === 1 ? 'pair' : 'pairs'} of dazzling gold dancing shoes`,
} as const;
