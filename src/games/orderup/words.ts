/**
 * Order Up!'s words on screen (docs/ORDERUP-PLAN.md). The hints themselves live in shared/orderup/mistakes.ts, so the
 * server's records and the screen use the same words.
 */
import type { Rule } from '../../../shared/orderup/expr';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. Clips come with stage 8. */
export const VOICE_FOLDER = 'voice/orderup/';

export const RULES: { rule: Rule; signs: string; name: string; short: string; note: string }[] = [
  { rule: 'brackets', signs: '( )', name: 'Brackets', short: 'Brackets', note: 'Work inside them first' },
  { rule: 'exponents', signs: 'x²', name: 'Exponents', short: 'Powers', note: 'Powers next' },
  { rule: 'times-divide', signs: '× ÷', name: 'Multiply and divide', short: 'Times, divide', note: 'Left to right' },
  { rule: 'add-subtract', signs: '+ −', name: 'Add and subtract', short: 'Add, take', note: 'Left to right' },
];

export const WORDS = {
  title: 'Order Up!',
  home: 'Home',
  readOn: 'Read to me: on',
  readOff: 'Read to me: off',
  road: 'Pass a level with 7 good bags out of 8. A good bag has no more than one wrong tap.',
  start: 'Start',
  again: 'Play again',
  showMe: 'Show me how',
  locked: 'Pass the level before',
  soon: 'Coming soon',
  passedMark: 'Passed',
  bagOf: (n: number, of: number) => `Bag ${n} of ${of}`,
  tapPair: 'Tap the two numbers that go together first.',
  tapPower: 'A number with a power is a step on its own: tap it.',
  whatIs: (step: string) => `What is ${step}?`,
  check: 'Check',
  clear: 'Delete',
  ticket: 'Ticket',
  card: 'The order',
  lookTogether: 'Let’s look together.',
  tapGlowing: 'Tap the glowing numbers.',
  workedTitle: (name: string) => `How it works: ${name}`,
  workedNext: 'Next line',
  workedGo: 'My turn',
  sending: 'Order up…',
  orderUp: 'Order up!',
  setDone: (good: number, of: number) => `${good} of ${of} bags good`,
  passedLevel: (name: string) => `Level passed: ${name}!`,
  newBadge: (name: string) => `New achievement: ${name}`,
  passedAgain: 'Set passed!',
  notYet: 'Not passed yet: you need 7 good bags out of 8. Every set is new bags, so have another go.',
  nextLevel: 'Next level',
  backToRoad: 'Back to the levels',
  wentWrong: 'Something went wrong. Please try again soon.',
  helped: 'Helped',
  rightLine: (step: string, value: number) => `${step} = ${value}`,
};

/** Each level's name on the road (docs/ORDERUP-PLAN.md, "Steps"). */
export const LEVEL_NAMES = ['', 'Left to right', '× ÷ first', 'Brackets', 'Exponents', 'All together', 'Place the brackets', 'Word problems'];

/** A level's achievement name (the migration's achievements). */
export const BADGES = ['', 'Left to right', 'Times first', 'Bracket boss', 'Power up', 'Head chef', 'Bracket builder', 'Diner master'];

/** The teacher's words for each kind of mistake (the class report). */
export const SLIP_WORDS: Record<string, string> = {
  rank: 'adds or subtracts before × and ÷',
  'left-to-right': 'doesn’t go left to right with a team (× ÷ or + −)',
  'brackets-first': 'starts outside the brackets',
  'exponent-first': 'leaves the power till later',
  'not-same-step': 'picks two numbers not joined by one sign',
  'power-as-times': 'reads 3² as 3 × 2',
  'added-not-multiplied': 'adds instead of multiplying',
  'divide-slip': 'subtracts or multiplies instead of dividing',
  wrong: 'arithmetic slips',
};
