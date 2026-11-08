/** Everything the game says, in English only. Short, because it is read aloud to children of 5 to 7. */
import { stepName, type Step } from '../../../shared/parrot/config';
import type { Metal } from '../../../shared/parrot/progress';
import type { ParrotKind } from '../../../shared/parrot/round';

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];
/** A number as a word (0 to 20, which is as high as any sum in this game goes). */
export const numWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

export const WORDS = {
  title: 'Parrot’s See-saw',
  /** The home page chip's words: "Today’s shiny thing is ready". */
  part: 'shiny thing',
  wants: (name: string) => `${name} wants the see-saw level! Can you help ${name}?`,
  nextFriend: (name: string) => `Now ${name} has a see-saw to keep level!`,
  step: (step: Step) => `Step ${step}: ${stepName(step)}`,
  dayCount: (day: number) => `Day ${day} of 30`,
  play: 'Play',
  playAgain: 'Play again',
  pickCard: 'Tap the missing number.',
  pickTilt: 'Tap which way it tips.',
  goesDone: (n: number, of: number) => `${n} of ${of} done`,
  guideHere: 'look here',
  /** The stones. */
  addStone: 'Add a stone',
  takeBack: 'Take one back',
  check: 'Check',
  stonePan: 'The empty side of the see-saw',
  heap: 'A heap of stones',
  /** The three cards of a true or false go. */
  tipsLeft: 'Tips left',
  level: 'Level',
  tipsRight: 'Tips right',
  /** The see-saw, for screen readers. */
  sawLabel: 'A see-saw',
  stones: (n: number) => `${n} stone${n === 1 ? '' : 's'}`,
  /** Why a wrong card or count is wrong, by kind. Generic: none says a number or the answer. */
  why: (kind: ParrotKind): string => {
    switch (kind) {
      case 'all': return 'That adds up every number. It is too many.';
      case 'copy': return 'That is the same as the number next to it. Look at the other side.';
      case 'total': return 'That is the whole amount. We only need the part that is missing.';
      case 'off1': return 'So close! Count again, one at a time.';
      case 'dbl': return 'That is the same number twice. Look at each side.';
      case 'both': return 'Both sides have numbers, but they are not the same amount.';
      case 'first': return 'Look at both sides, not just the first number.';
      case 'more': return 'That is too many stones. This side is too heavy now.';
      case 'less': return 'That is not enough stones yet. This side is still lighter.';
      case 'side': return 'The heavier side goes down. Which side is heavier?';
      default: return 'Not quite. Does it make both sides the same?';
    }
  },
  isLevel: 'Is it level yet?',
  /** After the second wrong tap of a go: Parrot counts both sides, then asks again. */
  lookTogether: 'Let’s look together.',
  lookFill: 'Let us count each side together.',
  nowTry: 'Now you try!',
  /** On the "Let's look together" panel once it has played long enough to be skipped. */
  goOn: 'My turn',
  skip: 'Skip',
  demoTitle: 'Watch Parrot show one first.',
  hearAgain: 'Hear it again',
  peek: 'Peek',
  stoneLive: 'Put stones on the empty side until the see-saw is level.',
  stoneCheck: 'Put stones on the empty side. Then press Check.',
  promptMissing: 'What number is missing?',
  promptTilt: 'Is it the same? Which way does it tip?',
  sameQ: 'Is it the same?',
  sameAs: 'is it the same as',
  tip: [
    'Hello! I am Parrot. I like my see-saw level. Will you help me?',
    'I will talk to you. Tap Hear it again to hear me again.',
  ],
  tipName: 'Parrot',
  tipNext: 'Next',
  tipLast: 'Got it',
  tipClose: 'Close the tip',
  thingTurned: (metal: Metal) => `Well done! A shiny thing turned ${metal}!`,
  doneToday: 'Well done! Come back tomorrow to turn another shiny thing.',
  goldenBell: (name: string) => `All the shiny things are gold! ${name} won the Golden Bell!`,
  /** One honest line on the finish screen about how the round went (S15): about what she did, not about her. */
  how: {
    most: 'You worked those out.',
    some: 'Some were quick and some were tricky. The tricky ones help you grow.',
    tricky: 'That was tricky today. We will go slowly and look together.',
  },
  nextStep: (step: Step) => `Next time: ${stepName(step).toLowerCase()}.`,
  lessHelp: 'Next time: a little less help.',
  moreHelp: 'Next time: a little more help.',
  sameAgain: 'Next time: the same again.',
  wentWrong: 'Something went wrong. Please try again soon.',
  home: 'Home',
  ok: 'OK',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  bellsWon: (n: number) => `${n} Golden Bell${n === 1 ? '' : 's'}`,
  ropeLabel: (changed: number, of: number) => `${changed} of ${of} shiny things changed`,
} as const;
