/**
 * Help me for any ladder question (docs/plans/help-me/PLAN.md): the first helper that recognises the question makes its
 * card. Helpers are grouped by topic, one file each.
 */
import { ALGEBRA_HELPERS } from './algebra';
import { BASIC_HELPERS, countingCard } from './basic';
import { FRACTIONS_HELPERS } from './fractions';
import { MEASURE_HELPERS } from './measure';
import { NUMBER_HELPERS } from './number';
import { pictureFor } from '../pictures';
import { sum } from './read';
import { pictureCard, SAME_AS_PICTURE } from './picture';
import type { HelpCard, HelpContext, HelpQuestion, Helper } from './types';

export type { HelpCard, HelpContext, HelpQuestion } from './types';

/** Most specific first: the topic files' own question types before the plain sums and patterns of the basic facts. */
const HELPERS: Helper[] = [...MEASURE_HELPERS, ...ALGEBRA_HELPERS, ...FRACTIONS_HELPERS, ...NUMBER_HELPERS, ...BASIC_HELPERS];

/** A last step that is already a question ("Which name fits 130°?") needs no second "?" after it. */
function tidy(card: HelpCard): HelpCard {
  const steps = [...card.steps];
  steps[steps.length - 1] = steps[steps.length - 1].replace(/\?\s*\?$/, '?');
  return { ...card, steps };
}

/** A card, then its second way in if it has one (each shown as a card of its own). */
const withAlso = (card: HelpCard): HelpCard[] => {
  const { also, ...own } = card;
  return also && also.steps.length ? [tidy(own), tidy(also)] : [tidy(own)];
};

export function helpCardFor(q: HelpQuestion, ctx: HelpContext = {}): HelpCard | null {
  for (const helper of HELPERS) {
    try {
      const made = helper(q, ctx);
      if (made && made.steps.length) return tidy(made);
    } catch {
      // A helper that can't read this question just isn't the one for it.
    }
  }
  return null;
}

/**
 * All the help for a question, in order (James, 26 Nov 2026):
 * 1. the card that matches the question's picture ("the help that matches the image most closely first"),
 * 2. the topic card: a fact they know, doubling or halving, a trick ("followed by other strategies"),
 * 3. counting in lots, always last ("skip counting should be the last type of help"). An array picture is counting in
 *    lots, so its card goes last too.
 * Any can be missing. A topic card that says the same as the picture card is left out.
 */
export function helpCardsFor(q: HelpQuestion, ctx: HelpContext = {}): HelpCard[] {
  const topic = helpCardFor(q, ctx);
  let fromPicture: HelpCard | null = null;
  let counting: HelpCard | null = null;
  try {
    fromPicture = q.figure ? null : pictureCard(q, pictureFor(q));
    counting = countingCard(q);
  } catch {
    // A card that can't read this question is left out.
  }
  if (fromPicture && !fromPicture.steps.length) fromPicture = null;
  // An array of dots is counting in lots, so its card goes last, unless the question is a share or a group (÷): then the
  // rows are the groups and it matches the picture first.
  const dividing = sum(q)?.op === '÷';
  if (fromPicture?.kind === 'array' && !dividing) {
    counting = fromPicture;
    fromPicture = null;
  }
  const cards: HelpCard[] = [];
  if (fromPicture) cards.push(...withAlso(fromPicture));
  // The same idea twice is left out: the thermometer card and the number-line card, the ladder and the units card.
  const repeats = (fromPicture?.kind === 'thermometer' && topic?.kind === 'negatives') || (fromPicture?.kind === 'ladder' && topic?.kind === 'units');
  if (topic && !repeats && !(fromPicture && (SAME_AS_PICTURE.has(topic.title) || topic.title === fromPicture.title))) cards.push(...withAlso(topic));
  if (counting && counting.steps.length) cards.push(tidy(counting));
  return cards;
}
