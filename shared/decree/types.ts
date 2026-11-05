/**
 * The shape of Royal Decree's cards. The deck itself is in cards.ts; the people in cast.ts.
 */
import type { Meter } from './config';

/** How a choice moves the meters: whole numbers from −EFFECT_MOST to +EFFECT_MOST. Leave out meters it doesn't touch. */
export type Effect = Partial<Record<Meter, number>>;

export interface Choice {
  /** The button / swipe label, at most 18 characters: "Yes, bake them!" */
  label: string;
  effect: Effect;
  /** What the villager says back after this choice (optional, at most 90 characters). */
  reply?: string;
  /** A story flag this choice sets, which can bring a follow-up card later in the same reign. */
  sets?: string;
}

export interface Card {
  /** Unique, kebab-case: 'baker-pies'. */
  id: string;
  /** Who asks (an id from CAST). */
  who: string;
  /** The request, at most 140 characters, plain words for 8 to 11 year olds, usually with a number in it. */
  text: string;
  /** Swipe left. */
  no: Choice;
  /** Swipe right. */
  yes: Choice;
  /** Only comes once this story flag has been set earlier in the reign (a follow-up card). */
  needs?: string;
  /** Can't come before this card number in the reign (1-based), so big events wait a little. */
  from?: number;
  /** How likely it is to be drawn compared with others (default 1). */
  weight?: number;
}

/** A villager who can ask a maths question ("riddle"). The question itself always comes from the pupil's maths focus. */
export interface Riddle {
  who: string;
  /** What they say before the question, at most 90 characters: "My chickens laid eggs all week. Help me count!" */
  ask: string;
  /** The meter a right answer helps. */
  meter: Meter;
  /** Their thanks after a right answer, at most 70 characters. */
  thanks: string;
}

export interface Villager {
  id: string;
  name: string;
  /** What they are, in two or three words: "the baker". */
  role: string;
}
