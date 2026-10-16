/**
 * The times-tables skill pack: multiplication (7 × 8 = ?), missing factor (? × 8 = 56)
 * and division (56 ÷ 8 = ?). All three count towards the same fact's mastery, because
 * they're the same fact.
 */
import { CHOICES, DIVISION_SHARE, MISSING_FACTOR_FROM_LEVEL, MISSING_FACTOR_SHARE } from '../config';
import { parseFactKey } from '../facts';
import { afterAnswer, newStats, type FactStats } from '../leitner';
import { newMemory, pickFact, scheduleRepeat, type QuestionContext, type SessionMemory } from '../selector';
import type { AnswerResult, Question, SkillPack } from '../skillPack';

export type TimesTablesKind = 'multiply' | 'missing-factor' | 'divide';

/**
 * Each kind of question, with its NZ Curriculum codes. PLACEHOLDERS: James fills these in
 * from his curriculum alignment tool.
 */
export const TIMES_TABLES_KINDS: Record<TimesTablesKind, { label: string; curriculumTags: string[] }> = {
  multiply: { label: 'Multiplication facts', curriculumTags: ['TODO-multiplication-facts'] },
  'missing-factor': { label: 'Missing factor', curriculumTags: ['TODO-missing-factor'] },
  divide: { label: 'Division facts', curriculumTags: ['TODO-division-facts'] },
};

const SPOKEN: Record<string, string> = { '×': 'times', '÷': 'divided by', '=': 'equals', '?': 'what' };

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Wrong answers that look believable: near misses from the same or next-door facts. */
export function choicesFor(x: number, y: number, answer: number, isFactor: boolean, random: () => number): number[] {
  const near = isFactor
    ? [answer - 1, answer + 1, answer - 2, answer + 2, answer + 3].filter((n) => n >= 1 && n <= 12)
    : [(x + 1) * y, (x - 1) * y, x * (y + 1), x * (y - 1), answer + 1, answer - 1, answer + 10, answer - 10, x + y];
  const ok = (n: number) => n > 0 && n !== answer && (!isFactor || n <= 12);
  const wrong = shuffle([...new Set(near)].filter(ok), random).slice(0, CHOICES - 1);
  // Near the edges (answers like 1 or 12) there aren't enough near misses: take the next closest.
  for (let gap = 1; wrong.length < CHOICES - 1; gap++) {
    for (const n of [answer + gap, answer - gap]) if (ok(n) && !wrong.includes(n) && wrong.length < CHOICES - 1) wrong.push(n);
  }
  return shuffle([answer, ...wrong], random);
}

export class TimesTables implements SkillPack {
  readonly id = 'times-tables';
  readonly label = 'Times tables';
  readonly curriculumTags = Object.values(TIMES_TABLES_KINDS).flatMap((k) => k.curriculumTags);
  private records = new Map<string, FactStats>();
  private memory: SessionMemory = newMemory();
  private nextId = 1;

  constructor(
    saved: FactStats[] = [],
    private random: () => number = Math.random,
    private now: () => number = Date.now,
  ) {
    for (const s of saved) this.records.set(s.key, s);
  }

  stats(): FactStats[] {
    return [...this.records.values()];
  }

  statsFor(key: string): FactStats | undefined {
    return this.records.get(key);
  }

  nextQuestion(ctx: QuestionContext): Question | null {
    const picked = pickFact(ctx, this.records, this.memory, this.random);
    if (!picked) return null;
    const fact = parseFactKey(picked.key)!;
    // Both orders of the fact get asked.
    const [x, y] = this.random() < 0.5 ? [fact.a, fact.b] : [fact.b, fact.a];
    const product = x * y;
    const missingOn = ctx.missingFactor ?? (ctx.level ?? 1) >= MISSING_FACTOR_FROM_LEVEL;
    const roll = this.random();
    const kind: TimesTablesKind =
      ctx.division && roll < DIVISION_SHARE
        ? 'divide'
        : missingOn && roll >= 1 - MISSING_FACTOR_SHARE
          ? 'missing-factor'
          : 'multiply';

    let parts: string[];
    let answer: number;
    if (kind === 'divide') {
      parts = [String(product), '÷', String(y), '=', '?'];
      answer = x;
    } else if (kind === 'missing-factor') {
      const blankFirst = this.random() < 0.5;
      parts = blankFirst ? ['?', '×', String(y), '=', String(product)] : [String(x), '×', '?', '=', String(product)];
      answer = blankFirst ? x : y;
    } else {
      parts = [String(x), '×', String(y), '=', '?'];
      answer = product;
    }
    return {
      id: this.nextId++,
      skill: this.id,
      factKey: picked.key,
      kind,
      parts,
      spoken: parts.map((p) => SPOKEN[p] ?? p).join(' ') + '?',
      answer,
      choices: ctx.multipleChoice ? choicesFor(x, y, answer, kind !== 'multiply', this.random) : undefined,
      band: picked.band,
    };
  }

  recordAnswer(q: Question, answer: number, ms: number): AnswerResult {
    const correct = answer === q.answer;
    const before = this.records.get(q.factKey) ?? newStats(q.factKey);
    const after = afterAnswer(before, correct, ms, this.now());
    this.records.set(q.factKey, after);
    if (!correct) scheduleRepeat(this.memory, q.factKey, this.random);
    // The question with its blank filled in: "7 × 8 = 56", "? × 8 = 56" → "7 × 8 = 56", "56 ÷ 8 = 7".
    const fact = q.parts.map((p) => (p === '?' ? String(q.answer) : p)).join(' ');
    return { correct, fact, boxBefore: before.box, boxAfter: after.box };
  }
}
