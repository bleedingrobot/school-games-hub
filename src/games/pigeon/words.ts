/** Everything the game says. Short, because it is read aloud to children of 6 to 9. */
import type { Metal } from '../../../shared/pigeon/progress';
import { stepName, type Step } from '../../../shared/pigeon/round';

export const WORDS = {
  title: 'Pigeon’s Number Line',
  /** The home page chip's word: "Today's cluster is ready". */
  part: 'cluster',
  wants: (name: string) => `${name} is flying the berry branch! Help ${name} find the right spots.`,
  nextFriend: (name: string) => `Now ${name} has a berry branch to fly!`,
  step: (step: Step) => `Step ${step}: ${stepName(step)}`,
  dayCount: (day: number) => `Day ${day} of 30`,
  play: 'Play',
  playAgain: 'Play again',
  pickCard: 'Tap the right number.',
  tapLine: 'Tap the branch.',
  goesDone: (n: number, of: number) => `${n} of ${of} done`,
  tryAgain: 'Try again!',
  hearAgain: 'Hear it again',
  peek: 'Peek',
  /** After a right answer: three kinds of cheer, picked by the go's place in the round. */
  right: ['Yes! That is it.', 'Lovely! You found it.', 'Well done!'],
  clusterTurned: (metal: Metal) => `Well done! A berry cluster turned ${metal}!`,
  doneToday: 'Well done! Come back tomorrow to change another cluster.',
  nextStep: (step: Step) => `You are so good at this! Next time: ${stepName(step).toLowerCase()}`,
  goldenBranch: (name: string) => `All the berries are gold! ${name} won the Golden Berry Branch!`,
  wentWrong: 'Something went wrong. Please try again soon.',
  home: 'Home',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  prizesWon: (n: number) => `${n} Golden Berry Branch${n === 1 ? '' : 'es'}`,
  lookTitle: 'Let’s look together.',
  nowYouTry: 'Now you try.',
  skip: 'Skip',
  /** The "Show me first" demo, the first time a zoom go comes up (a made-up example the round never asks). */
  demoTitle: 'Watch first',
  demoTiny: 'Watch. Some numbers are in a tiny space.',
  demoLens: 'Tap the lens, to zoom in.',
  demoFind: 'Now find 27 on the zoomed line.',
  ask: 'Next',
} as const;
