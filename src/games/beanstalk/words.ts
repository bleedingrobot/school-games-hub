/** Everything the game says. Short, because it is read aloud to children of 5 to 7. */
import type { Metal } from '../../../shared/beanstalk/progress';

export const WORDS = {
  title: "Kiwi's Beanstalk",
  whoAreYou: 'Who do you want to be?',
  jack: 'Jack',
  jill: 'Jill',
  stuck: (name: string) => `${name} is stuck up the beanstalk! Make pairs that add to 10 to help.`,
  dayCount: (day: number) => `Day ${day} of 30`,
  play: 'Play',
  playAgain: 'Play again',
  tapTwo: 'Tap two leaves that make 10.',
  right: (a: number, b: number) => `${a} and ${b} make 10!`,
  tryAgain: 'Try again!',
  leafTurned: (metal: Metal) => `Well done! A leaf turned ${metal}!`,
  doneToday: 'Well done! Come back tomorrow to change another leaf.',
  egg: (name: string) => `All the leaves are gold! ${name} can climb down. You win the Golden Egg!`,
  nextFriend: (name: string) => `Oh no! ${name} is stuck up a new beanstalk.`,
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  eggs: (n: number) => `${n} Golden ${n === 1 ? 'Egg' : 'Eggs'}`,
} as const;
