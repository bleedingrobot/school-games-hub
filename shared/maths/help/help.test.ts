/**
 * Help me (docs/plans/help-me/PLAN.md): every question type on the auto ladder gets a help card, worked from what the
 * question shows, that never gives the answer away (the last step ends in "?" and doesn't contain it).
 */
import { expect, it } from 'vitest';
import { LADDER, questionForKey } from '../ladder';
import { helpCardFor } from './index';
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
      const last = help.steps[help.steps.length - 1];
      const answer = q.choiceLabels && q.choices ? q.choiceLabels[q.choices.indexOf(q.answer)] : show(q.answer);
      if (help.steps.some((s) => !s.trim() || /undefined|NaN|Infinity|\[object/.test(s))) problems.push(`broken step for ${shown}: ${help.steps.join(' | ')}`);
      if (!last.includes('?')) problems.push(`last step has no ? for ${shown}: ${last}`);
      if (new RegExp(`(=|is|:)\\s*${answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\.?$`).test(last)) problems.push(`last step gives the answer for ${shown}: ${last}`);
    }
  }
  expect(problems).toEqual([]);
});
