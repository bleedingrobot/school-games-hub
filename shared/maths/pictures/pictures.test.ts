/**
 * Question pictures (docs/plans/help-me/PLAN.md H8): every question type that has a picture idea gets one, worked out from
 * what the question shows, and the picture never gives the answer away.
 */
import { expect, it } from 'vitest';
import { LADDER, questionForKey } from '../ladder';
import { show } from '../help/read';
import { pictureFor } from './index';
import { PICTURE_RULES } from './rules';
import type { Picture } from './types';

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

/** The skills with a picture idea (docs/plans/help-me/picker.html PICS). Left out on purpose: money-y5 (coins and notes) and metric-y6 (jug and scales). */
const SKILLS = [
  'facts-5', 'facts-10', 'dbl-half-10', 'ten-and', 'facts-20', 'dbl-half-20', 'skip-10', 'skip-5', 'skip-2', 'tables-2', 'bonds-100',
  'round-10-100', 'round-1000', 'unit-fraction-of', 'fraction-bonds', 'tenths', 'decimal-bonds', 'times-2by1', 'place-million',
  'angle-types', 'metric-mm-km', 'compass-4', 'decimal-equivalents', 'percent-basic', 'fraction-of', 'equivalent-fractions',
  'mixed-improper', 'remainders', 'count-zero', 'time-24', 'elapsed', 'fraction-add-y6', 'coordinates', 'chance-words',
  'mean-range-y6', 'whole-from-fraction', 'int-compare', 'int-add-sub', 'fraction-add-easy', 'fraction-divide', 'ratio', 'equations-1',
];

/** Question types inside those skills that the idea doesn't cover (key prefix: why). */
const NO_PICTURE: Record<string, string> = {
  'ang5:clue': 'only the "110° is…" type is drawn',
  'tenth:half': 'half of a decimal has no tenths picture',
  'deceq:compare': 'which is bigger: no picture idea',
  'nf:ratio-eq': 'ratio sharing only',
};

/** Numbers the picture shows, as a pupil could read them off (what must not be the answer). */
function shown(p: Picture): number[] {
  switch (p.kind) {
    case 'frames': return p.counts;
    case 'dot-rows': return p.rows;
    case 'track': return p.cells.map(Number);
    // A mark is the number the question gave (checked by its label below); an unlabelled mark must not sit on the answer.
    case 'number-line': return (p.marks ?? []).filter((m) => !m.label).map((m) => m.at);
    case 'hundred': return [p.shaded];
    case 'bars': return p.bars.map((b) => b.shaded);
    case 'split-box': return [p.tens, p.ones, p.by];
    case 'thermometer': return [p.start];
    default: return [];
  }
}

/** Every number in what the question shows: a picture may repeat those. */
function inQuestion(q: { parts: readonly string[]; prompt?: string }): Set<number> {
  const out = new Set<number>();
  for (const m of `${q.prompt ?? ''} ${q.parts.join(' ')}`.replace(/−/g, '-').replace(/(\d) (?=\d{3}\b)/g, '$1').matchAll(/-?\d+(\.\d+)?/g)) out.add(Number(m[0]));
  return out;
}

