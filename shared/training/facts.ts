/**
 * Times-table and division facts up to 12 x 12, grouped into fact families.
 * Keys match the maths focus plan's style: "mul:6x7" (smaller number first) and "div:42/6".
 */
import { TRAINING_CONFIG, type TrainingConfig } from './config';

export interface Fact {
  key: string;
  kind: 'mul' | 'div';
  /** Mul: the two factors, smaller first. Div: [product, divisor]. */
  a: number;
  b: number;
  answer: number;
  /** Where this fact sits on the ladder (1 = first). */
  step: number;
  familyKey: string;
}

export interface FactFamily {
  key: string;
  /** The two factors, smaller first, and their product. */
  a: number;
  b: number;
  product: number;
  step: number;
  /** The multiplication fact (6 x 7 and 7 x 6 share it) and the division facts (42 / 6 and 42 / 7). */
  mulKey: string;
  divKeys: string[];
}

export const mulKey = (x: number, y: number) => `mul:${Math.min(x, y)}x${Math.max(x, y)}`;
export const divKey = (product: number, divisor: number) => `div:${product}/${divisor}`;
export const familyKeyOf = (x: number, y: number) => `fam:${Math.min(x, y)}x${Math.max(x, y)}`;

/** The step a times table is taught at (the "x6 table" is step 3, and so on). */
export function tableStep(table: number, config: TrainingConfig = TRAINING_CONFIG): number {
  const found = config.tableFamilies.find((f) => (f.tables as readonly number[]).includes(table));
  return found ? found.step : config.tableFamilies.length;
}

/** A fact is learned with the earlier of its two tables: 2 x 7 comes with the x2 table, not the x7 one. */
export function factStep(x: number, y: number, config: TrainingConfig = TRAINING_CONFIG): number {
  return Math.min(tableStep(x, config), tableStep(y, config));
}

export function buildFamilies(config: TrainingConfig = TRAINING_CONFIG): FactFamily[] {
  const out: FactFamily[] = [];
  for (let a = 1; a <= config.maxFactor; a++) {
    for (let b = a; b <= config.maxFactor; b++) {
      const product = a * b;
      out.push({
        key: familyKeyOf(a, b),
        a,
        b,
        product,
        step: factStep(a, b, config),
        mulKey: mulKey(a, b),
        divKeys: a === b ? [divKey(product, a)] : [divKey(product, a), divKey(product, b)],
      });
    }
  }
  return out;
}

export function buildFacts(config: TrainingConfig = TRAINING_CONFIG): Fact[] {
  const out: Fact[] = [];
  for (const f of buildFamilies(config)) {
    out.push({ key: f.mulKey, kind: 'mul', a: f.a, b: f.b, answer: f.product, step: f.step, familyKey: f.key });
    for (const k of f.divKeys) {
      const divisor = Number(k.split('/')[1]);
      out.push({ key: k, kind: 'div', a: f.product, b: divisor, answer: f.product / divisor, step: f.step, familyKey: f.key });
    }
  }
  return out;
}

export const FAMILIES: readonly FactFamily[] = buildFamilies();
export const FACTS: readonly Fact[] = buildFacts();
export const FACT_BY_KEY: ReadonlyMap<string, Fact> = new Map(FACTS.map((f) => [f.key, f]));
export const FAMILY_BY_KEY: ReadonlyMap<string, FactFamily> = new Map(FAMILIES.map((f) => [f.key, f]));

/** Digits in an answer, 1 to 3. */
export const digitsOf = (n: number) => String(Math.abs(n)).length;

/** How a student reads a question, for the screen. */
export function promptText(fact: Fact, flipped = false): string {
  if (fact.kind === 'div') return `${fact.a} ÷ ${fact.b}`;
  return flipped ? `${fact.b} × ${fact.a}` : `${fact.a} × ${fact.b}`;
}
