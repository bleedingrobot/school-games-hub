/** Everything the game says. Short, because it is read aloud to children of 5 to 7. */
import type { Metal } from '../../../shared/beanstalk/progress';

export const WORDS = {
  /** What changes each day, for the next-part chip (src/components/NextPartChip.tsx). */
  part: 'leaf',
  title: "Kiwi's Beanstalk",
  whoAreYou: 'Who do you want to be?',
  jack: 'Jack',
  jill: 'Jill',
  stuck: (name: string, target: number) => `${name} is stuck up the beanstalk! Make pairs that add to ${target} to help.`,
  dayCount: (day: number) => `Day ${day} of 30`,
  play: 'Play',
  playAgain: 'Play again',
  tapTwo: (target: number) => `Tap two leaves that make ${target}.`,
  guideStart: (target: number) => `Tap two leaves that make ${target}. Start with the leaf the hand points to.`,
  guideNext: 'Now tap the leaf the hand points to.',
  guideHere: 'try this one',
  right: (a: number, b: number) => `${a} and ${b} make ${a + b}!`,
  /** Under the ten-frame on the 100 and 1000 beanstalks: each dot is a ten (or a hundred). */
  dotsEach: (step: number) => `${step} each`,
  tryAgain: 'Try again!',
  leafTurned: (metal: Metal) => `Well done! A leaf turned ${metal}!`,
  doneToday: 'Well done! Come back tomorrow to change another leaf. You can play as much as you like, but only one leaf will change a day.',
  egg: (name: string) => `All the leaves are gold! ${name} can climb down. You win the Golden Egg!`,
  nextFriend: (name: string, target: number) => `Oh no! ${name} is stuck up a new beanstalk. This time, make pairs that add to ${target}!`,
  wentWrong: 'Something went wrong. Please try again soon.',
  home: 'Home',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  eggs: (n: number) => `${n} Golden ${n === 1 ? 'Egg' : 'Eggs'}`,
} as const;
