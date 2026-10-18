/** The "My facts map": a 12 x 12 grid, 6 x 7 and 7 x 6 sharing one colour, with division on the same squares. */
import { TRAINING_CONFIG, type TrainingConfig } from './config';
import { FAMILIES, FAMILY_BY_KEY, FACT_BY_KEY, familyKeyOf } from './facts';
import { isDue, isKnown, recordBand, type TrainingState } from './records';
import type { BandIndex } from './speed';

export interface MapCell {
  a: number;
  b: number;
  familyKey: string;
  product: number;
  step: number;
  /** Colour of the times fact (null = not tried). */
  timesBand: BandIndex | null;
  /** Colour of the division facts in this family: the slowest one that's been tried (null = none tried). */
  divisionBand: BandIndex | null;
  known: boolean;
  /** Due for review: glows softly, never loses its colour. */
  due: boolean;
}

export function familyCell(familyKey: string, state: TrainingState, today: string, config: TrainingConfig = TRAINING_CONFIG): MapCell {
  const fam = FAMILY_BY_KEY.get(familyKey);
  if (!fam) throw new Error(`Unknown family ${familyKey}`);
  const divBands = fam.divKeys.map((k) => recordBand(state.records[k])).filter((b): b is number => b !== null);
  const records = [fam.mulKey, ...fam.divKeys].map((k) => state.records[k]).filter(Boolean);
  return {
    a: fam.a,
    b: fam.b,
    familyKey,
    product: fam.product,
    step: fam.step,
    timesBand: recordBand(state.records[fam.mulKey]),
    divisionBand: divBands.length ? Math.max(...divBands) : null,
    known: isKnown(state.records[fam.mulKey], config),
    due: records.some((r) => isDue(r, today, config)),
  };
}

/** rows[a-1][b-1] is the cell for a x b. The cell for b x a is the same family, so it looks the same. */
export function buildMap(state: TrainingState, today: string, config: TrainingConfig = TRAINING_CONFIG): MapCell[][] {
  const byFamily = new Map(FAMILIES.map((f) => [f.key, familyCell(f.key, state, today, config)]));
  const n = config.maxFactor;
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => byFamily.get(familyKeyOf(r + 1, c + 1))!));
}

export interface FamilyLine {
  factKey: string;
  text: string;
  band: BandIndex | null;
  due: boolean;
}

/** The four facts in a family (or two when both numbers are the same), for the tap-a-square panel. */
export function familyLines(familyKey: string, state: TrainingState, today: string, config: TrainingConfig = TRAINING_CONFIG): FamilyLine[] {
  const fam = FAMILY_BY_KEY.get(familyKey);
  if (!fam) throw new Error(`Unknown family ${familyKey}`);
  const line = (factKey: string, text: string): FamilyLine => ({
    factKey,
    text,
    band: recordBand(state.records[factKey]),
    due: !!state.records[factKey] && isDue(state.records[factKey], today, config),
  });
  const lines = [line(fam.mulKey, `${fam.a} × ${fam.b} = ${fam.product}`)];
  if (fam.a !== fam.b) lines.push(line(fam.mulKey, `${fam.b} × ${fam.a} = ${fam.product}`));
  for (const k of fam.divKeys) {
    const f = FACT_BY_KEY.get(k)!;
    lines.push(line(k, `${f.a} ÷ ${f.b} = ${f.answer}`));
  }
  return lines;
}
