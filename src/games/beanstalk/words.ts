/** Everything the game says. Short, because it is read aloud to children of 5 to 7. */
import type { Metal } from '../../../shared/beanstalk/progress';
import { mistakeKind, unitOf, type Target } from '../../../shared/beanstalk/round';

/** "7 tens", "1 hundred": a number counted in the beanstalk's dots. */
const inDots = (n: number, target: number) => {
  const step = target / 10;
  const unit = step === 100 ? 'hundred' : 'ten';
  return `${n / step} ${n === step ? unit : `${unit}s`}`;
};

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
  /** The badge above the tray, so the sum is on screen with Voice off (maths review R4). */
  makeTarget: (target: number) => `Make ${target}`,
  /** Said once in a round, when three goes in a row began with a wrong tap and the full dots come back (R6). */
  dotsBack: 'Here are the dots again to help.',
  hearAgain: 'Hear it again',
  /**
   * The first challenge on a new 100 or 1000 beanstalk: the same bonds, in tens or hundreds, with the numbers of the
   * pair the hand points at ("Each dot is a ten. 7 tens and 3 tens make 10 tens. That is 100.").
   */
  bridge: (target: number, a: number, b: number) => {
    const step = target / 10;
    const unit = step === 100 ? 'hundred' : 'ten';
    const of = (n: number) => `${n / step} ${n === step ? unit : `${unit}s`}`;
    return `Each dot is a ${unit}. ${of(a)} and ${of(b)} make 10 ${unit}s. That is ${target}.`;
  },
  /** On the 20 beanstalk's first challenge: the same pairs, now two ten-frames full (maths review R8). */
  bridge20: (a: number, b: number) => `Two ten-frames make 20. ${a} and ${b} make 20.`,
  guideHere: 'try this one',
  /**
   * The missing leaf (maths review R8): one leaf is already picked and the child taps the one that is missing, "7 + ? = 10".
   * After it, the take-away form: "So 10 take 7 is 3."
   */
  missingSum: (a: number, target: number) => `${a} + ? = ${target}`,
  missingTip: (target: number) => `One leaf is missing. Which leaf makes ${target}? The hand shows you.`,
  missingAsk: (a: number, target: number) => `${a} and what make ${target}? Tap the missing leaf.`,
  skip: 'Skip',
  demoTitle: 'Watch Kiwi show one first.',
  nowTryDemo: 'Now you try.',
  takeAway: (a: number, target: number) => `So ${target} take ${a} is ${target - a}.`,
  right: (a: number, b: number) => `${a} and ${b} make ${a + b}!`,
  /** Under the ten-frame on the 100 and 1000 beanstalks: each dot is a ten (or a hundred). */
  dotsEach: (step: number) => `${step} each`,
  /**
   * Why a wrong pair isn't right, said after the first wrong pair of a go (maths review R5), smaller number first:
   * "4 and 8 make 12. That is too many." On the 100 and 1000 beanstalks one dot off is said in tens or hundreds.
   */
  why: (x: number, y: number, target: Target) => {
    const [a, b] = x < y ? [x, y] : [y, x];
    const sum = a + b;
    const made = `${a} and ${b} make ${sum}.`;
    switch (mistakeKind(sum, target)) {
      case 'over':
        return `${made} That is too many.`;
      case 'under':
        return `${made} Not enough.`;
      case 'close':
        return sum > target ? `${made} Just one too many.` : `${made} Just one more would make ${target}.`;
      default:
        return `${made} ${inDots(a, target)} and ${inDots(b, target)} is ${inDots(sum, target)}, not 10.`;
    }
  },
  /** After the second wrong pair of a go: the game shows a leaf's partner (maths review R5). */
  lookTogether: "Let's look together.",
  /** The leaf's frame fills with its partner's dots, counted: "7 and 1, 2, 3 more make 10." */
  fillUp: (n: number, target: Target) => {
    const more = Array.from({ length: (target - n) / unitOf(target) }, (_, i) => i + 1).join(', ');
    return target <= 20 ? `${n} and ${more} more make ${target}.` : `${inDots(n, target)} and ${more} more make ${inDots(target, target)}. That is ${target}.`;
  },
  nowTry: (n: number) => `Now you try: what goes with ${n}?`,
  /** On the "Let's look together" panel once it has played long enough (3 seconds) to be skipped. */
  goOn: 'My turn',
  /** The tail of the finish title, after the opening for how the day went (S33). */
  leafTurned: (metal: Metal) => `A leaf turned ${metal}.`,
  doneToday: 'Come back tomorrow to change another leaf. You can play as much as you like, but only one leaf will change a day.',
  /** The opening of the finish title and, on an egg day, the chip: about the pairs, not about the child (S33). */
  how: {
    most: 'You found the pairs that fit!',
    some: 'Some were tricky and you kept going.',
    tricky: 'Those were tricky ones.',
  },
  /** The chip on a tricky day. Help moves for the child on the day's first finish only, so a replay does not bring it back: it says tomorrow. */
  trickyChip: 'Tricky ones are good practice. We will try again tomorrow.',
  egg: (name: string) => `All the leaves are gold! ${name} can climb down. You win the Golden Egg!`,
  nextFriend: (name: string) => `Oh no! ${name} is stuck up a new beanstalk. Make pairs to help!`,
  /** Said once in a round when the second, short tray comes in with older pairs (S21). */
  nowThese: (target: number) => `Now these make ${target}.`,
  /** On the finish screen when the sum moves with the child (S21). No score: just where they are now. */
  movedUp: (target: number) => `You are ready for bigger pairs! Next time, make pairs that add to ${target}.`,
  movedBack: (target: number) => `Let's practise pairs that add to ${target} again. They will help you.`,
  wentWrong: 'Something went wrong. Please try again soon.',
  home: 'Home',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  /** The finish screen's "what's next" card (maths review R8): shown when the top sum is secure and Weka is on. */
  nextTitle: 'You know your pairs. Use them to add across ten.',
  nextButton: 'Try Weka',
  eggs: (n: number) => `${n} Golden ${n === 1 ? 'Egg' : 'Eggs'}`,
} as const;
