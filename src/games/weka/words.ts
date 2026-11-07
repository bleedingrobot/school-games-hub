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
  nowTry: 'Now you try.',
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
  hearAgain: 'Hear it again',
  /** The split after each right answer: the bond's label while it is being filled in, and the button after it. */
  splitLabel: (n: number) => `How did you split the ${n}?`,
  /** Split-first goes (later in the game): the bond's label while the child splits the number before answering. */
  splitFirstLabel: (n: number) => `Split the ${n} to get to ten.`,
  /** The pebble step: the same question again in two ten-frames (James, 6 Nov 2026). */
  sameQuestion: 'Same question:',
  pebblesIn: (n: number) => `${n}`,
  tenFull: '10',
  movePebble: 'Silver pebble: move it to the first ten-frame',
  next: 'Next',
  finish: 'Finish',
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
