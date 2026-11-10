/** Everything the game says. Short, because it is read aloud to children of 5 to 7. */
import type { Metal } from '../../../shared/tui/progress';
import { stepName, type Step, type TuiKind } from '../../../shared/tui/round';

const DIGIT = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

export const WORDS = {
  title: 'Tūī’s Ten Tree',
  /** The home page chip's word: "Today's flower is ready". */
  part: 'flower',
  wants: (name: string) => `${name} is filling up for winter on the Ten Tree! Help ${name} count the berries.`,
  nextFriend: (name: string) => `Now ${name} has a Ten Tree to fill up!`,
  step: (step: Step) => `Step ${step}: ${stepName(step)}`,
  dayCount: (day: number) => `Day ${day} of 30`,
  play: 'Play',
  playAgain: 'Play again',
  pickNest: 'Tap the right nest.',
  goesDone: (n: number, of: number) => `${n} of ${of} done`,
  guideHere: 'look here',
  /**
   * Why a wrong nest is wrong (maths review R5), said after the first wrong tap of a go. None says the answer: the number
   * said is the nest the child tapped. `wrong` is that nest and `way` how the go is asked.
   */
  why: (kind: TuiKind, wrong: number, way: number) => {
    switch (kind) {
      case 'reverse':
        return `${wrong} is ${DIGIT[Math.floor(wrong / 10)]} tens and one. We only have one ten.`;
      case 'tens':
        return `${wrong} is two tens. We only have one ten.`;
      case 'ones':
        return 'That is only the loose berries. Do not forget the ten.';
      case 'off1':
        return 'Nearly! Count the berries one at a time.';
      case 'up':
        return 'Take away makes it smaller.';
      default:
        return way === 2 ? `${wrong} is all the berries together. How many go with the ten?` : `${wrong} is what we start with. Take the ten away. What is left?`;
    }
  },
  /** After the second wrong tap of a go: the game plays the whole sum, then asks again. */
  lookTogether: "Let's look together.",
  nowTry: 'Now you try one like it.',
  /** On the "Let's look together" panel once it has played long enough to be skipped. */
  goOn: 'My turn',
  /** Said once, after three goes in a row with a wrong first tap: every berry is drawn again for the rest of the round. */
  berriesBack: 'Here are the berries again to help.',
  hearAgain: 'Hear it again',
  skip: 'Skip',
  demoTitle: 'Watch Tūī show one first.',
  peek: 'Peek',
  /** The kete's tag and the loose berries, for screen readers. */
  keteOfTen: 'A kete of ten berries',
  berries: (n: number) => `${n} berr${n === 1 ? 'y' : 'ies'}`,
  missing: (n: number) => `${n} empty space${n === 1 ? '' : 's'}`,
  /** After a right answer: the number, then the stem sentence ("14! 10 and 4 is 14."). English numbers, as Weka (James, 5 Nov 2026). */
  right: (answer: number, n: number) => `${answer}! 10 and ${n} is ${10 + n}.`,
  /** After a right answer to a sister question or a second go ("Now you try"): plain, not the praise for a first try (R5). */
  rightRedo: (n: number) => `You found it. 10 and ${n} is ${10 + n}.`,
  /** The tail of the finish title, after the opening for how the day went (S33). */
  flowerTurned: (metal: Metal) => `A flower turned ${metal}.`,
  doneToday: 'Come back tomorrow to change another flower.',
  /** The opening of the finish title and, on a Golden Nest day, the chip: about the tens, not about the child (S33). */
  how: {
    most: 'You spotted the ten in each number!',
    some: 'Some were tricky and you kept going.',
    tricky: 'Those were tricky ones.',
  },
  /** The chip on a tricky day. Help moves for the child on the day's first finish only, so a replay does not bring it back: it says tomorrow. */
  trickyChip: 'Tricky ones are good practice. We will try again tomorrow.',
  nextStep: (step: Step) => {
    const name = stepName(step).toLowerCase();
    return `Your practice is paying off. Next time: ${/[?!.]$/.test(name) ? name : `${name}.`}`;
  },
  goldenNest: (name: string) => `All the flowers are gold! ${name} won the Golden Nest!`,
  wentWrong: 'Something went wrong. Please try again soon.',
  home: 'Home',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  nestsWon: (n: number) => `${n} Golden Nest${n === 1 ? '' : 's'}`,
  tenAndTen: 'Ten and ten is twenty!',
  /** The "what's next" card on the finish screen (R8), once the top step is secure and Weka is on for the class. */
  whatsNext: 'You know ten and some. Now make ten to add bigger sums.',
  tryWeka: 'Try Weka',
} as const;
