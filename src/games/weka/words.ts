/** Everything the game says. Short, because it is read aloud to children of 5 to 7. */
import type { Metal } from '../../../shared/weka/progress';
import type { Level } from '../../../shared/weka/round';

const LEVEL_WORDS: Record<Level, string> = {
  1: 'Doubles to 5',
  2: 'Halves to 10',
  3: 'Doubles to 10',
  4: 'Halves to 20',
};

export const WORDS = {
  title: 'Weka’s Stepping Stones',
  wants: (name: string) => `${name} is hungry! Help ${name} catch fish at the mirror pool.`,
  nextFriend: (name: string) => `Now ${name} has a new pool to fish in!`,
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
  pebbleTurned: (metal: Metal) => `Well done! A pebble turned ${metal}!`,
  doneToday: 'Well done! Come back tomorrow to change another pebble.',
  levelUp: (level: Level) => `You are so good at this! Next time: ${LEVEL_WORDS[level].toLowerCase()}.`,
  goldenBasket: (name: string) => `All the pebbles are gold! ${name} caught the Golden Fish!`,
  wentWrong: 'Something went wrong. Please try again soon.',
  home: 'Home',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  fishWon: (n: number) => `${n} Golden Fish`,
} as const;
