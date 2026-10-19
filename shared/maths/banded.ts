/**
 * The common engine behind every skill pack except times tables. A pack is a list of
 * question families, grouped into difficulty bands (band 1 easiest). `QuestionContext.level`
 * is the band: its families are the focus, easier bands are review, and the next band up is
 * stretch, with the same 60/30/10 mix, mastery boxes and repeats as times tables
 * (`pickFromPools`).
 *
 * A family owns one or more mastery keys. Fact-style families (adding facts, division facts)
 * have one key per fact ("add:7+8"); the rest have a single key for the kind of question
 * ("add:2d+2d:carry"), because "47 + 36" and "58 + 25" are the same skill.
 *
 * Every question is made from a short list of numbers (`params`) by a pure function, so the
 * server can make the question again from its key and numbers to check an answer, without
 * trusting the browser's copy of the question.
 */
import { CHOICES } from './config';
import { afterAnswer, newStats, type FactAnswer, type FactStats } from './leitner';
import { newMemory, pickFromPools, scheduleRepeat, type Pools, type QuestionContext, type SessionMemory } from './selector';
import type { AnswerResult, Question, SkillPack } from './skillPack';

/** A question, as a family makes it from its numbers. */
export interface Made {
  parts: string[];
  spoken: string;
  answer: number;
  /** Believable wrong answers for multiple choice (extra or unsuitable ones are dropped). */
  wrong?: number[];
  /** The named common mistakes behind `wrong`, for generated skills (so tests can check no wrong choice is random). */
  named?: Record<string, number>;
  /** For a pick-one question: the named mistake behind each wrong choice's label (so tests can check none is random). */
  namedLabels?: Record<string, string>;
  /** Always show choices to tap (order of operations), not only when the class has multiple choice on. Needs `wrong`. */
  choose?: boolean;
  /** A pick-only question: what each choice shows. The answer is the index of the right one. */
  pick?: string[];
  input?: 'whole' | 'decimal';
  /** What to do, shown above the sum: "Write it as a decimal." See `Question.prompt`. */
  prompt?: string;
  /** The right answer in words, when filling in the blank doesn't say it ("3/4 is bigger than 2/3"). */
  fact?: string;
}

export interface Family {
  /** Shown to teachers, e.g. "Adding 2-digit numbers, with regrouping". */
  label: string;
  /** NZ Curriculum codes. PLACEHOLDERS until James fills them in from his alignment tool. */
  curriculumTags: string[];
  /** The mastery keys this family owns. */
  keys: string[];
  /** Random numbers for one question about this key. */
  roll(key: string, random: () => number): number[];
  /** The question these numbers make. Null if they aren't numbers `roll` could have given. */
  make(key: string, params: readonly number[]): Made | null;
}

export interface PackDefinition {
  id: string;
  label: string;
  /** Families by name. */
  families: Record<string, Family>;
  /** Family names in each band, easiest band first. */
  bands: string[][];
  /**
   * Families the pack owns (so answers can be checked and records kept) but that sit outside
   * every band, so a game that asks by band never serves them. Only the auto ladder asks for them.
   */
  ladderOnly?: string[];
  /** Answering right within this many milliseconds counts as quick (default `QUICK_MS`). */
  quickMs?: number;
}

// ---------------------------------------------------------------- helpers for families

/** A whole number from lo to hi (both included). */
export const int = (random: () => number, lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));

export const pickOne = <T>(random: () => number, items: readonly T[]): T => items[Math.floor(random() * items.length)];

export function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Rounds away floating-point dust: 0.1 + 0.2 → 0.3. */
export const tidy = (n: number) => Math.round(n * 1000) / 1000;

