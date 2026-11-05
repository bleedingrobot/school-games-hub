/** Everything the game says. Short, because it is read aloud to children of 5 to 7. */
import type { Metal } from '../../../shared/tui/progress';
import { stepName, type Step } from '../../../shared/tui/round';

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
  tryAgain: 'Try again!',
  hearAgain: 'Hear it again',
  peek: 'Peek',
  /** The kete's tag and the loose berries, for screen readers. */
  keteOfTen: 'A kete of ten berries',
  berries: (n: number) => `${n} berr${n === 1 ? 'y' : 'ies'}`,
  missing: (n: number) => `${n} empty space${n === 1 ? '' : 's'}`,
  /** After a right answer: the number, then the stem sentence ("14! 10 and 4 is 14."). English numbers, as Weka (James, 5 Nov 2026). */
  right: (answer: number, n: number) => `${answer}! 10 and ${n} is ${10 + n}.`,
  flowerTurned: (metal: Metal) => `Well done! A flower turned ${metal}!`,
  doneToday: 'Well done! Come back tomorrow to change another flower.',
  nextStep: (step: Step) => `You are so good at this! Next time: ${stepName(step).toLowerCase()}`,
  goldenNest: (name: string) => `All the flowers are gold! ${name} won the Golden Nest!`,
  wentWrong: 'Something went wrong. Please try again soon.',
  home: 'Home',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  nestsWon: (n: number) => `${n} Golden Nest${n === 1 ? '' : 's'}`,
  tenAndTen: 'Ten and ten is twenty!',
} as const;
