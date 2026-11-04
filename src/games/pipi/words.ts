/** Everything the game says. Short, because it is read aloud to children of 5 to 7. */
import type { Metal } from '../../../shared/pipi/progress';
import type { Level } from '../../../shared/pipi/round';

const LEVEL_WORDS: Record<Level, string> = { 1: 'up to 5', 2: '6 and 7', 3: 'up to 10' };

export const WORDS = {
  title: "Pipi's Hidden Shells",
  wants: (name: string) => `The tide is coming in! Help ${name} find the pipi hiding in the sand.`,
  nextFriend: (name: string) => `A new beach! Help ${name} find the pipi hiding in the sand.`,
  level: (level: Level) => `Pipi families ${LEVEL_WORDS[level]}`,
  dayCount: (day: number) => `Day ${day} of 30`,
  play: 'Play',
  playAgain: 'Play again',
  pickShell: 'Tap the shell with the right number.',
  goesDone: (n: number, of: number) => `${n} of ${of}`,
  altogether: (n: number) => `${n} altogether`,
  howManyHiding: 'How many are hiding?',
  howManyAltogether: 'How many altogether?',
  parts: (here: number, popped: number) => `${here} and ${popped}`,
  hereAndPopped: 'here and popped up',
  howManyNow: 'Splash! Now how many are hiding?',
  guideStart: 'Look at the sand. Then tap the shell the hand points to.',
  guideHere: 'try this one',
  tryAgain: 'Try again!',
  yes: (n: number) => `Yes! ${n}!`,
  shellTurned: (metal: Metal) => `Well done! A magic shell turned ${metal}!`,
  doneToday: 'Well done! Come back tomorrow to change another magic shell.',
  levelUp: (level: Level) => `You are so good at this! Next time the pipi families are ${LEVEL_WORDS[level]}.`,
  pearl: (name: string) => `All the magic shells are gold! ${name} found the Golden Pearl!`,
  wentWrong: 'Something went wrong. Please try again soon.',
  home: 'Home',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  pearls: (n: number) => `${n} Golden ${n === 1 ? 'Pearl' : 'Pearls'}`,
} as const;
