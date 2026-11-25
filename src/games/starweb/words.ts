/**
 * Star Web's words for pupils: what the screens show and what Bella reads (voiceLines.ts builds the clip list from these, so
 * text and clips can't drift). Spoken lines say "times" and "equals"; nothing spoken gives away a fact still to find.
 */
import { ARM_NAMES, type Anchor, type Arm } from '../../../shared/classlive/stars';
import { CREATURES, type Medal } from '../../../shared/starweb/config';

export const ASK = 'What else do we know?';
export const sayKnown = ({ x, y, p }: Anchor) => `We know ${x} times ${y} equals ${p}. What else do we know?`;

/** The guided first sky (3 × 4), one lit-up thing at a time. `say` is read aloud, `show` is on screen. */
export const GUIDE = [
  { show: 'We know 3 × 4 = 12. What else do we know? Turn it around: type 4 × 3 = 12, then press Send ⭐.', say: 'We know 3 times 4 equals 12. What else do we know? Turn it around. Type 4 times 3 equals 12, then press Send.' },
  { show: 'A new star! Every true fact that links to the one we know lights a star in its arm.', say: 'A new star! Every true fact that links to the one we know lights a star in its arm.' },
  { show: 'Fill all seven arms to light the sky and draw a creature. The line under the keypad always says what to try next.', say: 'Fill all seven arms to light the sky and draw a creature. The line under the keypad always says what to try next.' },
] as const;
/** The guide again on another sky: the same steps with that sky's numbers (shown, not read aloud). */
export const guideShow = (step: number, { x, y, p }: Anchor) =>
  step === 0 ? `We know ${x} × ${y} = ${p}. What else do we know? Turn it around: type ${y} × ${x} = ${p}, then press Send ⭐.` : GUIDE[step].show;

export const FEEDBACK = {
  again: 'You found that one. Can you find a new one?',
  same: 'That’s the fact we know! Find one it unlocks.',
  wrong: 'Not quite. Check the answer.',
  unreadable: 'Write it like 12 × 7 = 84.',
  full: 'This sky is full of stars! Press Finish.',
} as const;
export const unlinked = ({ x, y }: Anchor) => `True! But how does it link to ${x} × ${y}? Try turning it around, doubling, halving or × 10.`;
export const SAY_UNLINKED = 'True! But how does it link to the fact we know?';
export const SAY_WRONG = FEEDBACK.wrong;
export const SAY_AGAIN = FEEDBACK.again;
export const SAY_SAME = 'That’s the fact we know! Find one it unlocks.';

/** The help ladder's first rung: a gentle nudge to the emptiest arm (fixed words, read aloud). */
export const NUDGE: Record<Arm, string> = {
  turn: 'Try turning the fact around.',
  divide: 'Try a division fact that undoes it.',
  double: 'Try doubling one of the numbers.',
  halve: 'Try halving one of the numbers.',
  tens: 'Try making one number ten times bigger.',
  near: 'Try one more group, or one less.',
  wild: 'Find a new way to make the answer.',
};
export const SHOW_ME = 'Show me';
export const SHOW_ME_SAY = 'Here is how it works on a different fact.';

export const MEDAL_WORDS: Record<Exclude<Medal, 0>, { title: string; say: string }> = {
  1: { title: 'Every arm lit! Bronze', say: 'Every arm is lit! The creature is drawn. That’s bronze!' },
  2: { title: 'Silver sky', say: 'Silver! Twenty five stars.' },
  3: { title: 'Gold! Supernova', say: 'Gold! Supernova!' },
};
export const MEDAL_COLOURS: Record<Medal, string> = { 0: '#3b4a7a', 1: '#d08a4c', 2: '#d9e2ee', 3: '#ffd54a' };

export const MAP_WELCOME = 'This is your Star Map. Each sky you light makes two times tables glow.';
export const MAP_TIP = 'Press New sky. The fact comes from the times tables you know best.';
export const creatureJoined = (id: (typeof CREATURES)[number]['id']) => `${CREATURES.find((c) => c.id === id)?.name ?? 'A creature'} joined your Star Map!`;
export const FREE_OPEN = 'Free sky is open! Pick any times fact up to 12 times 12.';
export const SAY_FINISH_READY = 'Every arm is lit. Keep going for silver, or press Finish.';

export const armName = (a: Arm) => ARM_NAMES[a];
