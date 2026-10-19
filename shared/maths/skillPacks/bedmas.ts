/**
 * Order of operations (the ladder skill "bedmas"). NZ Curriculum order: brackets first, then × and ÷ left to right, then
 * + and − left to right. (Exponents have their own skill, squares and cubes; a square isn't written in these questions.)
 *
 * Question types (one mastery record each), from the first two-step questions to the mixed ones:
 *   bedmas:mul-first       2 + 3 × 4       times before adding or taking away
 *   bedmas:div-first       12 − 8 ÷ 4      dividing before adding or taking away
 *   bedmas:left-to-right   12 − 4 + 2      same rank: left to right
 *   bedmas:brackets-first  (2 + 3) × 4     brackets, then times
 *   bedmas:brackets-div    (10 − 4) ÷ 3    brackets, then divide
 *   bedmas:mixed           2 + 3 × 4 − 5   three steps, no brackets
 *   bedmas:mixed-brackets  (2 + 3) × 4 − 5 three steps with brackets
 *
 * Every question is four choices to tap (James, 19 Oct 2026). The wrong choices are what a student gets by following a named
 * mistake (working left to right gives 20 for 2 + 3 × 4), never a random number, and they are always different from the right
 * answer and from each other. A question where fewer than three mistakes give a different whole number is never asked.
 */
import { int, isInt, pickOne, type Family } from '../banded';
import { oneKey, sameParts, withMistakes, type Named, type Parser } from './generatedKit';

type Token = number | '+' | '−' | '×' | '÷' | '(' | ')';
const OPS = ['+', '−', '×', '÷'] as const;
const isOp = (t: Token | undefined): t is (typeof OPS)[number] => t === '+' || t === '−' || t === '×' || t === '÷';

interface Template {
  /** Mastery key. */
  key: string;
  /** Letters stand for numbers, in order a, b, c, d. */
  src: string;
}

const TEMPLATES: Template[] = [
  ...['a + b × c', 'a − b × c', 'a × b + c', 'a × b − c'].map((src) => ({ key: 'bedmas:mul-first', src })),
  ...['a + b ÷ c', 'a − b ÷ c', 'a ÷ b + c', 'a ÷ b − c'].map((src) => ({ key: 'bedmas:div-first', src })),
  ...['a − b + c', 'a − b − c', 'a ÷ b × c', 'a × b ÷ c'].map((src) => ({ key: 'bedmas:left-to-right', src })),
  ...['(a + b) × c', '(a − b) × c', 'a × (b + c)', 'a × (b − c)'].map((src) => ({ key: 'bedmas:brackets-first', src })),
  ...['(a + b) ÷ c', '(a − b) ÷ c', 'a ÷ (b + c)', 'a ÷ (b − c)'].map((src) => ({ key: 'bedmas:brackets-div', src })),
  ...['a + b × c − d', 'a × b + c × d', 'a × b − c × d', 'a − b ÷ c + d', 'a + b × c + d'].map((src) => ({ key: 'bedmas:mixed', src })),
  ...['(a + b) × c − d', 'a + b × (c − d)', '(a − b) × c + d', 'a × (b + c) − d', '(a + b) × (c − d)', '(a + b) ÷ c + d'].map((src) => ({ key: 'bedmas:mixed-brackets', src })),
];

export const BEDMAS_KEYS = [...new Set(TEMPLATES.map((t) => t.key))];

const lettersOf = (src: string) => (src.match(/[a-d]/g) ?? []).length;

/** The template with its numbers put in, as tokens. */
function tokensOf(src: string, nums: readonly number[]): Token[] {
  let next = 0;
  return (src.match(/[a-d]|[+−×÷]|[()]/g) ?? []).map((t) => (/[a-d]/.test(t) ? nums[next++] : (t as Token)));
}

