/**
 * Help me cards for algebra (docs/plans/help-me/PLAN.md): putting a number in a letter, one- and two-step equations
 * (and inequalities solved like an equals), collecting like terms, pattern rules and terms, and which sign makes a
 * comparison true. Every card teaches the method with the question's own numbers and leaves the last bit to the pupil.
 */
import { num, show } from './read';
import type { HelpCard, Helper } from './types';

const card = (kind: string, title: string, ...steps: string[]): HelpCard => ({ kind, title, steps });

/** "5n + 7", "6n − 4", "x", "3x", "n + 2": a letter with an optional number in front and an optional + or − number. */
interface Lin {
  coef: number;
  letter: string;
  op: '+' | '−' | null;
  k: number;
}
export function parseLin(text: string): Lin | null {
  const m = /^(\d*)([a-z])(?: ([+−-]) (\d+(?:\.\d+)?))?$/.exec(text.trim());
  if (!m) return null;
  return { coef: m[1] === '' ? 1 : Number(m[1]), letter: m[2], op: m[3] ? (m[3] === '+' ? '+' : '−') : null, k: m[4] ? Number(m[4]) : 0 };
}

/** Swap the letter for its number in a linear expression. */
function substituteSteps(e: Lin, n: number): string[] {
  const steps: string[] = [];
  const timesPart = e.coef === 1 ? `${show(n)}` : `${e.coef} × ${show(n)}`;
  if (e.coef !== 1) steps.push(`${e.coef}${e.letter} means ${e.coef} × ${e.letter}.`);
  steps.push(`Swap ${e.letter} for ${show(n)}: ${timesPart}${e.op ? ` ${e.op} ${show(e.k)}` : ''}.`);
  if (e.coef !== 1) {
    const prod = e.coef * n;
    if (e.op) steps.push(`Times first: ${e.coef} × ${show(n)} = ${show(prod)}.`, `Then ${e.op} ${show(e.k)}: ${show(prod)} ${e.op} ${show(e.k)} = ?`);
    else steps.push(`${e.coef} × ${show(n)} = ?`);
  } else if (e.op) steps.push(`${show(n)} ${e.op} ${show(e.k)} = ?`);
  else steps.push(`What is ${show(n)}? ?`);
  return steps;
}

// ---------------------------------------------------------------- substituting

const substitute: Helper = (q) => {
  const { parts, prompt = '' } = q;
  if (parts.length !== 3 || parts[1] !== '=' || parts[2] !== '?') return null;
  // "When m = 11" with m²
  const when = /^When ([a-z]) = (-?[\d.]+|−[\d.]+)$/.exec(prompt);
  if (when) {
    const n = num(when[2]);
    if (n === null) return null;
    const sq = /^([a-z])²$/.exec(parts[0]);
    if (sq && sq[1] === when[1]) {
      return card('substitute', 'Swap the letter for its number',
        `${sq[1]}² means ${sq[1]} × ${sq[1]}.`, `Swap ${sq[1]} for ${show(n)}: ${show(n)} × ${show(n)} = ?`);
    }
    const e = parseLin(parts[0]);
    if (e && e.letter === when[1]) return card('substitute', 'Swap the letter for its number', ...substituteSteps(e, n));
    return null;
  }
  // "A = lw, when l = 9 and w = 4"
  const two = /^([A-Za-z]) = ([a-z])([a-z]), when \2 = ([\d.]+) and \3 = ([\d.]+)$/.exec(prompt);
  if (two && parts[0] === two[1]) {
    return card('substitute', 'Swap the letters for their numbers',
      `${two[2]}${two[3]} means ${two[2]} × ${two[3]}.`, `Swap in the numbers: ${two[4]} × ${two[5]} = ?`);
  }
  return null;
};

// ---------------------------------------------------------------- equations

