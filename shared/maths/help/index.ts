/**
 * Help me for any ladder question (docs/plans/help-me/PLAN.md): the first helper that recognises the question makes its
 * card. Helpers are grouped by topic, one file each.
 */
import { ALGEBRA_HELPERS } from './algebra';
import { BASIC_HELPERS } from './basic';
import { FRACTIONS_HELPERS } from './fractions';
import { MEASURE_HELPERS } from './measure';
import { NUMBER_HELPERS } from './number';
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
