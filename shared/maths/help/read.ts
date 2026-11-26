/** Small readers for what a question shows, shared by the helpers. */
import type { HelpQuestion } from './types';

/** A plain number as shown: "7", "4.5", "−3", "12 500", "$6.40". Null for anything else. */
export function num(text: string | undefined): number | null {
  if (text === undefined) return null;
  const t = text.replace(/−/g, '-').replace(/[\s,$]/g, '').replace(/^\((.*)\)$/, '$1');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** Shows a number the way the questions do: 12 500 with a space for 5 or more digits, a real minus sign. The space does
 *  not break, so "586 000" can never wrap into two numbers. */
export function show(n: number): string {
  const rounded = Math.round(n * 1e6) / 1e6;
  const sign = rounded < 0 ? '−' : '';
  const [whole, dec] = String(Math.abs(rounded)).split('.');
  const spaced = whole.length >= 5 ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0') : whole;
  return sign + spaced + (dec ? `.${dec}` : '');
}

export type Op = '+' | '−' | '×' | '÷';

/**
 * A one-step sum on screen: "a op b = c" with exactly one of a, b, c as "?" ("7 × 8 = ?", "? + 75 = 100", "1 + ? = 11"),
 * or "c = a op b". Null for anything else.
 */
export interface Sum {
  a: number | null;
  op: Op;
  b: number | null;
  c: number | null;
}

const OPS: Record<string, Op> = { '+': '+', '−': '−', '-': '−', '×': '×', x: '×', '÷': '÷' };

export function sum(q: HelpQuestion): Sum | null {
  const p = q.parts;
  const val = (t: string) => (t === '?' ? null : num(t));
  const ok = (t: string) => t === '?' || num(t) !== null;
  let a: string, op: string, b: string, c: string;
  if (p.length === 5 && p[3] === '=') [a, op, b, , c] = p;
  else if (p.length === 5 && p[1] === '=') [c, , a, op, b] = p;
  else return null;
  if (!OPS[op] || ![a, b, c].every(ok) || [a, b, c].filter((t) => t === '?').length !== 1) return null;
  return { a: val(a), op: OPS[op], b: val(b), c: val(c) };
}

/** The missing number of a sum, worked out (for helpers choosing a method; never shown). */
export function solve(s: Sum): number {
  const { a, b, c, op } = s;
  if (c === null) return op === '+' ? a! + b! : op === '−' ? a! - b! : op === '×' ? a! * b! : a! / b!;
  if (a === null) return op === '+' ? c - b! : op === '−' ? c + b! : op === '×' ? c / b! : c * b!;
  return op === '+' ? c - a : op === '−' ? a - c : op === '×' ? c / a : a / c;
}

/** All the text a question shows, for matching words. */
export function words(q: HelpQuestion): string {
  return [q.prompt ?? '', ...q.parts].join(' ');
}
