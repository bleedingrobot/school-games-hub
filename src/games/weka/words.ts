/** Everything the game says. Short, because it is read aloud to children of 5 to 7. */
import type { Metal } from '../../../shared/weka/progress';
import type { Level } from '../../../shared/weka/round';

const LEVEL_WORDS: Record<Level, string> = {
  1: 'Starting on 9',
  2: 'Starting on 8',
  3: 'Starting on 7 and 6',
  4: 'All mixed up',
};

export const WORDS = {
  title: 'Weka’s Stepping Stones',
  wants: (name: string) => `${name} wants to cross the stream! Help ${name} hop to the picnic.`,
  nextFriend: (name: string) => `Now ${name} has a new stream to cross!`,
  level: (level: Level) => LEVEL_WORDS[level],
  dayCount: (day: number) => `Day ${day} of 30`,
  play: 'Play',
  playAgain: 'Play again',
  pickNumber: 'Tap the right number.',
  goesDone: (n: number, of: number) => `${n} of ${of} done`,
  guideHere: 'try this one',
  tryAgain: 'Try again!',
  /** The second wrong tap on the first step: Bella counts the hops to the big rock with the child. */
  countWithMe: 'Let’s count the hops together.',
  yes: (n: number) => `${n}!`,
  bigRock: 'The big rock is 10.',
  hearAgain: 'Hear it again',
  stoneTurned: (metal: Metal) => `Well done! A stone turned ${metal}!`,
  doneToday: 'Well done! Come back tomorrow to change another stone.',
  levelUp: (level: Level) => `You are so good at this! Next time: ${LEVEL_WORDS[level].toLowerCase()}.`,
  goldenBasket: (name: string) => `All the stones are gold! ${name} found the Golden Picnic Basket!`,
  wentWrong: 'Something went wrong. Please try again soon.',
  home: 'Home',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  basketsWon: (n: number) => `${n} Golden Picnic Basket${n === 1 ? '' : 's'}`,
} as const;
