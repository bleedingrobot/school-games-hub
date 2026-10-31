/**
 * Checking one reported maths question without trusting the browser: the question is made again
 * from its key and numbers, and the typed answer is marked here. (`BandedPack.rebuild` was built
 * for this in stage N.1; times tables have no numbers to rebuild, so they are checked from the key.)
 */
import { BandedPack, sameAnswer } from '../../maths/banded';
import { MISSING_FACTOR_FROM_LEVEL } from '../../maths/config';
import { parseFactKey } from '../../maths/facts';
import { solveQuestion } from '../../maths/skillPacks/timesTables';
import { poolsFor } from '../../maths/selector';
import { BANDED_PACKS, type TopicId } from '../../maths/skillPacks';
import { bandFor } from '../bands';
import { isTopicId } from '../topics';

/** One question a student answered in a battle. */
export interface QuestionReport {
  topic: TopicId;
  /** The band it was asked at (times tables: the campaign level). */
  band: number;
  /** The mastery key, e.g. "add:7+8" or "mul:7x8". */
  key: string;
  /** The numbers the question was made from (every topic except times tables). */
  params?: number[];
  /** Times tables only: 'multiply' or 'missing-factor'. */
  kind?: string;
  /**
   * Times tables only: the question as it was shown (['?', '×', '8', '=', '56']). The key alone can't say which number was the
   * blank in a missing-factor question, so without this the server can't tell 7 (right) from 8 (the number on screen).
   */
  parts?: string[];
  /** What the student typed or tapped. */
  given: number;
  /** Milliseconds to answer. */
  ms: number;
  /** When they answered (milliseconds since 1970). */
  at: number;
}

const packs = new Map<string, BandedPack>();
const packFor = (topic: Exclude<TopicId, 'times-tables'>) => {
  let pack = packs.get(topic);
  if (!pack) {
    pack = new BandedPack(BANDED_PACKS[topic]);
    packs.set(topic, pack);
  }
  return pack;
};

/** The numbers in a question must be plain finite numbers, a few of them. */
const isNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export type Marked = { ok: true; correct: boolean } | { ok: false; problem: string };

/**
 * Is this a question the game could have asked in this area, and was the answer right?
 * `area` and `far` say where the battle was, so the band must be the one the area asks for
 * (the teacher's topic switches can swap the topic, never make the band easier).
 */
export function markQuestion(q: unknown, area: number, far: boolean): Marked {
  if (!q || typeof q !== 'object') return { ok: false, problem: 'question' };
  const r = q as Record<string, unknown>;
  if (!isTopicId(r.topic)) return { ok: false, problem: 'question-topic' };
  const topic = r.topic;
  if (typeof r.key !== 'string' || r.key.length > 60) return { ok: false, problem: 'question-key' };
  if (!isNumber(r.given)) return { ok: false, problem: 'question-answer' };
  if (!Number.isInteger(r.band) || r.band !== bandFor(topic, area, far)) return { ok: false, problem: 'question-band' };
  const band = r.band as number;

  if (topic === 'times-tables') {
    const fact = parseFactKey(r.key);
    if (!fact) return { ok: false, problem: 'question-key' };
    const pools = poolsFor({ level: band });
    if (![...pools.focus, ...pools.review, ...pools.stretch].includes(r.key)) return { ok: false, problem: 'question-band' };
    if (r.kind !== 'multiply' && !(r.kind === 'missing-factor' && band >= MISSING_FACTOR_FROM_LEVEL)) return { ok: false, problem: 'question-kind' };
    if (r.parts !== undefined) {
      // Worked out from how it was shown: the shown question must be this fact, asked this way.
      const parts = Array.isArray(r.parts) && r.parts.length === 5 && r.parts.every((p) => typeof p === 'string') ? (r.parts as string[]) : null;
      const solved = parts ? solveQuestion(parts) : null;
      if (!parts || !solved || solved.key !== r.key) return { ok: false, problem: 'question-parts' };
      if ((parts[4] === '?') !== (r.kind === 'multiply') || parts[1] !== '×') return { ok: false, problem: 'question-kind' };
      return { ok: true, correct: r.given === solved.answer };
    }
    // A browser from before 20 Oct 2026 sends no parts. A product is still exact; a missing factor can only be checked
    // against either factor (so the number on screen also passes). Remove once no old save can be waiting.
    const product = fact.a * fact.b;
    if (r.kind === 'multiply') return { ok: true, correct: r.given === product };
    return { ok: true, correct: r.given === fact.a || r.given === fact.b };
  }

  const pack = packFor(topic);
  const keyBand = pack.bandOf(r.key);
  // Focus, review (easier bands) and stretch (one band up) are the keys a question can come from.
  if (keyBand === undefined || keyBand > Math.min(band + 1, pack.bandCount)) return { ok: false, problem: 'question-band' };
  if (!Array.isArray(r.params) || r.params.length > 8 || !r.params.every(isNumber)) return { ok: false, problem: 'question-params' };
  const made = pack.rebuild(r.key, r.params as number[]);
  if (!made) return { ok: false, problem: 'question-params' };
  return { ok: true, correct: sameAnswer(r.given, made.answer) };
}