it('gives every question type with a picture idea a picture that does not show the answer', () => {
  const random = seeded(11);
  const problems: string[] = [];
  const pictures = new Set<string>();
  for (const id of SKILLS) {
    const skill = LADDER.find((s) => s.id === id);
    if (!skill) {
      problems.push(`no skill ${id}`);
      continue;
    }
    for (const key of skill.keys) {
      const exempt = Object.keys(NO_PICTURE).some((k) => key.startsWith(k));
      for (let i = 0; i < 3; i++) {
        const q = questionForKey(key, i, random);
        if (!q) continue;
        const seen = `${id} ${key}: ${q.prompt ?? ''} ${q.parts.join(' ')}`;
        const view = { parts: q.parts, prompt: q.prompt, choices: q.choices, choiceLabels: q.choiceLabels, figure: q.figure };
        if (q.figure) {
          // The server's own figure stays, and the compass one is also what the rule would have drawn.
          if (pictureFor(view) !== null) problems.push(`picture over a figure for ${seen}`);
          if (key.startsWith('comp5')) {
            const bare = PICTURE_RULES.map((r) => r({ ...view, figure: undefined })).find(Boolean);
            if (bare?.kind !== 'figure') problems.push(`no compass picture for ${seen}`);
          }
          continue;
        }
        const pic = pictureFor(view);
        if (!pic) {
          if (!exempt) problems.push(`no picture for ${seen}`);
          continue;
        }
        pictures.add(pic.kind);
        const answer = q.choiceLabels && q.choices ? q.choiceLabels[q.choices.indexOf(q.answer)] : show(q.answer);
        const json = JSON.stringify(pic);
        if (/undefined|NaN|Infinity|null/.test(json)) problems.push(`broken picture for ${seen}: ${json}`);
        if (/\?/.test(json) && pic.kind !== 'track' && pic.kind !== 'figure' && !/shaded part = /.test(json)) problems.push(`'?' in picture for ${seen}: ${json}`);
        if (pic.kind === 'track' && pic.cells.filter((c) => c === '?').length !== 1) problems.push(`track gap for ${seen}: ${json}`);
        const asked = Number(answer.replace(/−/g, '-').replace(/ /g, ''));
        if (!inQuestion(view).has(asked) && !['wholes', 'array', 'frames', 'dot-rows'].includes(pic.kind) && shown(pic).includes(asked)) {
          problems.push(`picture shows the answer for ${seen}: ${json}`);
        }
        // A line mark or label never says the answer in words either.
        if (pic.kind === 'number-line' && (pic.marks ?? []).some((m) => m.label === answer && !inQuestion(view).has(Number(answer.replace(/−/g, '-'))))) {
          problems.push(`mark is the answer for ${seen}: ${json}`);
        }
        if (pic.kind === 'figure' && pic.figure.kind === 'grid' && !(q.choiceLabels ?? []).length) problems.push(`grid without choices for ${seen}`);
      }
    }
  }
  expect(problems).toEqual([]);
  // The kinds the other helper draws are all used by something.
  expect([...pictures].sort()).toEqual(expect.arrayContaining(['array', 'balance', 'bars', 'clock-24', 'clocks', 'dot-rows', 'figure', 'frames', 'hundred', 'number-line', 'place', 'split-box', 'thermometer', 'towers', 'track', 'unit-ladder', 'wholes']));

  // draws a ÷ fact as an array of equal rows
  // Teacher notes 1 and 3 (27 Nov 2026): ÷ facts are an array (rows × columns), not dots in fives.
  {
    const pic = (parts: string) => pictureFor({ parts: parts.split(' ') });
    expect(pic('16 ÷ 4 = ?')).toEqual({ kind: 'array', rows: 4, cols: 4, groups: true });
    // Kept wide, not tall: 9 ÷ 9 is 1 row of 9, 12 ÷ ? = 3 is 3 rows of 4.
    expect(pic('9 ÷ 9 = ?')).toEqual({ kind: 'array', rows: 1, cols: 9, groups: true });
    expect(pic('12 ÷ ? = 3')).toEqual({ kind: 'array', rows: 3, cols: 4, groups: true });
    // Remainders: rows the size of a group, the left-overs as a short row.
    expect(pic('29 ÷ 8 = ? r 5')).toEqual({ kind: 'array', rows: 3, cols: 8, extra: 5 });
  }
  // Decimal take-away: a line only when the tenths can't be taken away (3.8 − 0.6 is ones then tenths).
  expect(pictureFor({ parts: '3.8 − 0.6 = ?'.split(' ') })).toBeNull();
  expect(pictureFor({ parts: '3.1 − 0.6 = ?'.split(' ') })?.kind).toBe('number-line');

  // makes pictures match their cards
  {
    const pic = (parts: string, prompt?: string) => pictureFor({ parts: parts.split(' '), prompt });
    // Room up to the total: a second, empty ten-frame.
    expect(pic('4 + ? = 11')).toEqual({ kind: 'frames', size: 10, counts: [4], frames: 2 });
    // Back to 0 is a line through zero, not counters.
    expect(pic('13 + ? = 0')?.kind).toBe('number-line');
    // A wide line through zero labels only the 5s.
    const line = pic('−6 + 13 = ?');
    expect(line?.kind === 'number-line' && line.labels).toEqual([-5, 0, 5, 10]);
    // Percent is out of 100, not the answer fraction as a bar; no square for a power of 10.
    expect(pic('75% = ?')).toEqual({ kind: 'hundred', shaded: 75 });
    expect(pic('0.01 = ?', 'Write it as a power of 10.')).toBeNull();
    // The jumps on a track, with no size.
    expect(pic('0, 10, 20, ?', 'What comes next?')).toEqual({ kind: 'track', cells: ['0', '10', '20', '?'], arcs: '+' });
    // A ratio shades the share asked for.
    expect(pictureFor({ parts: ['Bigger part', '=', '?'], prompt: 'Share 54 in the ratio 4 : 5.' })).toEqual({ kind: 'bars', bars: [{ parts: 9, shaded: 5, start: 4, label: '54' }] });
    // A short unit ladder: only the two units asked.
    expect(pictureFor({ parts: ['0.3 m', '=', '?', 'cm'] })).toEqual({ kind: 'unit-ladder', units: ['m', 'cm'], links: ['× 100'], highlight: ['m', 'cm'], direction: 'down' });
    {
      // Going up the ladder: the arrows point up and divide. A half is a two-row array. Bigger divisions get an array.
      expect(pictureFor({ parts: ['5000 m', '=', '?', 'km'] })).toMatchObject({ kind: 'unit-ladder', links: ['÷ 1000'], direction: 'up' });
      expect(pic('Half of 6 = ?')).toEqual({ kind: 'array', rows: 2, cols: 3, groups: true });
      expect(pic('36 ÷ 3 = ?')).toEqual({ kind: 'array', rows: 3, cols: 12, groups: true });
      expect(pic('60 ÷ 1 = ?')).toBeNull();
      // The crowded line from −25 to 25 labels every 10; "9.4 × ? = 940" gets a chart; 1 group labels the ratio bar.
      expect(pic('20 + ? = 0')).toMatchObject({ kind: 'number-line', labels: [-20, -10, 0, 10, 20] });
      expect(pic('9.4 × ? = 940')).toEqual({ kind: 'place', headings: ['100s', '10s', '1s', 'tenths'], digits: ['', '', '9', '4'] });
      expect(pic('10 − 9.9 = ?')).toMatchObject({ kind: 'number-line', from: 9, to: 10, marks: [{ at: 9.9, label: '9.9' }] });
      expect(pic('10 − 5.2 = ?')).toMatchObject({ kind: 'number-line', from: 4, to: 5 });
    }
    // Decimals in a place chart, with room for the digits to move into (the answer is never written).
    expect(pic('1.4 ÷ 10 = ?')).toEqual({ kind: 'place', headings: ['1s', 'tenths', 'hundredths'], digits: ['1', '4', ''] });
  }
  // balance weights and the negative-power strip
  {
    expect(pictureFor({ parts: ['p', '=', '?'], prompt: 'If p + 11 = 23' })).toMatchObject({ leftBlocks: { letter: 'p', letters: 1, units: 11 }, rightBlocks: { units: 23 } });
    expect(pictureFor({ parts: ['m', '=', '?'], prompt: 'If 9m = 72' })).toMatchObject({ leftBlocks: { letter: 'm', letters: 9 }, rightBlocks: { block: '72' } });
    expect(pictureFor({ parts: ['s', '=', '?'], prompt: 'If s ÷ 9 = 8' })).toMatchObject({ leftBlocks: { letter: 's ÷ 9' }, rightBlocks: { units: 8 } });
    expect(pictureFor({ parts: ['10⁻³', '=', '?'], prompt: 'Write it as a decimal.' })).toEqual({ kind: 'place-strip', places: 3 });
  }
});
