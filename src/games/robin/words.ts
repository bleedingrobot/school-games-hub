/** Everything the game says, in English only. Short, because it is read aloud to children of 5 to 7. */
import { stepName, type Step } from '../../../shared/robin/config';
import type { Metal } from '../../../shared/robin/progress';
import type { Slip } from '../../../shared/robin/round';

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four',
];
/** A number as a word (0 to 24, as high as any pile in this game goes). */
export const numWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

export const WORDS = {
  title: 'Robin’s Berry Basket',
  /** The home page chip's words: "Today’s basket is ready". */
  part: 'basket',
  wants: (name: string) => `${name} wants some berries! Can you help ${name}?`,
  nextFriend: (name: string) => `Now ${name} wants some berries too!`,
  step: (step: Step) => `Step ${step}: ${stepName(step)}`,
  dayCount: (day: number) => `Day ${day} of 30`,
  play: 'Play',
  playAgain: 'Play again',
  pickCard: 'Tap how many.',
  pickGive: 'Tap berries into the basket. Then press That’s all.',
  goesDone: (n: number, of: number) => `${n} of ${of} done`,
  guideHere: 'look here',
  thatsAll: 'That’s all',
  /** Said (and shown) when That's all is pressed with nothing in the basket. */
  putOneFirst: 'Put a berry in the basket first.',
  takeBack: 'Put one back',
  basketLabel: (n: number) => `The basket, with ${n} berr${n === 1 ? 'y' : 'ies'}`,
  pileLabel: 'The pile of berries',
  groupLabel: 'The berries',
  touchEach: 'Touch each berry to count it.',
  /** Why a wrong card or count is wrong, by kind. Generic: none says a number or the answer. */
  why: (kind: Slip): string => {
    switch (kind) {
      case 'over': return 'That is too many berries. Put some back.';
      case 'under': return 'That is not enough yet. Add some more.';
      case 'double': return 'One berry was counted twice. Touch each berry only once.';
      case 'skip': return 'One berry was missed. Count every berry.';
      case 'row': return 'Some berries were missed. Count every berry.';
      case 'lots': return 'That is a lot more than there are. Count again.';
      case 'same': return 'That is how many were under the cloth. One more has come.';
      case 'again': return 'Only one more berry came. Not two.';
      case 'one': return 'That is just one berry. Count them all.';
      default: return 'So close! Count again, one at a time.';
    }
  },
  /** After the second wrong tap of a go: Robin counts, then asks again. */
  lookTogether: 'Let’s count again together.',
  lookFill: 'Let us count them one at a time.',
  nowTry: 'Now you try!',
  goOn: 'My turn',
  hearAgain: 'Hear it again',
  peek: 'Peek',
  cloth: 'Under the cloth',
  oneMore: 'One more berry comes.',
  promptHowMany: 'How many berries?',
  /** Written under the cards of a One more go (the voice already asks it). */
  promptCountOn: 'How many now?',
  /** Said once when a grey card is tapped before every berry is touched, and the same words written under the cards. */
  touchFirstSay: 'Touch every berry first.',
  touchFirstWrite: 'Touch each berry first.',
  countWithMe: 'Count with me',
  countingNow: 'Counting...',
  countWithMeSay: 'Count with me.',
  /** After a wrong card on a How many go: the child's own count, then back to the cards. */
  youCounted: (n: number): string => `You counted ${numWord(n)}.`,
  findSame: 'Find the card that says the same.',
  tappedCard: (n: number) => `The card you tapped, ${n}`,
  countBadge: (n: number) => `${n} berries counted`,
  tip: [
    'Hello! I am Robin. I love berries. Will you count some out for me?',
    'I will talk to you. Tap Hear it again to hear me again.',
  ],
  tipName: 'Robin',
  tipNext: 'Next',
  tipLast: 'Got it',
  tipClose: 'Close the tip',
  basketTurned: (metal: Metal) => `Well done! A basket turned ${metal}!`,
  doneToday: 'Well done! Come back tomorrow to turn another basket.',
  goldenFeast: (name: string) => `All the baskets are gold! ${name} has the Golden Berry Feast!`,
  nextStep: (step: Step) => `Next time: ${stepName(step).toLowerCase()}.`,
  lessHelp: 'Next time: a little less help.',
  moreHelp: 'Next time: a little more help.',
  sameAgain: 'Next time: the same again.',
  /** The "Show me" beside the next-step line: it lights the button it means. */
  showMe: 'Show me',
  wentWrong: 'Something went wrong. Please try again soon.',
  home: 'Home',
  ok: 'OK',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  feastsWon: (n: number) => `${n} Golden Berry Feast${n === 1 ? '' : 's'}`,
  logLabel: (changed: number, of: number) => `${changed} of ${of} baskets changed`,
  /** The guide, played again on request. */
  replayGuide: 'Show me how again',
  /** Said when "Show me" is pressed: the next button glows. */
  pressOk: 'Tap the glowing button to go on.',
} as const;
