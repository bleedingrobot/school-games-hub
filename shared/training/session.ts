/**
 * Builds one training session: mostly facts being learned now, some review of older facts
 * (weakest and most overdue first), a few known facts, and always a known one at the end.
 * The same seed (with the same records, day and config) always gives the same session,
 * so a server can rebuild it later to check the answers.
 */
import { TRAINING_CONFIG, type TrainingConfig } from './config';
import { digitsOf, FACTS, FACT_BY_KEY, FAMILY_BY_KEY, promptText, tableStep, type Fact } from './facts';
import { isFlying, isKnown, isResting, isSecure, isStruggling, overdueDays, recordBand, type TrainingState } from './records';
import { seeded } from '../seededRandom';

export type QuestionRole = 'learning' | 'review' | 'known';

export interface SessionQuestion {
  factKey: string;
  kind: 'mul' | 'div';
  prompt: string;
  answer: number;
  /** How many digits the answer has, 1 to 3 (decides which typing time is taken off). */
  digits: number;
  role: QuestionRole;
}

export interface Session {
  seed: number;
  struggling: boolean;
  /** Learning more new facts at once because nearly everything lately was right and quick. */
  flying: boolean;
  /** The practice fortnight: no new facts, only facts already met, best known first. */
  resting: boolean;
  /** The ladder step the student is working on. */
  step: number;
  questions: SessionQuestion[];
}

/** Position of a fact in the order it is introduced: its own table's place in the step, then the other factor. Division follows times. */
function ladderOrder(fact: Fact, config: TrainingConfig): number {
  const tables = (config.tableFamilies.find((f) => f.step === fact.step)?.tables ?? []) as readonly number[];
  const [x, y] = fact.kind === 'mul' ? [fact.a, fact.b] : [fact.a / fact.b, fact.b];
  const ownFactors = [x, y].filter((t) => tableStep(t, config) === fact.step);
  const own = Math.min(...ownFactors.map((t) => tables.indexOf(t)));
  const ownTable = tables[own];
  const other = x === ownTable ? y : x;
  return (fact.kind === 'div' ? 100000 : 0) + own * 1000 + other;
}

/**
 * The ladder step this student is on: the first step with a times or division fact that isn't secure yet. Steps their starting
 * place has already put behind them (`passedSteps`) are skipped.
 */
export function currentStep(state: TrainingState, config: TrainingConfig = TRAINING_CONFIG): number {
  const last = config.tableFamilies.length;
  const first = Math.min(Math.max((state.passedSteps ?? 0) + 1, 1), last);
  for (let step = first; step <= last; step++) {
    if (FACTS.some((f) => f.step === step && !isSecure(state.records[f.key], config))) return step;
  }
  return last;
}

