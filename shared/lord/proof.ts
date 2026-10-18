/**
 * Checking one maths answer from the browser without trusting it. The browser sends a "proof": which pack
 * the question came from, its key and numbers, and what the pupil gave. The server makes the question again
 * from the key and numbers (`BandedPack.rebuild`, as Maths Monsters does) and marks it itself. A proof that
 * can't be checked counts as wrong, never as an error the pupil sees; the reason is kept for the teacher page.
 */
import { BandedPack, sameAnswer } from '../maths/banded';
import type { FactAnswer } from '../maths/leitner';
import { parseFactKey } from '../maths/facts';
import { poolsFor } from '../maths/selector';
import { BANDED_PACKS, EXTRA_PACKS, type ExtraTopicId, type TopicId } from '../maths/skillPacks';
import { ALL_TOPICS, defaultBand, momentTopics, type MomentId } from './maths';

/** A maths answer, as the browser reports it. */
export interface Proof {
  /** The pack the question came from: 'add-sub', 'money', 'times-tables'... */
  pack: string;
  /** The mastery key, e.g. "add:7+8" or "mul:7x8". */
  key: string;
  /** Times tables only: 'multiply', 'missing-factor' or 'divide'. */
  kind?: string;
  /** The numbers the question was made from (every pack except times tables). */
  params?: number[];
  /** The level the question was asked at: a band (1-4), or a campaign level for times tables. */
  level: number;
  /** What the pupil typed or tapped. */
  given: number;
  /** Milliseconds to answer. */
  ms: number;
  /** The pupil used the hint. Only ever lowers what a right answer earns, so it is safe to believe. */
  hinted?: boolean;
}

type PackId = TopicId | ExtraTopicId;
const KINDS = ['multiply', 'missing-factor', 'divide'];

/** The level a question is asked at: a band for most packs, a campaign level for times tables. */
export const questionLevel = (pack: string, heroLevel: number): number =>
  pack === 'times-tables' ? [1, 3, 6, 9][defaultBand(heroLevel) - 1] ?? 1 : defaultBand(heroLevel);

const bandedPacks = new Map<string, BandedPack>();
function bandedPack(id: string): BandedPack | null {
  const def = (BANDED_PACKS as Record<string, (typeof BANDED_PACKS)[keyof typeof BANDED_PACKS]>)[id] ?? (EXTRA_PACKS as Record<string, (typeof EXTRA_PACKS)[ExtraTopicId]>)[id];
  if (!def) return null;
  let pack = bandedPacks.get(id);
  if (!pack) {
    pack = new BandedPack(def);
    bandedPacks.set(id, pack);
  }
  return pack;
}

const isNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export type Marked =
  | { ok: true; correct: boolean; hinted: boolean; answer: FactAnswer & { pack: string } }
  | { ok: false; problem: string };

/**
 * Is this a question the game could have asked a hero of this level at this moment, and was it right?
 * `only` forces one pack (a forest event's own topic); otherwise the moment's packs are allowed. `on` is the list of
 * topics the teacher has left on: a question from any other topic is refused.
 */
export function markProof(raw: unknown, moment: MomentId, heroLevel: number, now: number, only?: string, on: readonly string[] = ALL_TOPICS): Marked {
  if (!raw || typeof raw !== 'object') return { ok: false, problem: 'proof' };
  const p = raw as Record<string, unknown>;
  if (typeof p.pack !== 'string') return { ok: false, problem: 'proof-pack' };
  // A topic the teacher has switched off is never allowed, even for a forest event's own question.
  const allowed: string[] = only ? (on.includes(only) ? [only] : []) : momentTopics(moment, on as PackId[]);
  if (!allowed.includes(p.pack)) return { ok: false, problem: 'proof-pack' };
  if (typeof p.key !== 'string' || p.key.length > 60) return { ok: false, problem: 'proof-key' };
  if (!isNumber(p.given)) return { ok: false, problem: 'proof-answer' };
  if (p.level !== questionLevel(p.pack, heroLevel)) return { ok: false, problem: 'proof-level' };
  const level = p.level as number;
  const ms = isNumber(p.ms) ? Math.max(0, Math.min(120_000, Math.round(p.ms))) : 60_000;

  let correct: boolean;
  if (p.pack === 'times-tables') {
    const fact = parseFactKey(p.key);
    if (!fact) return { ok: false, problem: 'proof-key' };
    const pools = poolsFor({ level });
    if (![...pools.focus, ...pools.review, ...pools.stretch].includes(p.key)) return { ok: false, problem: 'proof-level' };
    if (typeof p.kind !== 'string' || !KINDS.includes(p.kind)) return { ok: false, problem: 'proof-kind' };
    correct = p.kind === 'multiply' ? p.given === fact.a * fact.b : p.given === fact.a || p.given === fact.b;
  } else {
    const pack = bandedPack(p.pack);
    if (!pack) return { ok: false, problem: 'proof-pack' };
    const keyBand = pack.bandOf(p.key);
    // Focus, review (easier bands) and stretch (one band up) are the keys a question can come from.
    if (keyBand === undefined || keyBand > Math.min(level + 1, pack.bandCount)) return { ok: false, problem: 'proof-level' };
    if (!Array.isArray(p.params) || p.params.length > 8 || !p.params.every(isNumber)) return { ok: false, problem: 'proof-params' };
    const made = pack.rebuild(p.key, p.params as number[]);
    if (!made) return { ok: false, problem: 'proof-params' };
    correct = sameAnswer(p.given, made.answer);
  }
  return { ok: true, correct, hinted: p.hinted === true, answer: { pack: p.pack, key: p.key, correct, ms, at: now } };
}