/** What the student sees: a bracket group is one part, '(2 + 3)'. */
function partsOf(tokens: Token[]): string[] {
  const parts: string[] = [];
  let group: string[] | null = null;
  for (const t of tokens) {
    if (t === '(') group = [];
    else if (t === ')') {
      parts.push(`(${group!.join(' ')})`);
      group = null;
    } else (group ?? parts).push(String(t));
  }
  return [...parts, '=', '?'];
}

const words = (tokens: Token[]) =>
  tokens.map((t) => (t === '+' ? 'plus' : t === '−' ? 'minus' : t === '×' ? 'times' : t === '÷' ? 'divided by' : t === '(' ? 'open bracket' : t === ')' ? 'close bracket' : String(t))).join(' ');

// ---------------------------------------------------------------- working it out

/** How a student might (wrongly) work an expression out. The right way is normal rank, left to right, brackets first. */
interface Way {
  rank: 'normal' | 'flat' | 'reversed';
  /** Equal ranks are worked right to left. */
  right?: boolean;
  /** Brackets are looked at (the right way). */
  brackets?: boolean;
  /** Every step must come out as a whole number of at least 0 (only for the right way). */
  exact?: boolean;
}
const RIGHT: Way = { rank: 'normal', brackets: true, exact: true };

function evaluate(all: readonly Token[], way: Way): number {
  const tokens = way.brackets ? all : all.filter((t) => t !== '(' && t !== ')');
  let i = 0;
  const level = (op: string) => (way.rank === 'flat' ? 1 : (op === '×' || op === '÷') === (way.rank === 'normal') ? 2 : 1);
  const apply = (op: string, a: number, b: number) => {
    const v = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : b === 0 ? NaN : a / b;
    return way.exact && (!Number.isInteger(v) || v < 0) ? NaN : v;
  };
  const atom = (): number => {
    const t = tokens[i++];
    if (t === '(') {
      const v = expr(1);
      i++; // the closing bracket
      return v;
    }
    return typeof t === 'number' ? t : NaN;
  };
  const expr = (min: number): number => {
    let left = atom();
    while (i < tokens.length) {
      const op = tokens[i];
      if (!isOp(op) || level(op) < min) break;
      i++;
      const right = expr(way.right ? level(op) : level(op) + 1);
      left = apply(op, left, right);
    }
    return left;
  };
  const value = expr(1);
  return i === tokens.length ? value : NaN;
}

/** The tokens with the first number (or bracket group) and the sign after it taken off. */
function withoutFirst(tokens: Token[]): Token[] {
  let i = 0;
  if (tokens[0] === '(') i = tokens.indexOf(')') + 1;
  else i = 1;
  return tokens.slice(i + 1);
}
/** The tokens with the last number (or bracket group) and the sign before it taken off. */
function withoutLast(tokens: Token[]): Token[] {
  let end = tokens.length;
  if (tokens[end - 1] === ')') end = tokens.lastIndexOf('(');
  else end -= 1;
  return tokens.slice(0, end - 1);
}

/** The named mistakes, as the number each one gives for this expression. */
function mistakesFor(tokens: Token[]): Named {
  const left: Way = { rank: 'flat', brackets: true };
  const noBrackets: Way = { rank: 'normal' };
  const sum = tokens.filter((t): t is number => typeof t === 'number').reduce((a, b) => a + b, 0);
  const hasBrackets = tokens.includes('(');
  const named: Named = {
    'worked left to right': evaluate(tokens, left),
    'did adding and taking away first': evaluate(tokens, { rank: 'reversed', brackets: true }),
    'worked right to left': evaluate(tokens, { rank: 'flat', right: true, brackets: true }),
    'worked equal steps right to left': evaluate(tokens, { rank: 'normal', right: true, brackets: true }),
    'added every number': sum,
    'left out the first number': evaluate(withoutFirst(tokens), { rank: 'normal', brackets: true }),
    'left out the last number': evaluate(withoutLast(tokens), { rank: 'normal', brackets: true }),
  };
  if (hasBrackets) {
    named['ignored the brackets'] = evaluate(tokens, noBrackets);
    named['ignored the brackets and worked left to right'] = evaluate(tokens, { rank: 'flat' });
  }
  return named;
}

