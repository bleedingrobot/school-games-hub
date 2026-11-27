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

it('gives every ladder question a help card that teaches without giving the answer', async () => {
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

  // Measure help (round 2): height 1 does not write the answer; a long rectangle side is split; a half turn is not counted in 45s.
  {
    const steps = (parts: string[], prompt: string) => helpCardFor({ parts, prompt })?.steps.join(' ') ?? '';
    expect(steps(['Volume', '=', '?', 'cm³'], 'A box: length 1 cm, width 2 cm, height 1 cm')).not.toContain('= 2 ');
    expect(steps(['Area', '=', '?', 'cm²'], 'A rectangle 12 cm by 7 cm')).toContain('10 × 7 = 70');
    expect(steps(['W', 'to', 'E', '=', '?°'], 'Turn clockwise')).toContain('Half of 360');
  }

  // The order James asked for (26 Nov 2026): the picture's help first, other strategies next, counting in lots last.
  const titles = (parts: string, known?: string) => helpCardsFor({ parts: parts.split(' ') }, { known: (k) => k === known }).map((c) => c.title);
  expect(titles('3 × 12 = ?', 'mul:3x11')).toEqual(['Use the box: tens and ones', 'Use a fact you know', 'Count in 12s']);
  expect(titles('32 ÷ 8 = ?')).toEqual(['Use the array', 'Halve three times', 'Count in 8s']);
  expect(titles('3 × 4 = ?')).toEqual(['Double, then double again', 'Count the rows of dots']);
  // A fraction of an amount ends on how many groups the top number asks for.
  expect(helpCardsFor({ parts: '1/5 of 30 = ?'.split(' ') }).map((c) => c.steps.at(-1))).toEqual([
    'The top number is 1: take just 1 part. 30 ÷ 5 = ?', 'The top number is 1, so the answer is just 1 group: 1 group = ?']);
  // The bar card leaves the share for the pupil (no printed 15 ÷ 3 = 5).
  expect(helpCardsFor({ parts: '2/3 of 15 = ?'.split(' ') })[0].steps.join(' ')).not.toContain('= 5');

  // Rounding keeps the digits in front of the rounding digit (569 to the nearest 10 keeps the 5).
  expect(helpCardsFor({ parts: ['Round', '569', 'to the nearest 10', '=', '?'] }).find((c) => c.kind === 'rounding')?.steps.at(-1)).toContain('Keep the 5 in front');

  // fraction cards: curriculum words in brackets, and no digit shift handed over
  {
    // Teacher note: 82/100 as a decimal names the numerator and the denominator.
    const dec = helpCardsFor({ parts: '82/100 = ?'.split(' '), prompt: 'Write it as a decimal.' }).find((c) => c.kind === 'frac-to-decimal')!;
    expect(dec.steps[0]).toContain('(denominator)');
    expect(dec.steps[1]).toContain('(numerator)');
    // 4 ÷ 10 asks where the digit goes, with no sharing of dots.
    const div = helpCardsFor({ parts: '4 ÷ 10 = ?'.split(' ') }).find((c) => c.kind === 'divide-decimals')!;
    expect(div.steps.join(' ')).toMatch(/Which place do the 4 ones move into\?/);
    expect(div.steps.join(' ')).not.toMatch(/share|0\.4/i);
    // Half uses the doubles; 1 tenth is not "1 tenths".
    expect(helpCardsFor({ parts: '1/2 of 14 = ?'.split(' ') }).at(-1)!.title).toBe('Half is the double backwards');
    expect(helpCardsFor({ parts: 'Double 0.1 = ?'.split(' ') }).map((c) => c.steps.join(' ')).join(' ')).toContain('0.1 is 1 tenth.');
  }
  // round 2 fraction fixes: the pupil does the hard part, nothing is handed over
  {
    const text = (parts: string, extra: Partial<{ prompt: string; choiceLabels: string[] }> = {}) => helpCardsFor({ parts: parts.split(' '), ...extra }).map((c) => c.steps.join(' ')).join(' | ');
    expect(text('Double 1.8 = ?')).not.toContain('1.6');
    expect(text('Half of 3.8 = ?')).toContain('8 tenths shared in 2 = ? tenths');
    expect(text('75% = ?')).toContain('3 lots of 25%');
    expect(text('9.4 × ? = 940')).toContain('ones → tens → hundreds');
    expect(helpCardsFor({ parts: ['34/8', '=', '? 2/8'] }).map((c) => c.steps.join(' ')).join(' ')).toContain('40 − 8 = 32');
    expect(helpCardsFor({ parts: '1% of 600 = ?'.split(' ') })[0].title).toBe('1% is divide by 100');
    expect(text('12% × 10 = 10% × ?')).not.toContain('Trade places');
    // A second way in: the swap card, then Check it the long way.
    expect(helpCardsFor({ parts: '12% × 10 = 10% × ?'.split(' ') }).map((c) => c.title)).toEqual(['Try a small swap', 'Check it']);
    expect(text('Blue = ?', { prompt: '7 red to 9 blue. There are 42 red.' })).toContain('The bar is one group: 7 red and 9 blue.');
  }

  // gives n ÷ n a story, and 24 ÷ ? = 2 skip counting after halving
  // Teacher notes 2, 3 and 5 (27 Nov 2026): n ÷ n gets a sharing story; 24 ÷ ? = 2 gets skip counting after Halve it.
  {
    const cards = (parts: string) => helpCardsFor({ parts: parts.split(' ') }).filter((c) => c.kind !== 'dots');
    for (const n of [1, 3, 6, 9, 12]) {
      const [story] = cards(`${n} ÷ ${n} = ?`).filter((c) => c.kind === 'tables');
      expect(story.title).toBe('Share it out');
      expect(story.steps.join(' ')).toContain(`${n} things are shared into ${n} equal groups`);
      expect(story.steps.join(' ')).not.toMatch(/fewer|less|2 ×/);
      expect(cards(`${n} ÷ ${n} = ?`).some((c) => c.kind === 'skip-count')).toBe(false);
    }
    expect(helpCardFor({ parts: '12 ÷ ? = 12'.split(' ') })!.steps.join(' ')).toContain('groups');
    expect(helpCardFor({ parts: '9 ÷ ? = 1'.split(' ') })!.steps.join(' ')).toContain('every group gets 1');
    expect(helpCardFor({ parts: '0 ÷ 5 = ?'.split(' ') })!.title).toBe('Nothing to share');
    expect(helpCardsFor({ parts: '24 ÷ ? = 2'.split(' ') }).map((c) => c.title)).toEqual(['Use the array', 'Halve it', 'Count in 2s']);
  }

  // never writes the answer in the take-the-ten-away, pairs-to-10 and adding-zero cards
  {
    const text = (parts: string) => helpCardsFor({ parts: parts.split(' ') }).map((c) => c.steps.join(' | ')).join(' || ');
    expect(text('16 − 10 = ?')).not.toMatch(/6 ones/);
    expect(text('20 − 10 = ?')).not.toMatch(/10 ones/);
    expect(text('10 − 10 = ?')).not.toMatch(/0 ones/);
    expect(text('10 − 5 = ?')).not.toContain('5+5');
    expect(text('0 + ? = 10')).not.toMatch(/make 10 all by itself/);
  }

  // keeps big numbers on one line
  {
    expect(show(586000)).toBe('586 000');
  }

  // help boxes never state the fact the question asks for
  {
    const { helpKind } = await import('../hint');
    const q = (parts: string[]) => ({ parts, prompt: '' });
    expect(helpKind(q(['1 h', '=', '?', 'min']))).toBeNull();
    expect(helpKind(q(['½ h', '=', '?', 'min']))).toBeNull();
    expect(helpKind(q(['3/4 h', '=', '?', 'min']))).toBeNull();
    expect(helpKind(q(['3 h', '=', '?', 'min']))).toBe('hours');
    expect(helpKind(q(['3 min', '=', '?', 's']))).toBe('hours');
    expect(helpKind(q(['1 min', '=', '?', 's']))).toBeNull();
  }

  // whole-unit conversions do not print the fact, and half turns ask for the opposite
  {
    const steps = (parts: string[], prompt = '') => helpCardFor({ parts, prompt })?.steps.join(' ') ?? '';
    expect(steps(['60 min', '=', '?', 'h'])).not.toContain('1 h = 60 min');
    expect(steps(['1000 mL', '=', '?', 'L'])).not.toContain('1 L = 1000 mL');
    expect(steps(['240 min', '=', '?', 'h'])).toContain('24 ÷ 6 = ?');
    const turn = steps(['Face west, half turn', ':', '?'], 'Which way are you now facing?');
    expect(turn).toContain('straight across the middle');
  }

  // number help leaves the working to the pupil and handles the edge rolls
  {
    const steps = (parts: string[], prompt = '') => helpCardFor({ parts, prompt })?.steps.join(' | ') ?? '';
    // Times tens: the pupil does the fact, only the zeros are counted for them.
    expect(steps(['90', '×', '9', '=', '?'])).toContain('Cover the zeros: 9 × 9 = ?');
    expect(steps(['80', '÷', '2', '=', '?'])).toContain('it is 8 ÷ 2');
    // Bonds: 9 tens need nothing more, and one ten is "1 ten".
    expect(steps(['95', '+', '?', '=', '100'])).toContain('Count on from 95 to 100');
    expect(steps(['?', '+', '51', '=', '100'])).toContain('5 tens');
    expect(steps(['?', '+', '19', '=', '100'])).toContain('1 ten needs');
    expect(steps(['?', '+', '950', '=', '1000'])).toContain('already 9 hundreds, so 0 more');
    // Rounding: the pupil decides up or down, and a 9 at the front is explained.
    const round = steps(['Round', '97 100', 'to the nearest ten thousand', '=', '?']);
    expect(round).not.toMatch(/round up\.$|goes up by 1/);
    expect(round).toContain('put a 1 in front');
    // Negatives and powers.
    expect(steps(['−12', '+', '?', '=', '0'])).not.toContain('12 below');
    expect(steps(['10²', '=', '?'])).toContain('10 × 10 = ?');
    expect(steps(['−2', '−', '−1', '=', '?'])).toContain('go up 1 step:');
    expect(steps(['LCM of 11 and 12', '=', '?'])).toContain('11 × 12 = ?');
  }

  // reads the ÷ array first, in rows
  // Teacher notes 1 and 3 (27 Nov 2026): the ÷ array card comes first and ends on one small step.
  {
    const [first] = helpCardsFor({ parts: '16 ÷ 4 = ?'.split(' ') });
    expect(first.title).toBe('Use the array');
    expect(first.steps).toEqual(['The 16 dots are in 4 equal rows.', 'Each row is one equal group.', 'How many dots in each row?']);
    expect(helpCardsFor({ parts: '9 ÷ 9 = ?'.split(' ') })[0].steps.at(-1)).toBe('How many rows?');
  }

  // says rows, not columns, on the hundred square, and degrees on the thermometer
  {
    const all = (parts: string, prompt?: string) => helpCardsFor({ parts: parts.split(' '), prompt }).map((c) => c.steps.join(' ')).join(' ');
    expect(all('20 + ? = 100')).toContain('empty rows of 10');
    expect(all('82/100 = ?', 'Write it as a decimal.')).toContain('8 full rows of 10 and 2 single squares');
    expect(all('82/100 = ?', 'Write it as a decimal.')).not.toMatch(/column/);
    const temp = all('−9° + 12° = ?°');
    expect(temp).toContain('Going up to 0° is 9 degrees.');
    expect(temp).not.toMatch(/marks|the other 3/);
    expect(all('10 + ? = 19')).not.toMatch(/Fill the frame up to 10/);
  }

  // makes the balance card fit the equation
  {
    const [first] = helpCardsFor({ parts: ['p', '=', '?'], prompt: 'If p + 11 = 23' });
    expect(first.title).toBe('Keep it balanced');
    expect(first.steps.at(-1)).toBe('23 − 11 = ?');
  }

  // number help: rounding keeps the front digits, leading zero, missing sum, squares, cubes, opposites, powers of ten
  {
    const last = (parts: string[], kind?: string, extra: object = {}) => helpCardsFor({ parts, ...extra }, {}).find((c) => !kind || c.kind === kind)!.steps.at(-1)!;
    expect(last(['Round', '4914', 'to the nearest 100', '=', '?'], 'rounding')).toBe('Keep the 4 in front. After it write the hundreds digit (1 more if you rounded up), then 00: ?');
    expect(last(['Round', '42 010', 'to the nearest 1000', '=', '?'], 'rounding')).toContain('Keep the 4 in front');
    expect(last(['100 000', 'less than', '109 000', '=', '?'], 'count-big')).toContain('Leave off a 0 at the front');
    expect(last(['100 000', 'less than', '216 000', '=', '?'], 'count-big')).not.toContain('Leave off');
    expect(helpCardsFor({ parts: ['14 000', '+', '?', '=', '20 000'] }).find((c) => c.kind === 'missing-big')!.steps[1]).toBe('What do you add to 14 to make 20?');
    expect(last(['12', 'squared', '=', '?'], 'squares')).toBe('120 + 24 = ?');
    expect(last(['4', 'cubed', '=', '?'], 'squares')).toBe('Double 32 = ?');
    expect(last(['5', 'cubed', '=', '?'], 'squares')).toBe('Half of 250 = ?');
    expect(helpCardsFor({ parts: ['5', '−', '14', '=', '?'] }).find((c) => c.kind === 'negatives')!.steps[1]).toBe('Going down 14: it takes 5 steps to reach 0.');
    expect(helpCardsFor({ parts: ['1', '−', '4', '=', '?'] }).find((c) => c.kind === 'negatives')!.steps[1]).toBe('Going down 4: it takes 1 step to reach 0.');
    expect(helpCardsFor({ parts: ['−20', '+', '?', '=', '0'] }).find((c) => c.title === 'Opposites')).toBeTruthy();
    expect(helpCardsFor({ parts: ['10⁶', '=', '?'] }).find((c) => c.kind === 'powers')!.steps[0]).toBe('10⁶ means 6 tens multiplied together: 10 × 10 × 10 × 10 × 10 × 10.');
  }
});
