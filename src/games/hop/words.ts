/** Everything the game says. Short, because it is read aloud to children of 5 to 7. */
import type { Metal } from '../../../shared/hop/progress';
import type { SkipStep } from '../../../shared/maths/skillPacks/earlyFacts';

const STEP_WORD: Record<SkipStep, string> = { 10: 'tens', 5: 'fives', 2: 'twos' };

export const WORDS = {
  /** What changes each day, for the next-part chip (src/components/NextPartChip.tsx). */
  part: 'lily pad',
  title: "Hop's Glow-worm Pond",
  wants: (name: string) => `${name} wants to get to the Glow-worm Party! Help ${name} hop across the pond.`,
  nextFriend: (name: string) => `Now ${name} needs to cross a new pond to the party!`,
  counting: (step: SkipStep) => `Counting in ${STEP_WORD[step]}`,
  dayCount: (day: number) => `Day ${day} of 30`,
  play: 'Play',
  playAgain: 'Play again',
  pickWorm: 'Tap the glow-worm with the right number.',
  hopsMade: (n: number, of: number) => `${n} of ${of} hops`,
  guideStart: 'Tap the glow-worm with the right number. Start with the glow-worm the hand points to.',
  guideHere: 'try this one',
  tryAgain: 'Try again!',
  yes: (n: number) => `${n}!`,
  padTurned: (metal: Metal) => `Well done! A lily pad turned ${metal}!`,
  doneToday: 'Well done! Come back tomorrow to change another lily pad.',
  stepUp: (step: SkipStep) => `You are so good at this! Next time we count in ${STEP_WORD[step]}.`,
  jar: (name: string) => `All the lily pads are gold! ${name} made it to the Glow-worm Party. You win the Golden Glow Jar!`,
  wentWrong: 'Something went wrong. Please try again soon.',
  home: 'Home',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  board: 'Hundreds board',
  boardShow: '100 board',
  boardHide: 'Hide board',
  boardClear: 'Clear',
  jars: (n: number) => `${n} Golden Glow ${n === 1 ? 'Jar' : 'Jars'}`,
} as const;
