/** Everything the game says. Short, because it is read aloud to children of 5 to 7. */
import type { Metal } from '../../../shared/hop/progress';
import { wordOf, type Hop, type HopMistake, type HopStep } from '../../../shared/hop/round';

/** What a hop's counting is called: "tens", "threes", "tens past 100", "tens from 3" (counting from a start off a multiple). */
const counted = (hop: Pick<Hop, 'of' | 'from'>) => `${wordOf(hop.of)}${hop.from ? ` from ${hop.from}` : ''}`;
/** The hop for a why-line: the part of a hop the words need. */
type HopFor = Pick<Hop, 'of' | 'from' | 'size' | 'before' | 'answer' | 'back'>;

export const WORDS = {
  /** What changes each day, for the next-part chip (src/components/NextPartChip.tsx). */
  part: 'lily pad',
  title: "Hop's Glow-worm Pond",
  wants: (name: string) => `${name} wants to get to the Glow-worm Party! Help ${name} hop across the pond.`,
  nextFriend: (name: string) => `Now ${name} needs to cross a new pond to the party!`,
  counting: (step: HopStep) => `Counting in ${wordOf(step)}`,
  dayCount: (day: number) => `Day ${day} of 30`,
  play: 'Play',
  playAgain: 'Play again',
  pickWorm: 'Tap the glow-worm with the right number.',
  hearAgain: 'Hear it again',
  hopsMade: (n: number, of: number) => `${n} of ${of} hops`,
  /** Said once in a round, when three hops in a row began with a wrong glow-worm and the step labels come back (R6). */
  labelsBack: 'Here are the hops again to help.',
  guideStart: 'Tap the glow-worm with the right number. Start with the glow-worm the hand points to.',
  guideHere: 'try this one',
  /**
   * Why a wrong glow-worm isn't right, said after the first wrong one of a hop (maths review R5, section 3.3). Hop's own
   * words, with no names, so every friend can say them. `before` is the pad Hop sits on, `answer` where the hop lands.
   */
  why: (kind: HopMistake, hop: HopFor) => {
    const { size, before, answer, back } = hop;
    switch (kind) {
      case 'off1':
        return `${before}, then ${size} ${back ? 'less' : 'more'} is ${answer}.`;
      case 'stay':
        return 'That is the pad we are sitting on. We need to hop.';
      case 'far':
        return 'That is two hops. We need one hop.';
      case 'step':
        return `We are counting in ${counted(hop)}. Each hop is ${size}.`;
      case 'way':
        return 'We are counting back, so we go down.';
    }
  },
  /** After the second wrong glow-worm of a hop: Hop hops the whole row, saying each number. */
  lookTogether: "Let's look together.",
  lookCount: (hop: Pick<Hop, 'of' | 'from' | 'back'>, numbers: readonly number[]) => `Counting ${hop.back ? 'back ' : ''}in ${counted(hop)}: ${numbers.join(', ')}.`,
  nowTry: 'Now you try.',
  /** On the "Let's look together" panel once it has played long enough (3 seconds) to be skipped. */
  goOn: 'My turn',
  yes: (n: number) => `${n}!`,
  padTurned: (metal: Metal) => `Well done! A lily pad turned ${metal}!`,
  doneToday: 'Well done! Come back tomorrow to change another lily pad.',
  stepUp: (step: HopStep) => `You are so good at this! Next time we count in ${wordOf(step)}.`,
  jar: (name: string) => `All the lily pads are gold! ${name} made it to the Glow-worm Party. You win the Golden Glow Jar!`,
  /** The finish screen's signpost once the top step is secure and Penguin Pairs is on (maths review R8, section 3.1). */
  signpost: 'Jumping in twos is doubling. Try Penguin Pairs.',
  signpostGame: 'Penguin Pairs',
  wentWrong: 'Something went wrong. Please try again soon.',
  home: 'Home',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  board: 'Hundreds board',
  boardShow: '100 board',
  boardShowHigh: '200 board',
  boardHide: 'Hide board',
  boardClear: 'Clear',
  jars: (n: number) => `${n} Golden Glow ${n === 1 ? 'Jar' : 'Jars'}`,
} as const;