/** Whole numbers within [lo, hi]. */
export const isInt = (n: number | undefined, lo: number, hi: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;

/** How a number is written on screen: 3406 → "3406", 12500 → "12 500" (NZ style for 5+ digits), 0.5 → "0.5". */
export function show(n: number): string {
  const [whole, frac] = String(tidy(Math.abs(n))).split('.');
  const grouped = whole.length >= 5 ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : whole;
  return (n < 0 ? '−' : '') + grouped + (frac ? '.' + frac : '');
}

/** Money in dollars, from cents: 240 → "$2.40". */
export const dollars = (cents: number) => `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

const SPOKEN_WORDS: Record<string, string> = {
  '+': 'plus',
  '−': 'minus',
  '×': 'times',
  '÷': 'divided by',
  '=': 'equals',
  '?': 'what',
  r: 'remainder',
  '%': 'percent',
};
const ORDINAL: Record<number, [string, string]> = {
  2: ['half', 'halves'],
  3: ['third', 'thirds'],
  4: ['quarter', 'quarters'],
  5: ['fifth', 'fifths'],
  6: ['sixth', 'sixths'],
  7: ['seventh', 'sevenths'],
  8: ['eighth', 'eighths'],
  9: ['ninth', 'ninths'],
  10: ['tenth', 'tenths'],
  12: ['twelfth', 'twelfths'],
  100: ['hundredth', 'hundredths'],
};

/** A fraction part in words: "3/4" → "3 quarters", "?/8" → "what eighths", "2 1/3" → "2 and 1 third". */
export function spokenFraction(part: string): string {
  const mixed = /^(\d+|\?) (\d+|\?)\/(\d+)$/.exec(part);
  if (mixed) return `${mixed[1] === '?' ? 'what' : mixed[1]} and ${spokenFraction(`${mixed[2]}/${mixed[3]}`)}`;
  const m = /^(\d+|\?)\/(\d+|\?)$/.exec(part);
  if (!m) return part;
  const [, top, bottom] = m;
  if (bottom === '?') return `${top} over what`;
  const names = ORDINAL[Number(bottom)];
  if (!names) return `${top === '?' ? 'what' : top} over ${bottom}`;
  if (top === '?') return `what ${names[1]}`;
  return `${top} ${top === '1' ? names[0] : names[1]}`;
}

/**
 * One part or choice in words for a screen reader: "3/4" is "3 quarters", "25%" is "25 percent", "0.25" is "0 point 2 5".
 * Anything else is read as it is.
 */
export function spokenLabel(part: string): string {
  const percent = /^(\d+(?:\.\d+)?)%$/.exec(part);
  if (percent) return `${spokenLabel(percent[1])} percent`;
  if (/^\d+\.\d+$/.test(part)) {
    const [whole, frac] = part.split('.');
    return `${whole} point ${frac.split('').join(' ')}`;
  }
  return part.includes('/') ? spokenFraction(part) : part;
}

/** The spoken version of a question's parts, for screen readers. */
export function speak(parts: string[]): string {
  const words = parts.map((p) => SPOKEN_WORDS[p] ?? (/^\d+(?:\.\d+)?%$/.test(p) ? spokenLabel(p) : p.includes('/') ? spokenFraction(p) : p.replace(/^\$/, '$')));
  const text = words.join(' ').replace(/\s+/g, ' ').trim();
  return /[?.!:]$/.test(text) ? text : text + '?';
}

/** The parts with the blank filled in: "7 + 8 = ?" → "7 + 8 = 15", "1/2 = ?/8" → "1/2 = 4/8". */
export const fillBlank = (parts: string[], answer: number) =>
  parts
    .map((p) => (p.includes('?') ? p.replace('?', show(answer)) : p))
    .join(' ')
    .replace(/\$ /g, '$');

/** Same answer, allowing for floating-point dust (0.30000000000000004). */
export const sameAnswer = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Digits a typed answer needs, allowing one extra so the length doesn't give the answer away. */
const lengthFor = (answer: number) => String(tidy(answer)).length;

/** Four choices: the answer plus believable wrong ones, padded with near misses when short. */
export function choicesFor(answer: number, wrong: number[], decimal: boolean, random: () => number): number[] {
  // Whole-number questions only offer whole numbers (no 1.25 among 4, 5, 6, 7).
  const ok = (n: number) => Number.isFinite(n) && n >= 0 && !sameAnswer(n, answer) && (decimal || Number.isInteger(n));
  const picked: number[] = [];
  for (const n of shuffle(wrong.map(tidy), random)) {
    if (ok(n) && !picked.some((p) => sameAnswer(p, n)) && picked.length < CHOICES - 1) picked.push(n);
  }
  const steps = decimal && !Number.isInteger(answer) ? [0.1, 1, 0.01, 0.2] : [1, 10, 2, 100];
  for (let i = 1; picked.length < CHOICES - 1; i++) {
    for (const step of steps) {
      for (const n of [tidy(answer + step * i), tidy(answer - step * i)]) {
        if (ok(n) && !picked.some((p) => sameAnswer(p, n)) && picked.length < CHOICES - 1) picked.push(n);
      }
    }
  }
  return shuffle([answer, ...picked], random);
}

// ---------------------------------------------------------------- the pack

export class BandedPack implements SkillPack {
  readonly id: string;
  readonly label: string;
  readonly curriculumTags: string[];
  /** Number of difficulty bands (valid `level`s are 1 to this). */
  readonly bandCount: number;
  private familyOfKey = new Map<string, Family>();
  private bandOfKey = new Map<string, number>();
  private records = new Map<string, FactStats>();
  private memory: SessionMemory = newMemory();
  private listeners = new Set<(answer: FactAnswer) => void>();
  private nextId = 1;

  constructor(
    readonly definition: PackDefinition,
    saved: FactStats[] = [],
    private random: () => number = Math.random,
    private now: () => number = Date.now,
  ) {
    this.id = definition.id;
    this.label = definition.label;
    this.bandCount = definition.bands.length;
    const families = Object.values(definition.families);
    this.curriculumTags = [...new Set(families.flatMap((f) => f.curriculumTags))];
    definition.bands.forEach((names, i) => {
      for (const name of names) {
        const family = definition.families[name];
        if (!family) throw new Error(`${definition.id}: band ${i + 1} names unknown family "${name}"`);
        for (const key of family.keys) {
          if (this.familyOfKey.has(key)) throw new Error(`${definition.id}: key "${key}" is in two families or bands`);
          this.familyOfKey.set(key, family);
          this.bandOfKey.set(key, i + 1);
        }
      }
    });
    for (const name of definition.ladderOnly ?? []) {
      const family = definition.families[name];
      if (!family) throw new Error(`${definition.id}: ladderOnly names unknown family "${name}"`);
      for (const key of family.keys) {
        if (this.familyOfKey.has(key)) throw new Error(`${definition.id}: key "${key}" is in two families or bands`);
        this.familyOfKey.set(key, family);
      }
    }
    for (const s of saved) if (this.familyOfKey.has(s.key)) this.records.set(s.key, s);
  }

  /** Every mastery key in a band (1 = easiest). */
  keysInBand(band: number): string[] {
    return (this.definition.bands[band - 1] ?? []).flatMap((name) => this.definition.families[name].keys);
  }

  /** Which band a key belongs to, or undefined if this pack doesn't own it. */
  bandOf(key: string): number | undefined {
    return this.bandOfKey.get(key);
  }

  /** What a key is about, for the teacher: "Adding 2-digit numbers, with regrouping". */
  labelOf(key: string): string | undefined {
    return this.familyOfKey.get(key)?.label;
  }

  /** The focus, review and stretch keys for a band. */
  poolsFor(level: number): Pools {
    const band = Math.min(Math.max(Math.round(level), 1), this.bandCount);
    return {
      focus: this.keysInBand(band),
      review: Array.from({ length: band - 1 }, (_, i) => this.keysInBand(i + 1)).flat(),
      stretch: band < this.bandCount ? this.keysInBand(band + 1) : [],
    };
  }

  onAnswer(listener: (answer: FactAnswer) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  stats(): FactStats[] {
    return [...this.records.values()];
  }

  statsFor(key: string): FactStats | undefined {
    return this.records.get(key);
  }

  /**
   * Makes the question for a key and its numbers, exactly as `nextQuestion` would have.
   * Null if this pack doesn't own the key or the numbers aren't ones it could have rolled.
   * The server uses this to check answers.
   */
  rebuild(key: string, params: readonly number[], multipleChoice = false, random: () => number = this.random): Omit<Question, 'id' | 'band'> | null {
    const family = this.familyOfKey.get(key);
    if (!family || !params.every((p) => Number.isFinite(p))) return null;
    const made = family.make(key, params);
    if (!made) return null;
    const answer = tidy(made.answer);
    const decimal = made.input === 'decimal';
    let choices: number[] | undefined;
    let choiceLabels: string[] | undefined;
    if (made.pick) {
      choices = made.pick.map((_, i) => i);
      choiceLabels = made.pick;
    } else if (multipleChoice || made.choose) {
      choices = choicesFor(answer, made.wrong ?? [], decimal, random);
    }
    return {
      skill: this.id,
      factKey: key,
      kind: key,
      parts: made.parts,
      spoken: made.spoken,
      ...(made.prompt ? { prompt: made.prompt } : {}),
      answer,
      choices,
      choiceLabels,
      input: made.input ?? 'whole',
      maxLength: Math.max(3, lengthFor(answer) + 1),
      params: [...params],
    };
  }

  nextQuestion(ctx: QuestionContext): Question | null {
    const picked = pickFromPools(this.poolsFor(ctx.level ?? 1), ctx, this.records, this.memory, this.random);
    if (!picked) return null;
    return this.questionFor(picked.key, picked.band, ctx);
  }

  /** Whether this pack owns a mastery key. */
  owns(key: string): boolean {
    return this.familyOfKey.has(key);
  }

  /** The question for a chosen key (the picking was done by the caller, e.g. auto mode). */
  questionFor(key: string, band: Question['band'], ctx: Pick<QuestionContext, 'multipleChoice'> = {}): Question {
    const picked = { key, band };
    const family = this.familyOfKey.get(picked.key)!;
    // A family's roll should always make a question; try a few times in case one doesn't.
    for (let tries = 0; tries < 20; tries++) {
      const built = this.rebuild(picked.key, family.roll(picked.key, this.random), !!ctx.multipleChoice);
      if (built) return { ...built, id: this.nextId++, band: picked.band };
    }
    throw new Error(`${this.id}: family for "${picked.key}" keeps rolling numbers it can't use`);
  }

  recordAnswer(q: Question, answer: number, ms: number): AnswerResult {
    const correct = sameAnswer(answer, q.answer);
    const before = this.records.get(q.factKey) ?? newStats(q.factKey);
    const at = this.now();
    const after = afterAnswer(before, correct, ms, at, this.definition.quickMs);
    this.records.set(q.factKey, after);
    for (const listener of this.listeners) listener({ key: q.factKey, correct, ms: Math.round(ms), at });
    if (!correct) scheduleRepeat(this.memory, q.factKey, this.random);
    return { correct, fact: this.factText(q), boxBefore: before.box, boxAfter: after.box };
  }

  /** The right answer in full, shown after a wrong answer. */
  factText(q: Pick<Question, 'factKey' | 'params' | 'parts' | 'answer'>): string {
    const made = q.params ? this.familyOfKey.get(q.factKey)?.make(q.factKey, q.params) : null;
    return made?.fact ?? fillBlank(q.parts, q.answer);
  }
}
