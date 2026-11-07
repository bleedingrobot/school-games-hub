/**
 * The finish screen's "what's next" card (maths review R8): when the beanstalk the child has just played is a bonds to 20
 * one or bigger and its pairs are secure, and Weka is switched on for the class, a card points on to Weka's Stepping
 * Stones ("You know your pairs. Use them to add across ten."). No new database: it reads the child's own maths records.
 */
import { mastery, type FactStats } from '../../../shared/maths/leitner';
import { factKeys, type Target } from '../../../shared/beanstalk/round';

/** Secure: at least this share of the sum's facts are at box 2 or more (the rule the teacher's skill map uses). */
export const SECURE_SHARE = 0.7;

/** Where the card can go and whether it should: Weka's switch for the class, and how to read whether a sum is secure. */
export interface Signpost {
  /** Weka's switch for this child's class: null while loading, and treated as off. */
  wekaOn: boolean | null;
  /** True when the sum's pairs are secure in this child's records (false if they can't be read). */
  secure: (target: Target) => Promise<boolean>;
  /** Opens Weka's Stepping Stones. */
  open: () => void;
}

/** The card shows from the bonds to 20 beanstalk on: the plain bonds to 10 come before the game's own next step. */
export const SIGNPOST_FROM: Target = 20;

/** Is at least 70 percent of this sum's facts secure (box 2 or more) in these records? */
export function sumSecure(facts: readonly FactStats[], target: Target): boolean {
  const keys = factKeys(target);
  const byKey = new Map(facts.map((f) => [f.key, f]));
  const secure = keys.filter((k) => ['secure', 'fluent'].includes(mastery(byKey.get(k)))).length;
  return secure / keys.length >= SECURE_SHARE;
}
