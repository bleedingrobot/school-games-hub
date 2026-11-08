/** Everything the game says. Short, because it is read aloud to children of 5 to 7. */
import type { Metal } from '../../../shared/pipi/progress';
import type { Go, Level, WrongKind } from '../../../shared/pipi/round';

const LEVEL_WORDS: Record<Level, string> = { 1: 'up to 5', 2: '6 and 7', 3: 'up to 10' };

export const WORDS = {
  /** What changes each day, for the next-part chip (src/components/NextPartChip.tsx). */
  part: 'shell',
  title: "Pipi's Hidden Shells",
  wants: (name: string) => `The tide is coming in! Help ${name} find the pipi hiding in the sand.`,
  nextFriend: (name: string) => `A new beach! Help ${name} find the pipi hiding in the sand.`,
  level: (level: Level) => `Pipi families ${LEVEL_WORDS[level]}`,
  dayCount: (day: number) => `Day ${day} of 30`,
  play: 'Play',
  playAgain: 'Play again',
  pickShell: 'Tap the shell with the right number.',
  hearAgain: 'Hear it again',
  goesDone: (n: number, of: number) => `${n} of ${of}`,
  altogether: (n: number) => `${n} altogether`,
  howManyHiding: 'How many are hiding?',
  howManyAltogether: 'How many altogether?',
  parts: (here: number, popped: number) => `${here} and ${popped}`,
  hereAndPopped: 'here and popped up',
  howManyNow: 'Splash! Now how many are hiding?',
  /** Said once in a round, when three goes in a row began with a wrong shell and the frame and outlines come back (R6). */
  outlinesBack: 'Here are the outlines again to help.',
  guideStart: 'Look at the sand. Then tap the shell the hand points to.',
  guideHere: 'try this one',
  /** Wrong shell 2 of a go (maths review R5): the sand lifts and the split is read out. */
  lookTogether: "Let's look together.",
  nowTry: 'Now you try!',
  goOn: 'Go on',
  /** The labels of the two tides in the picture for a wrong answer that is the first tide's number. */
  firstTide: 'before',
  nowTide: 'now',
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

const countTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1).join(', ');
const are = (n: number) => (n === 0 ? 'none are' : n === 1 ? '1 is' : `${n} are`);

/** The split said out: the line for "Let's look together" after a second wrong shell. */
export const lookLine = (kind: Go['kind'], whole: number, showing: number, hiding: number): string =>
  kind === 'altogether' ? whyLine('part', kind, whole, showing, hiding) : `${whole} is ${showing} and ${hiding}. So ${are(hiding)} hiding.`;

/**
 * Why a wrong shell is wrong, said after the first wrong shell of a go (maths review R5). The numbers are the go's own,
 * so a line is the same wherever the same numbers turn up (and so shares one recorded clip).
 */
export function whyLine(kind: WrongKind, goKind: Go['kind'], whole: number, showing: number, hiding: number): string {
  switch (kind) {
    case 'shown':
      return `${showing} ${showing === 1 ? 'is' : 'are'} showing. How many are hiding?`;
    case 'whole':
      return `${whole} is all the pipi. Some are hiding.`;
    case 'add':
      return `We started with ${whole}. The answer cannot be more.`;
    case 'part':
      return `${showing} here and ${hiding} popped up. Together that is ${whole}.`;
    case 'before':
      return `The whole stays ${whole}. Only the split changes.`;
    case 'off1':
      if (goKind === 'altogether') return `Let's count all of them: ${countTo(whole)}.`;
      return hiding === 0 ? 'Look: none are hiding.' : `Look: ${countTo(hiding)} hiding.`;
  }
}
