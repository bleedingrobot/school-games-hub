/**
 * The screen's own reading of a bag (docs/ORDERUP-PLAN.md, "Help for kids who need it"): which rule a step uses, the
 * "Let's look together" walk down the order card, the arithmetic help, and the worked example for each level. Nothing here
 * decides what counts: the server replays every bag with shared/orderup/play.ts.
 */
import { applyStep, format, isNum, nextStep, parse, ruleOf, stepValue, walk, type Node, type Rule } from '../../../shared/orderup/expr';

/** Is the node with this id inside brackets? */
export function inBrackets(root: Node, id: number): boolean {
  const find = (n: Node, inside: boolean): boolean | null => {
    if (n.id === id) return inside;
    const kids = n.kind === 'bin' ? [n.left, n.right] : n.kind === 'pow' ? [n.base] : n.kind === 'group' ? [n.inner] : [];
    for (const k of kids) {
      const r = find(k, inside || n.kind === 'group');
      if (r !== null) return r;
    }
    return null;
  };
  return find(root, false) ?? false;
}

/** The rule a step goes by: brackets for any step inside them, else its own sign's. */
export const stepRule = (root: Node, step: Node): Rule => (inBrackets(root, step.id) ? 'brackets' : ruleOf(step));

/** The number ids that make up a ready step. */
export function stepNumbers(step: Node): number[] {
  if (step.kind === 'pow' && isNum(step.base)) return [step.base.id];
  if (step.kind === 'bin') return [step.left.id, step.right.id];
  return [];
}

/** "Let's look together": the order card's questions, down to the rule that answers. */
export function lookLines(root: Node): string[] {
  const next = nextStep(root);
  if (!next) return [];
  const rule = stepRule(root, next);
  const lines: string[] = [];
  if (rule === 'brackets') return ['Any brackets? Yes. Work inside them first.'];
  lines.push('Any brackets? No.');
  if (rule === 'exponents') return [...lines, 'Any powers? Yes, here.'];
  if (walk(root).some((n) => n.kind === 'pow')) lines.push('Any powers? Not ready yet.');
  else lines.push('Any powers? No.');
  if (rule === 'times-divide') return [...lines, 'Any × or ÷? Yes. The first one, left to right.'];
  return [...lines, 'Any × or ÷? No.', 'Then + and −, left to right: the first one.'];
}

/** After a second wrong answer: the step worked out, to type in. */
export function workedStep(step: Node): string {
  const text = format(step);
  const v = stepValue(step);
  if (step.kind === 'pow' && isNum(step.base)) return `${text} = ${Array(step.exp).fill(step.base.value).join(' × ')} = ${v}`;
  if (step.kind === 'bin' && isNum(step.left) && isNum(step.right)) {
    const [a, b] = [step.left.value, step.right.value];
    if (step.op === '×' && a <= 6) return `${text} = ${Array(a).fill(b).join(' + ')} = ${v}`;
    if (step.op === '÷') return `${text} = ${v}, because ${v} × ${b} = ${a}`;
  }
  return `${text} = ${v}`;
}

/** Groups of dots for a small times step after it was added (3 × 5: three groups of five). Null when too big to draw. */
export function dotGroups(step: Node): { groups: number; each: number } | null {
  if (step.kind !== 'bin' || step.op !== '×' || !isNum(step.left) || !isNum(step.right)) return null;
  const [groups, each] = [step.left.value, step.right.value];
  return groups <= 6 && each <= 10 ? { groups, each } : null;
}

const RULE_SENTENCE: Record<Rule, string> = {
  brackets: 'Brackets first.',
  exponents: 'Powers come next.',
  'times-divide': 'Multiply and divide before add and subtract, left to right.',
  'add-subtract': 'Add and subtract last, left to right.',
};

/** The worked example a level opens with the first time (the doc's). */
export const EXAMPLES: Record<number, string> = {
  1: '20 − 6 + 3',
  2: '4 + 3 × 5',
  3: '2 × (4 + 1)',
  4: '2 + 3² × 2',
  5: '(8 − 2) ÷ 3 + 2²',
};

export interface ExampleLine {
  /** The expression before this line's step. */
  before: string;
  /** The step done ("3 × 5 = 15"), or null on the last line (the answer). */
  step: string | null;
  rule: Rule | null;
  /** One short sentence on the rule. */
  why: string;
}

/** The example worked line by line. */
export function exampleLines(text: string): ExampleLine[] {
  let root = parse(text);
  const out: ExampleLine[] = [];
  for (let s = nextStep(root); s; s = nextStep(root)) {
    const rule = stepRule(root, s);
    out.push({ before: format(root), step: `${format(s)} = ${stepValue(s)}`, rule, why: RULE_SENTENCE[rule] });
    root = applyStep(root, s.id);
  }
  out.push({ before: format(root), step: null, rule: null, why: 'Order up! That’s the answer.' });
  return out;
}