/** "If 2n + 6 = 22", "If s − 7 = 5", "If x ÷ 8 = 4", "If x + 4 ≥ −1" (variable and sign on screen as parts). */
const equation: Helper = (q) => {
  const { parts, prompt = '' } = q;
  if (parts.length !== 3 || parts[2] !== '?' || !/^[a-z]$/.test(parts[0])) return null;
  const sign = parts[1];
  if (!['=', '<', '>', '≤', '≥'].includes(sign)) return null;
  const m = /^If (.+?) (=|<|>|≤|≥) (-?[\d.−]+)$/.exec(prompt);
  if (!m || m[2] !== sign) return null;
  const r = num(m[3]);
  if (r === null) return null;
  const v = parts[0];
  const left = m[1];
  const same = sign === '=' ? [] : ['The sign stays the same.'];
  const eqn = sign === '=' ? '' : ' (like an =)';
  const title = sign === '=' ? 'Undo it, last step first' : 'Solve it like an equals';

  let x: RegExpExecArray | null;
  // v ÷ k
  if ((x = new RegExp(`^${v} ÷ (\\d+)$`).exec(left))) {
    const k = Number(x[1]);
    return card('equation', title, `${v} ÷ ${k} is undone by × ${k}.`, `${show(r)} × ${k} = ?`);
  }
  // v + k, v − k
  if ((x = new RegExp(`^${v} ([+−]) (\\d+(?:\\.\\d+)?)$`).exec(left))) {
    const op = x[1] as '+' | '−', k = Number(x[2]);
    const back = op === '+' ? '−' : '+';
    return card('equation', title,
      `Undo the ${op} ${show(k)}${eqn}: ${back} ${show(k)} on both sides.`, ...same, `${show(r)} ${back} ${show(k)} = ?`);
  }
  // k v
  if ((x = new RegExp(`^(\\d+)${v}$`).exec(left))) {
    const k = Number(x[1]);
    return card('equation', title, `${k}${v} means ${k} × ${v}.`, `Undo the × ${k}: divide both sides by ${k}.`, `${show(r)} ÷ ${k} = ?`);
  }
  // k v ± c
  if ((x = new RegExp(`^(\\d+)${v} ([+−]) (\\d+)$`).exec(left))) {
    const k = Number(x[1]), op = x[2] as '+' | '−', c = Number(x[3]);
    const back = op === '+' ? '−' : '+';
    const mid = op === '+' ? r - c : r + c;
    return card('equation', title,
      `Undo the ${op} ${c} first: ${back} ${c} on both sides.`, `${show(r)} ${back} ${c} = ${show(mid)}, so ${k}${v} = ${show(mid)}.`,
      `Then undo the × ${k}: divide by ${k}.`, `${show(mid)} ÷ ${k} = ?`);
  }
  return null;
};

// ---------------------------------------------------------------- like terms

function terms(text: string): { sign: 1 | -1; coef: number; letter: string; lone: boolean }[] | null {
  const out: { sign: 1 | -1; coef: number; letter: string; lone: boolean }[] = [];
  const bits = text.split(/ ([+−]) /);
  for (let i = 0; i < bits.length; i += 2) {
    const m = /^(\d*)([a-z])$/.exec(bits[i]);
    if (!m) return null;
    out.push({ sign: i > 0 && bits[i - 1] === '−' ? -1 : 1, coef: m[1] === '' ? 1 : Number(m[1]), letter: m[2], lone: m[1] === '' });
  }
  return out.length >= 2 && out.every((t) => t.letter === out[0].letter) ? out : null;
}

const likeTerms: Helper = (q) => {
  const { parts } = q;
  if (parts.length !== 3 || parts[1] !== '=' || !/^\?[a-z]$/.test(parts[2])) return null;
  const ts = terms(parts[0]);
  if (!ts) return null;
  const l = ts[0].letter;
  const sum = ts.map((t, i) => (i === 0 ? '' : t.sign === 1 ? ' + ' : ' − ') + t.coef).join('');
  const steps = [`They are all ${l}'s, so count the ${l}'s.`];
  if (ts.some((t) => t.lone)) steps.push(`A lone ${l} is 1${l}.`);
  steps.push(`${sum} = ?`);
  return card('like-terms', `Count the ${l}'s`, ...steps);
};

// ---------------------------------------------------------------- patterns

const patternTerm: Helper = (q) => {
  const { parts, prompt = '' } = q;
  if (parts.length !== 3 || parts[1] !== '=' || parts[2] !== '?') return null;
  const t = /^(\d+)(?:st|nd|rd|th) term$/.exec(parts[0]);
  const r = /^Rule: t = (.+)$/.exec(prompt);
  if (!t || !r) return null;
  const e = parseLin(r[1]);
  if (!e) return null;
  const n = Number(t[1]);
  return card('pattern-rule', 'Put the term number in for n',
    `The ${parts[0].replace(' term', '')} term means ${e.letter} = ${n}.`, ...substituteSteps(e, n).slice(e.coef !== 1 ? 1 : 0));
};

