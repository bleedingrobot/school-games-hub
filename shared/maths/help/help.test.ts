/**
 * Help me (docs/plans/help-me/PLAN.md): every question type on the auto ladder gets a help card, worked from what the
 * question shows, that never gives the answer away (the last step ends in "?" and doesn't contain it).
 */
import { expect, it } from 'vitest';
import { LADDER, questionForKey } from '../ladder';
import { helpCardFor, helpCardsFor } from './index';
import { show } from './read';

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

/** One key per question type: the times tables and early facts by their kind, other skills key by key. */
export function sampleKeys(): string[] {
  const out: string[] = [];
  for (const skill of LADDER) {
    if (skill.inAuto === false) continue;
    out.push(...skill.keys);
  }
  return out;
}

it('gives every ladder question a help card that teaches without giving the answer', () => {
  const random = seeded(7);
  const problems: string[] = [];
  const known = (k: string) => k === 'mul:6x7' || k === 'mul:7x7';
  for (const key of sampleKeys()) {
    for (let i = 0; i < 8; i++) {
      const q = questionForKey(key, i, random);
      if (!q) continue;
      const shown = `${key}: ${q.prompt ?? ''} ${q.parts.join(' ')}`;
      const help = helpCardFor(q, { known });
      if (!help) {
        problems.push(`no help for ${shown}`);
        break;
      }
      const answer = q.choiceLabels && q.choices ? q.choiceLabels[q.choices.indexOf(q.answer)] : show(q.answer);
      // Every card shown: the one that matches the picture first (James, 26 Nov 2026), then the topic card.
      for (const card of helpCardsFor(q, { known })) {
        const last = card.steps[card.steps.length - 1];
        if (card.steps.some((s) => !s.trim() || /undefined|NaN|Infinity|\[object/.test(s))) problems.push(`broken step for ${shown}: ${card.steps.join(' | ')}`);
        if (!last.includes('?')) problems.push(`last step has no ? for ${shown}: ${last}`);
        if (new RegExp(`(=|is|:)\\s*${answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\.?$`).test(last)) problems.push(`last step gives the answer for ${shown}: ${last}`);
        if (card.steps.some((s) => new RegExp(`(=|is)\\s*${answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\.?$`).test(s)) && card.kind !== help.kind) problems.push(`a picture step gives the answer for ${shown}: ${card.steps.join(' | ')}`);
      }
    }
  }
  expect(problems).toEqual([]);

  // The order James asked for (26 Nov 2026): the picture's help first, other strategies next, counting in lots last.
  const titles = (parts: string, known?: string) => helpCardsFor({ parts: parts.split(' ') }, { known: (k) => k === known }).map((c) => c.title);
  expect(titles('3 × 12 = ?', 'mul:3x11')).toEqual(['Use the box: tens and ones', 'Use a fact you know', 'Count in 12s']);
  expect(titles('32 ÷ 8 = ?')).toEqual(['Halve three times', 'Count in 8s']);
  expect(titles('3 × 4 = ?')).toEqual(['Double, then double again', 'Count the rows of dots']);
  // A fraction of an amount ends on how many groups the top number asks for.
  expect(helpCardsFor({ parts: '1/5 of 30 = ?'.split(' ') }).map((c) => c.steps.at(-1))).toEqual([
    'The top number is 1, so the answer is just 1 part: ?', 'The top number is 1, so the answer is just 1 group: 1 group = ?']);
});