// ---------------------------------------------------------------- the questions

const MAX_NUMBER = 30;
const MAX_ANSWER = 300;

function build(templateIndex: number, nums: readonly number[]) {
  const template = TEMPLATES[templateIndex];
  if (!template || nums.length !== lettersOf(template.src) || !nums.every((n) => isInt(n, 2, MAX_NUMBER))) return null;
  const tokens = tokensOf(template.src, nums);
  const answer = evaluate(tokens, RIGHT);
  if (!Number.isInteger(answer) || answer < 1 || answer > MAX_ANSWER) return null;
  return { tokens, answer };
}

function bedmasFamily(key: string, label: string): Family {
  const mine = TEMPLATES.map((t, i) => ({ ...t, i })).filter((t) => t.key === key);
  return oneKey(
    key,
    label,
    ['MS.Y6.NUM.OP.P1'],
    null,
    (_k, r) => {
      for (;;) {
        const t = pickOne(r, mine);
        const nums = Array.from({ length: lettersOf(t.src) }, (_, n) => int(r, 2, n === 0 && /^a [+−]/.test(t.src) ? 30 : 12));
        const made = build(t.i, nums);
        if (made && withMistakes({ parts: [], spoken: '', answer: made.answer }, mistakesFor(made.tokens))) return [t.i, ...nums];
      }
    },
    (k, [index, ...nums]) => {
      if (TEMPLATES[index]?.key !== k) return null;
      const made = build(index, nums);
      if (!made) return null;
      const parts = partsOf(made.tokens);
      return withMistakes(
        { parts, spoken: `What is ${words(made.tokens)}?`, answer: made.answer, choose: true, fact: `${parts.slice(0, -2).join(' ')} = ${made.answer}` },
        mistakesFor(made.tokens),
      );
    },
  );
}

const LABELS: Record<string, string> = {
  'bedmas:mul-first': 'Times before adding or taking away (2 + 3 × 4)',
  'bedmas:div-first': 'Dividing before adding or taking away (12 − 8 ÷ 4)',
  'bedmas:left-to-right': 'Same-rank steps from left to right (12 − 4 + 2)',
  'bedmas:brackets-first': 'Brackets first, then times ((2 + 3) × 4)',
  'bedmas:brackets-div': 'Brackets first, then divide ((10 − 4) ÷ 3)',
  'bedmas:mixed': 'Three steps without brackets (2 + 3 × 4 − 5)',
  'bedmas:mixed-brackets': 'Three steps with brackets ((2 + 3) × 4 − 5)',
};

export const BEDMAS_FAMILIES: Record<string, Family> = Object.fromEntries(BEDMAS_KEYS.map((k) => [k, bedmasFamily(k, LABELS[k])]));

/** The expression of a template as a pattern for reading it back: '(a + b) × c' → /^\((\d+) \+ (\d+)\) × (\d+)$/. */
const PATTERNS = TEMPLATES.map((t) => new RegExp('^' + t.src.replace(/[()+×÷]/g, '\\$&').replace(/[a-d]/g, '(\\d{1,2})') + '$'));

/** Reads '2 + 3 × 4 = ?' (as shown) back into its type and numbers. */
export const parseBedmas: Parser = (parts) => {
  if (parts.length < 4 || parts[parts.length - 2] !== '=' || parts[parts.length - 1] !== '?') return null;
  const text = parts.slice(0, -2).join(' ');
  for (let i = 0; i < TEMPLATES.length; i++) {
    const m = PATTERNS[i].exec(text);
    if (!m) continue;
    const nums = m.slice(1).map(Number);
    const made = BEDMAS_FAMILIES[TEMPLATES[i].key].make(TEMPLATES[i].key, [i, ...nums]);
    if (made && sameParts(made.parts, parts)) return { key: TEMPLATES[i].key, params: [i, ...nums] };
  }
  return null;
};

export const BEDMAS_TEMPLATE_COUNT = TEMPLATES.length;