/** The facts being learned right now, best-started first, then new ones in ladder order. */
export function learningFacts(state: TrainingState, count: number, config: TrainingConfig = TRAINING_CONFIG): Fact[] {
  const step = currentStep(state, config);
  const open = FACTS.filter((f) => {
    if (f.step !== step || isSecure(state.records[f.key], config)) return false;
    // Division waits until its times fact is secure: it is "the reverse of times".
    if (f.kind === 'div') return isSecure(state.records[FAMILY_BY_KEY.get(f.familyKey)!.mulKey], config);
    return true;
  });
  const started = open.filter((f) => state.records[f.key]).sort((p, q) => (recordBand(state.records[q.key]) ?? 0) - (recordBand(state.records[p.key]) ?? 0) || ladderOrder(p, config) - ladderOrder(q, config));
  const fresh = open.filter((f) => !state.records[f.key]).sort((p, q) => ladderOrder(p, config) - ladderOrder(q, config));
  return [...started, ...fresh].slice(0, count);
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Reorders so the same fact never comes twice in a row where that can be avoided: picks at random
 * from what's left, but a fact that has to go now (or it would be stuck at the end) goes first.
 */
function noRepeats<T extends { fact: Fact }>(items: T[], rng: () => number): T[] {
  const left = [...items];
  const out: T[] = [];
  while (left.length) {
    const prev = out[out.length - 1]?.fact.key;
    const counts = new Map<string, number>();
    for (const m of left) counts.set(m.fact.key, (counts.get(m.fact.key) ?? 0) + 1);
    const urgent = left.findIndex((m) => m.fact.key !== prev && (counts.get(m.fact.key) ?? 0) * 2 > left.length);
    const choices = left.map((_, i) => i).filter((i) => left[i].fact.key !== prev);
    const pick = urgent > -1 ? urgent : choices.length ? choices[Math.floor(rng() * choices.length)] : 0;
    out.push(left.splice(pick, 1)[0]);
  }
  return out;
}

/** Takes `count` items by going round and round the pool, never using one more than `max` times. */
function cycle<T>(pool: T[], count: number, max: number): T[] {
  const out: T[] = [];
  if (pool.length === 0) return out;
  for (let i = 0; i < count && i < pool.length * max; i++) out.push(pool[i % pool.length]);
  return out;
}

export function buildSession(state: TrainingState, today: string, seed: number, config: TrainingConfig = TRAINING_CONFIG): Session {
  const rng = seeded(seed);
  for (let i = 0; i < 6; i++) rng(); // small seeds start out too alike
  const s = config.session;
  const struggling = isStruggling(state, config);
  // A practice fortnight needs facts to practise; a student with none yet carries on as usual.
  const resting = isResting(state, today) && FACTS.some((f) => state.records[f.key]);
  const flying = !resting && !struggling && isFlying(state, config);
  const r = config.rest;
  const mix = resting
    ? { learningFacts: 0, reviewShare: r.reviewShare, knownShare: r.knownShare, knownFacts: r.knownFacts }
    : struggling
    ? s.struggling
    : { learningFacts: flying ? s.flying.learningFacts : s.learningFacts, reviewShare: s.reviewShare, knownShare: s.knownShare, knownFacts: s.knownFacts };
  const total = Math.min(Math.max(s.questions, s.minQuestions), s.maxQuestions);
  const step = currentStep(state, config);

  const learning = mix.learningFacts > 0 ? learningFacts(state, mix.learningFacts, config) : [];
  const learningKeys = new Set(learning.map((f) => f.key));
  const started = FACTS.filter((f) => state.records[f.key] && !learningKeys.has(f.key));

  // Known facts (or, failing that, secure ones) for the easy wins and the final question.
  let knownPool = started.filter((f) => isKnown(state.records[f.key], config));
  if (knownPool.length === 0) knownPool = started.filter((f) => isSecure(state.records[f.key], config));
  knownPool = shuffle(knownPool, rng).slice(0, mix.knownFacts);

  // Review: weakest first, then the most overdue. In a practice fortnight, best known first instead, for the wins.
  const weakness = (f: Fact) => (recordBand(state.records[f.key]) ?? 0) * (resting ? -1 : 1);
  const reviewPool = [...started].sort((p, q) => weakness(q) - weakness(p)
      || overdueDays(state.records[q.key], today, config) - overdueDays(state.records[p.key], today, config)
      || p.key.localeCompare(q.key));

  let nKnown = knownPool.length ? Math.max(1, Math.round(total * mix.knownShare)) : 0;
  let nReview = reviewPool.length ? Math.round(total * mix.reviewShare) : 0;
  let nLearn = total - nKnown - nReview;
  if (learning.length === 0) {
    // Everything on this step is secure: spend the learning share on review.
    if (reviewPool.length) nReview += nLearn;
    else if (knownPool.length) nKnown += nLearn;
    nLearn = 0;
  }

  const max = s.maxAsksPerFact;
  const picked = (facts: Fact[], role: QuestionRole, n: number) => cycle(facts, n, max).map((fact) => ({ fact, role }));
  // The last known question is kept back for the end of the session.
  const finalFact = knownPool[0];
  const knownForMiddle = knownPool.length > 1 ? knownPool.slice(1) : knownPool;
  let middle = [
    ...picked(shuffle(learning, rng), 'learning', nLearn),
    ...picked(reviewPool.slice(0, Math.max(1, Math.ceil(nReview / 2))), 'review', nReview),
    ...picked(knownForMiddle, 'known', Math.max(0, nKnown - 1)),
  ];
  middle = shuffle(middle, rng);

  // Finish on a known fact; if there are none yet, finish on the easiest fact they have.
  let final: { fact: Fact; role: QuestionRole };
  if (finalFact) final = { fact: finalFact, role: 'known' };
  else {
    const pool = middle.length ? middle : [{ fact: learning[0] ?? FACTS[0], role: 'learning' as QuestionRole }];
    final = pool.reduce((best, m) => {
      const bm = recordBand(state.records[m.fact.key]) ?? 99;
      const bb = recordBand(state.records[best.fact.key]) ?? 99;
      return bm < bb || (bm === bb && m.fact.answer < best.fact.answer) ? m : best;
    });
    if (middle.length > 1) middle.splice(middle.indexOf(final), 1);
  }
  middle = noRepeats(middle, rng);
  // Not the same fact as the one just before the final question either.
  const lastIdx = middle.length - 1;
  if (lastIdx > 0 && middle[lastIdx].fact.key === final.fact.key) {
    const j = middle.findIndex((m, k) => k < lastIdx && m.fact.key !== final.fact.key && (k === 0 || middle[k - 1].fact.key !== middle[lastIdx].fact.key) && middle[k + 1].fact.key !== middle[lastIdx].fact.key);
    if (j > -1) [middle[j], middle[lastIdx]] = [middle[lastIdx], middle[j]];
  }

  const questions: SessionQuestion[] = [...middle, final].map(({ fact, role }) => ({
    factKey: fact.key,
    kind: fact.kind,
    prompt: promptText(fact, rng() < 0.5),
    answer: fact.answer,
    digits: digitsOf(fact.answer),
    role,
  }));
  return { seed, struggling, flying, resting, step, questions };
}

/**
 * Which question comes after `current`. When the 3 minutes are up we skip ahead to the last
 * (known) question so a session still finishes on a win. Null when the session is over.
 */
export function nextQuestionIndex(current: number, total: number, elapsedMs: number, config: TrainingConfig = TRAINING_CONFIG): number | null {
  const last = total - 1;
  if (current >= last) return null;
  if (elapsedMs >= config.session.maxMs && current + 1 < last) return last;
  return current + 1;
}

export const factOf = (key: string): Fact => {
  const f = FACT_BY_KEY.get(key);
  if (!f) throw new Error(`Unknown training fact ${key}`);
  return f;
};
