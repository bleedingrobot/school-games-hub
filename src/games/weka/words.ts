/** Everything the game says. Short, because it is read aloud to children of 5 to 7. */
import type { Metal } from '../../../shared/weka/progress';
import type { Level, LandKind } from '../../../shared/weka/round';

const LEVEL_WORDS: Record<Level, string> = {
  1: 'Starting on 9',
  2: 'Starting on 8',
  3: 'Starting on 7 and 6',
  4: 'All mixed up',
};


export const WORDS = {
  title: 'Weka’s Stepping Stones',
  /** The home page chip's word: "Today's stone is ready". */
  part: 'stone',
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
  /** A right answer on a go with help: the number in English, then the make-ten sentence ("13! 10 and 3 make 13."). Te reo numbers taken out 5 Nov 2026 (James). */
  rightAdd: (n: number, rest: number) => `${n}! 10 and ${rest} make ${n}.`,
  rightBack: (n: number, rest: number) => `${n}! 10 take away ${rest} is ${n}.`,
  bigRock: 'The big rock is 10.',
  /** Mistakes that teach (maths review R5): the second wrong tap of a question, and the same question again. */
  lookTogether: 'Let’s look together.',
  nowTry: 'Now you try one like it.',
  goOn: 'Go on',
  /** The first wrong tap: why that number is not it, one line for each mistake (never the answer). */
  whyRockAdd: (rest: number) => `That is where Weka is. ${rest} more ${rest === 1 ? 'hop' : 'hops'}.`,
  whyRockBack: (rest: number) => `That is the big rock. ${rest} more ${rest === 1 ? 'hop' : 'hops'} back.`,
  whyDouble: (small: number, toTen: number, rest: number) => `${small} is ${toTen} and ${rest}. The ${toTen} got Weka to the rock.`,
  whyPart: (big: number, toTen: number, rest: number) => `${big} and ${toTen} make 10. We still have ${rest}.`,
  whyOff1: (small: number) => `Count Weka’s hops. Is it ${small} hops?`,
  whyAdd: 'Hopping back means going down the stones.',
  whyOther: (from: number) => `Weka only hops to the big rock. Look how far it is from ${from}.`,
  whyTen: '10 is the big rock. How many hops get there?',
  whyNear: (from: number) => `Count the hops from ${from} to the big rock.`,
  /** A wrong number in the split: what the tapped number makes (never the answer). */
  whySplitFirstAdd: (big: number, n: number) => `${big} and ${n} make ${big + n}. We need to land on 10.`,
  whySplitFirstBack: (from: number, n: number) => `${from} take away ${n} is ${from - n}. We need to land on 10.`,
  whySplitRest: (toTen: number, n: number, small: number) => `${toTen} and ${n} make ${toTen + n}. We have ${small}.`,
  skip: 'Skip',
  demoTitle: 'Watch Weka show one first.',
  hearAgain: 'Hear it again',
  /** The split after each right answer: the bond's label while it is being filled in, and the button after it. */
  splitLabel: (n: number) => `How did you split the ${n}?`,
  /** Split-first goes (later in the game): the bond's label while the child splits the number before answering. */
  splitFirstLabel: (n: number) => `Split the ${n} to get to ten.`,
  /** The pebble step: the same question again in two ten-frames (James, 6 Nov 2026). */
  sameQuestion: 'Same question:',
  pebblesIn: (n: number) => `${n}`,
  tenFull: '10',
  check: 'Check',
  putBackPebble: 'Silver pebble: put it back',
  movePebble: 'Silver pebble: move it to the first ten-frame',
  next: 'Next',
  finish: 'Finish',
  /** The tail of the finish title, after the opening for how the day went (S33). */
  stoneTurned: (metal: Metal) => `A stone turned ${metal}.`,
  doneToday: 'Come back tomorrow to change another stone.',
  /** The opening of the finish title and, on a golden day, the chip: about the hops, not about the child (S33). */
  how: {
    most: 'You hopped to ten and then on!',
    some: 'Some were tricky and you kept going.',
    tricky: 'Those were tricky ones.',
  },
  /** The chip on a tricky day: a wrong first tap brings the fact's full help back. */
  trickyChip: 'The tricky ones will come back with more help.',
  levelUp: (level: Level) => `Making ten first is paying off. Next time: ${LEVEL_WORDS[level].toLowerCase()}.`,
  goldenBasket: (name: string) => `All the stones are gold! ${name} found the Golden Picnic Basket!`,
  wentWrong: 'Something went wrong. Please try again soon.',
  home: 'Home',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  basketsWon: (n: number) => `${n} Golden Picnic Basket${n === 1 ? '' : 's'}`,
} as const;

/** The teacher's "Usual slip" phrase for each kind of wrong choice a child can make here: short, plain, after "Usual slip:" (LEARNING-DESIGN rule 9). */
export const SLIP_WORDS: Record<LandKind, string> = {
  rock: 'stops at the big rock',
  double: 'adds the whole small number on top of ten',
  part: 'adds only the leftover part',
  off1: 'lands one stone off',
  add: 'hops up the line instead of back',
};