const patternRule: Helper = (q) => {
  const m = /^Which rule makes ([\d−\-., ]+)\?$/.exec(q.prompt ?? '');
  if (!m) return null;
  const seq = m[1].split(',').map((s) => num(s.trim()));
  if (seq.length < 3 || seq.some((v) => v === null)) return null;
  const v = seq as number[];
  const jump = v[1] - v[0];
  if (v.some((x, i) => i > 0 && x - v[i - 1] !== jump)) return null;
  return card('pattern-rule', 'The jump is the number in front of n',
    `Find the jump: ${show(v[1])} − ${show(v[0])} = ${show(jump)}.`,
    `The jump is the number in front of n, so the rule starts ${show(jump)}n.`,
    `Put n = 1 in each rule that has ${show(jump)}n. Which one gives ${show(v[0])}?`);
};

const patternNext: Helper = (q) => {
  if (!/^What comes next\?$/.test(q.prompt ?? '')) return null;
  const items = q.parts.map((p) => p.replace(/,$/, '').trim());
  if (items.length < 4 || items[items.length - 1] !== '?') return null;
  const v = items.slice(0, -1).map(num);
  if (v.some((x) => x === null)) return null;
  const n = v as number[];
  const jump = n[1] - n[0];
  if (jump === 0 || n.some((x, i) => i > 0 && x - n[i - 1] !== jump)) return null;
  // The pupil finds the jump: its size is never in the title or the steps.
  const up = jump > 0, last = n[n.length - 1];
  return card('pattern-next', 'Find the jump',
    `How far ${up ? 'up' : 'down'} is it from ${show(n[0])} to ${show(n[1])}?`,
    `Check ${show(n[1])} to ${show(n[2])}: is it the same jump?`,
    `${show(last)} ${up ? '+' : '−'} that jump = ?`);
};

// ---------------------------------------------------------------- true or false signs

function side(text: string): number | null {
  const single = num(text);
  if (single !== null) return single;
  const m = /^(-?[\d.−]+) ([+−×÷]) (-?[\d.−]+)$/.exec(text.trim());
  if (!m) return null;
  const a = num(m[1]), b = num(m[3]);
  if (a === null || b === null) return null;
  const v = m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : b === 0 ? NaN : a / b;
  return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null;
}

const trueFalse: Helper = (q) => {
  const { parts } = q;
  if (parts.length !== 3 || parts[1] !== '?') return null;
  const l = side(parts[0]), r = side(parts[2]);
  if (l === null || r === null) return null;
  const steps: string[] = [];
  const hasSum = (t: string) => num(t) === null;
  // The pupil works each side out ("0.3 × 4" is 3 tenths × 4); only the compare is left as the last step.
  const work = (t: string, name: string) => {
    const d = /^(\d+\.\d) × (\d+)$/.exec(t) ?? /^(\d+) × (\d+\.\d)$/.exec(t);
    const dec = d ? (d[1].includes('.') ? d[1] : d[2]) : null;
    const other = d ? (d[1].includes('.') ? d[2] : d[1]) : null;
    if (dec && other && dec.startsWith('0.')) return `${name}: ${t} means ${other} lots of ${dec.slice(2)} tenths. Work out ${dec.slice(2)} × ${other}, then write that many tenths as a decimal.`;
    return `${name}: work out ${t}.`;
  };
  if (hasSum(parts[0])) steps.push(work(parts[0], 'Left side'));
  if (hasSum(parts[2])) steps.push(work(parts[2], 'Right side'));
  steps.push(hasSum(parts[0]) && hasSum(parts[2]) ? 'Which side is bigger, or are they the same? Pick the sign that fits: ?' : `Compare your answer with the number on the other side. Which sign fits? ?`);
  return card('true-false', 'Work out each side, then compare', ...steps);
};

// ----------------------------------------------------------------

export const ALGEBRA_HELPERS: Helper[] = [substitute, equation, likeTerms, patternTerm, patternRule, patternNext, trueFalse];
