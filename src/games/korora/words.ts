/** Everything the game says. Short, because it is read aloud to children of 5 to 7. */
import type { Metal } from '../../../shared/korora/progress';
import type { Level } from '../../../shared/korora/round';

const LEVEL_WORDS: Record<Level, string> = {
  1: 'Doubles to 5',
  2: 'Halves to 10',
  3: 'Doubles to 10',
  4: 'Halves to 20',
  5: 'Near doubles',
};

export const WORDS = {
  /** What changes each day, for the next-part chip (src/components/NextPartChip.tsx). */
  part: 'stepping stone',
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
  /** The second wrong tap of a go: Bella explains the whole go (maths review R5). */
  lookTogether: 'Let’s look together.',
  /** Said once she has explained, then the question is read again. */
  nowTry: 'Now you try.',
  /** Said once in a round, when three goes in a row began with a wrong tap and the pictures come back (R6). */
  picturesBack: 'Here is the picture again to help.',
  /** On the "Let's look together" panel once it can be skipped. */
  goOn: 'My turn',
  /** The double: the whole go, ending on the answer, while the fish are counted. */
  lookDouble: (n: number) => `Double ${n} is ${n} fish and ${n} fish in the water. Count them all: ${2 * n}.`,
  /** The half: the fish are dealt out one each, and one chick's share is counted. */
  lookHalf: (n: number) => `Share ${n} fish, one for you and one for me. Count one chick’s share: ${n / 2}.`,
  /** Why the first wrong tap of a go is not right, for each mistake (the number it was is on the stone, not in the line). */
  why: {
    same: (n: number) => `Double ${n} is ${n} and ${n} again.`,
    plus1: 'Double means the same again, not one more.',
    plus2: (n: number) => `Double ${n} is two lots of ${n}, not ${n} and 2.`,
    miscountDouble: 'Count every fish, the rock and the water, one at a time.',
    all: 'That is all the fish. Half is one chick’s share.',
    miscountHalf: 'Share them out, one for you and one for me. Then count one share.',
    minus2: 'Half means two equal groups.',
    double: 'Half is smaller. The pile goes into two nests.',
    noExtra: 'That is the double. Do not forget the one more fish.',
    bigger: 'There is only one extra fish. Double the small number, then add one more.',
  },
  /** Near doubles: the double, then one more, counted. */
  lookNear: (n: number) => `Double ${n} is ${2 * n} fish. Then one more fish. Count them all: ${2 * n + 1}.`,
  /** The "what's next" card on the finish screen (R8), once near doubles are secure and Weka is on for the class. */
  whatsNext: 'Doubles help with 6 + 7 too. Try Weka.',
  tryWeka: 'Try Weka',
  yes: (n: number) => `${n}!`,
  /** Fair or not (R9): the three choices, and what is said when the child is right, counting one bowl together. */
  fair: 'Fair',
  tooMany: 'One left over',
  fairYes: (k: number) => `Yes! They share them fairly. Count one bowl: ${k}. The other bowl has ${k} too.`,
  oddYes: (k: number) => `Yes! Count one bowl: ${k}. The other bowl has ${k} too. One fish is left over.`,
  /** After the second wrong choice: the fish pair off. It never says which choice is right. */
  /** After the first wrong choice: look at one bowl. It never says which choice is right. */
  countOneBowl: 'Count the fish in one bowl.',
  pairOff: 'Let’s pair them off. Does every fish have a partner?',
  shareTwo: 'Share two fish',
  allShared: 'All shared!',
  lonely: 'One fish has no partner',
  bowlHas: (n: number) => `${n} fish in the bowl`,
  afterDouble: (n: number) => `Double ${n} is ${2 * n}. So what is half of ${2 * n}?`,
  hearAgain: 'Hear it again',
  tapToCount: 'Tap the fish to count them.',
  tapToShare: 'Tap a fish to give it to a chick.',
  /** Full help on a half: one tap gives a fish to each chick. */
  tapToDeal: 'Tap the fish to give one to each chick.',
  /** Near doubles: what the picture shows (read after the question, and the screen reader label). */
  nearMirror: (n: number) => `${n} and ${n}, and one more.`,
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
