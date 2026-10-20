/**
 * The maths ladder: one ordered list of skills, easiest first (docs/MATHS-FOCUS-PLAN.md,
 * sections 3 and 12). Auto mode walks a student up it, and `ladderProgress` tells a student
 * (and a teacher) how far along they are.
 *
 * It's only data: to change the order, move a line in `LADDER`. A skill owns a set of mastery
 * keys (the facts or question types that make it up) and its questions come from the pack
 * that owns those keys. Skills with `built: false` are stubs for the later stages: they hold
 * their place in the list, but auto skips them and they don't count towards progress yet.
 */
import { CAMPAIGN_STEPS, HARD_TABLES, HARD_TABLE_WEIGHT, TABLES } from './config';
import { factsIn, parseFactKey } from './facts';
import type { FactStats } from './leitner';
import { newMemory, pickFromPools, scheduleRepeat, STEP_SECURE_SHARE, type Pools, type QuestionContext, type SessionMemory } from './selector';
import type { FactAnswer } from './leitner';
import type { AnswerResult, Question, SkillPack } from './skillPack';
import { BANDED_PACKS } from './skillPacks';
import { EARLY_FACTS, earlyFactsPack } from './skillPacks/earlyFacts';
import { GENERATED_SKILL_KEYS, generatedPack, isGeneratedKey } from './skillPacks/generated';
import { BandedPack } from './banded';
import { TimesTables } from './skillPacks/timesTables';

export type LadderStage = 'early-facts' | 'times-tables' | 'place-value' | 'rounding' | 'order-of-operations' | 'fractions-decimals-percentages';

export interface LadderSkill {
  id: string;
  /** What students and teachers see. Never a year level. */
  label: string;
  stage: LadderStage;
  /** NZC teaching-sequence IDs (maths-alignment-tool data/curriculum/teaching-sequence). */
  curriculumTags: string[];
  /** The mastery keys that make up the skill. Empty for stubs. */
  keys: string[];
  built: boolean;
}

const earlyKeys = (family: string) => EARLY_FACTS.families[family].keys;
const addKeys = (test: (sum: number) => boolean) =>
  Object.values(BANDED_PACKS['add-sub'].families)
    .flatMap((f) => f.keys)
    .filter((k) => {
      const m = /^add:(\d+)\+(\d+)$/.exec(k);
      return m && test(Number(m[1]) + Number(m[2]));
    });
/** Division fact keys ("div:56/8") whose divisor is one of these. */
const divKeys = (divisors: number[]) =>
  Object.values(BANDED_PACKS.division.families)
    .flatMap((f) => f.keys)
    .filter((k) => {
      const m = /^div:(\d+)\/(\d+)$/.exec(k);
      return m && divisors.includes(Number(m[2]));
    });

/** Times tables, one skill per campaign step. The multiplication and division facts of a table go together. */
function tablesSkills(): LadderSkill[] {
  const tags = ['MS.Y2.NUM.OP.P9', 'MS.Y3.NUM.OP.P6', 'MS.Y4.NUM.OP.P2', 'MS.Y4.NUM.OP.P2', 'MS.Y5.NUM.OP.P2'];
  const seen = new Set<string>();
  return CAMPAIGN_STEPS.map((step, i) => {
    const upTo = step.upTo ?? 12;
    // A fact like 3 × 4 sits in the first step that uses it, so a later step is only its new facts.
    const mul = [...factsIn(step.add)].filter((k) => parseFactKey(k)!.b <= upTo && !seen.has(k));
    mul.forEach((k) => seen.add(k));
    const div = divKeys(step.add).filter((k) => !seen.has(k)); // facts like 132 ÷ 12 are in the pack too
    div.forEach((k) => seen.add(k));
    return {
      id: `tables-${step.add.join('-')}`,
      label: 'Times tables: ' + step.add.map((t) => `×${t}`).join(', '),
      stage: 'times-tables' as const,
      curriculumTags: [tags[i] ?? tags[tags.length - 1]],
      keys: [...mul, ...div],
      built: true,
    };
  });
}

/** A skill made of generated question types (kept per type, not per fact). */
const generated = (id: string, label: string, stage: LadderStage, keys: readonly string[], ...curriculumTags: string[]): LadderSkill => ({ id, label, stage, curriculumTags, keys: [...keys], built: true });
const tables = tablesSkills();

/** Easiest first. Table skills are in the order of `CAMPAIGN_STEPS`. */
export const LADDER: LadderSkill[] = [
  { id: 'facts-10', label: 'Number facts to 10', stage: 'early-facts', curriculumTags: ['MS.Y1.NUM.OP.P1'], keys: [...earlyKeys('bond10'), ...addKeys((s) => s <= 10)], built: true },
  { id: 'dbl-half-10', label: 'Doubles and halves to 10', stage: 'early-facts', curriculumTags: ['MS.Y1.NUM.OP.P2'], keys: earlyKeys('dblHalf10'), built: true },
  { id: 'ten-and', label: 'Ten and a number (10 + 4)', stage: 'early-facts', curriculumTags: ['MS.Y1.NUM.OP.P6'], keys: earlyKeys('tenAnd'), built: true },
  { id: 'facts-20', label: 'Number facts to 20', stage: 'early-facts', curriculumTags: ['MS.Y2.NUM.OP.P1'], keys: [...earlyKeys('bond20'), ...addKeys((s) => s > 10)], built: true },
  { id: 'dbl-half-20', label: 'Doubles and halves to 20', stage: 'early-facts', curriculumTags: ['MS.Y2.NUM.OP.P2'], keys: earlyKeys('dblHalf20'), built: true },
  tables[0],
  generated('bonds-100', 'Pairs that make 100', 'place-value', GENERATED_SKILL_KEYS['bonds-100'], 'MS.Y3.NUM.OP.P1'),
  tables[1],
  generated('round-10-100', 'Rounding to the nearest 10 and 100', 'rounding', GENERATED_SKILL_KEYS['round-10-100'], 'MS.Y3.NUM.NS.P5'),
  generated('bonds-1000', 'Hundreds that make 1000', 'place-value', GENERATED_SKILL_KEYS['bonds-1000']),
  generated('unit-fraction-of', 'A fraction of an amount (⅓ of 15)', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['unit-fraction-of'], 'MS.Y3.NUM.RN.P7'),
  tables[2],
  tables[3],
  generated('times-tens', 'Times with tens and hundreds (30 × 4)', 'place-value', GENERATED_SKILL_KEYS['times-tens'], 'MS.Y4.NUM.OP.P3'),
  generated('tenths', 'Tenths and decimals of a half', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['tenths'], 'MS.Y4.NUM.RN.P3', 'MS.Y4.NUM.RN.P5'),
  generated('add-tenths', 'Adding and taking away tenths', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['add-tenths'], 'MS.Y4.NUM.RN.P10'),
  generated('round-1000', 'Rounding to the nearest 1000', 'rounding', GENERATED_SKILL_KEYS['round-1000'], 'MS.Y4.NUM.NS.K4'),
  tables[4],
  generated('factor-pairs', 'Factor pairs', 'place-value', GENERATED_SKILL_KEYS['factor-pairs'], 'MS.Y5.NUM.NS.P2'),
  generated('round-big', 'Rounding bigger numbers and decimals', 'rounding', GENERATED_SKILL_KEYS['round-big'], 'MS.Y5.NUM.NS.P3', 'MS.Y5.NUM.NS.P4'),
  generated('decimal-equivalents', 'Fractions as decimals', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['decimal-equivalents'], 'MS.Y5.NUM.RN.P4'),
  generated('percent-basic', '10%, 25% and 50%', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['percent-basic'], 'MS.Y5.NUM.RN.P5', 'MS.Y5.NUM.RN.P15'),
  generated('fraction-of', 'Fractions of an amount (⅔ of 24)', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['fraction-of'], 'MS.Y5.NUM.RN.P13'),
  generated('times-decimals', 'Times 10 and 100 with decimals', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['times-decimals'], 'MS.Y5.NUM.RN.P7'),
  generated('equivalent-fractions', 'Equivalent fractions and simplifying', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['equivalent-fractions'], 'MS.Y5.NUM.RN.P9', 'MS.Y6.NUM.RN.P6'),
  generated('squares-cubes', 'Square and cube numbers', 'place-value', GENERATED_SKILL_KEYS['squares-cubes'], 'MS.Y6.NUM.NS.P6'),
  generated('round-million', 'Rounding to the nearest million', 'rounding', GENERATED_SKILL_KEYS['round-million'], 'MS.Y6.NUM.NS.P3', 'MS.Y6.NUM.NS.P4'),
  generated('fdp-equivalents', 'Fractions, decimals and percentages', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['fdp-equivalents'], 'MS.Y6.NUM.RN.P3', 'MS.Y6.NUM.RN.P4'),
  generated('percent-of', 'Percentages of an amount', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['percent-of'], 'MS.Y6.NUM.RN.P13', 'MS.Y6.NUM.RN.P14'),
  generated('whole-from-fraction', 'Finding the whole from a fraction', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['whole-from-fraction'], 'MS.Y6.NUM.RN.P12'),
  generated('bedmas', 'Order of operations', 'order-of-operations', GENERATED_SKILL_KEYS.bedmas, 'MS.Y6.NUM.OP.P1'),
];

// ---------------------------------------------------------------- progress

export type SkillStatus = 'secure' | 'current' | 'upcoming' | 'later';

export interface SkillProgress {
  skill: LadderSkill;
  /** 'later' = not built yet. */
  status: SkillStatus;
  /** Share of the skill's facts in box 2 or higher (0–1). */
  share: number;
  /**
   * True for a skill the student's starting point (placement or furthest place) is past, but whose facts are not
   * secure in their records. It counts as behind them (never the current skill) but not as secure, so the numbers stay honest.
   */
  passedOver?: boolean;
}

export interface LadderProgress {
  skills: SkillProgress[];
  /** The skill auto is working on, or null when every built skill is secure. */
  current: LadderSkill | null;
  secureCount: number;
  /** Skills that are built (the ones that count). */
  builtCount: number;
  /** Whole percent: how far through the built part of the ladder. */
  percent: number;
}

export interface LadderOptions {
  /** Tables the teacher has left on. Default all. A skill with none of its tables on is skipped. */
  enabledTables?: readonly number[];
  /** Division facts (56 ÷ 8) are asked, and counted towards progress, only when this isn't false. Not set = included. */
  division?: boolean;
  /**
   * Where the student starts on the whole ladder (an index into `LADDER`): their placement or the
   * furthest place they have reached. Built skills before it count as passed, so a place never drops below it.
   */
  floor?: number;
  /** A maths focus (teacher's or the student's own) instead of auto. */
  focus?: FocusSpec;
}

/** The skills a focus names, and whether earlier skills are left out ("only these"). */
export interface FocusSpec {
  skills: readonly string[];
  onlyThese: boolean;
}

/** The skill's keys once switched-off tables are taken out. */
export function activeKeys(skill: LadderSkill, enabledTables: readonly number[], division = true): string[] {
  const on = new Set(enabledTables);
  return skill.keys.filter((k) => {
    const mul = parseFactKey(k);
    if (mul) return on.has(mul.a) || on.has(mul.b);
    const div = /^div:\d+\/(\d+)$/.exec(k);
    return div ? division && on.has(Number(div[1])) : true;
  });
}

/**
 * Where a student is on the ladder, worked out from their records: the first built skill that
 * isn't secure yet (70% of its facts in box 2 or higher, the same rule as the times-table
 * campaign) is the one they're on. A skill with all its tables switched off is left out: it never becomes the
 * current skill and doesn't count towards progress (it shows as 'upcoming' with a share of 1). With a `floor` (placement or the furthest place reached, see place.ts) the
 * built skills before it are behind the student (passed over, and secure only if their records say so), so forgetting a fact brings more review but never
 * drops the student's place below the floor.
 */
export function ladderProgress(stats: Iterable<FactStats>, opts: LadderOptions = {}): LadderProgress {
  const byKey = new Map([...stats].map((s) => [s.key, s]));
  const enabled = opts.enabledTables ?? TABLES;
  let current: LadderSkill | null = null;
  let secureCount = 0;
  let builtCount = 0;
  const floor = opts.floor ?? 0;
  const skills: SkillProgress[] = LADDER.map((skill, index) => {
    if (!skill.built) return { skill, status: 'later' as const, share: 0 };
    const keys = activeKeys(skill, enabled, opts.division !== false);
    if (keys.length === 0) return { skill, status: 'upcoming' as const, share: 1 };
    builtCount++;
    const share = keys.filter((k) => (byKey.get(k)?.box ?? 0) >= 2).length / keys.length;
    if (index < floor) {
      const real = share >= STEP_SECURE_SHARE;
      if (real) secureCount++;
      return { skill, status: 'secure' as const, share, passedOver: !real };
    }
    if (current === null && share < STEP_SECURE_SHARE) {
      current = skill;
      return { skill, status: 'current' as const, share };
    }
    if (current === null) secureCount++;
    return { skill, status: current === null ? ('secure' as const) : ('upcoming' as const), share };
  });
  return { skills, current, secureCount, builtCount, percent: builtCount ? Math.round((100 * secureCount) / builtCount) : 0 };
}

/** The focus, review and stretch keys auto draws from for these records. */
export function autoPools(progress: LadderProgress, opts: LadderOptions = {}): Pools {
  const enabled = opts.enabledTables ?? TABLES;
  const live = progress.skills.filter((p) => p.skill.built).map((p) => ({ ...p, keys: activeKeys(p.skill, enabled, opts.division !== false) })).filter((p) => p.keys.length);
  const at = live.findIndex((p) => p.status === 'current');
  if (at < 0) return { focus: [], review: live.flatMap((p) => p.keys), stretch: [] };
  return { focus: live[at].keys, review: live.slice(0, at).flatMap((p) => p.keys), stretch: live[at + 1]?.keys ?? [] };
}

/** The built ladder skills a focus really names, in ladder order. Unknown or not-yet-built names are ignored. */
export function focusSkills(spec: FocusSpec): LadderSkill[] {
  const wanted = new Set(spec.skills);
  return LADDER.filter((s) => s.built && wanted.has(s.id));
}

/**
 * The keys a focus draws from. The chosen skills are the focus; earlier skills come up as review
 * (about 30% of questions) unless the focus is "only these"; there is no stretch, so a teacher's
 * ×6 never drifts on to ×7. Switched-off tables, and division when it's off, are left out.
 */
export function focusPools(spec: FocusSpec, opts: LadderOptions = {}): Pools {
  const enabled = opts.enabledTables ?? TABLES;
  const keysOf = (skill: LadderSkill) => activeKeys(skill, enabled).filter((k) => opts.division !== false || !k.startsWith('div:'));
  const chosen = focusSkills(spec);
  if (chosen.length === 0) return { focus: [], review: [], stretch: [] };
  const focus = [...new Set(chosen.flatMap(keysOf))];
  if (spec.onlyThese) return { focus, review: [], stretch: [] };
  const mine = new Set(focus);
  const before = LADDER.slice(0, LADDER.indexOf(chosen[0])).filter((s) => s.built);
  return { focus, review: before.flatMap(keysOf).filter((k) => !mine.has(k)), stretch: [] };
}

/** Which skill pack records a mastery key ("mul:7x8" → "times-tables"), or null if it isn't a ladder key. */
export function packIdOfKey(key: string): 'times-tables' | 'early-facts' | 'add-sub' | 'division' | 'generated' | null {
  if (/^mul:\d+x\d+$/.test(key)) return 'times-tables';
  if (isGeneratedKey(key)) return 'generated';
  if (/^(bond10|bond20|dbl|half|tenand):/.test(key)) return 'early-facts';
  if (key.startsWith('add:')) return 'add-sub';
  if (key.startsWith('div:')) return 'division';
  return null;
}

/**
 * A question for one mastery key, as the pack that owns the key would ask it (nothing is recorded).
 * The placement check uses it to ask about a skill without a student's records.
 */
export function questionForKey(key: string, id: number, random: () => number = Math.random): Question | null {
  const packs: (BandedPack | TimesTables)[] = [
    earlyFactsPack([], random),
    new BandedPack(BANDED_PACKS['add-sub'], [], random),
    new TimesTables([], random),
    new BandedPack(BANDED_PACKS.division, [], random),
    generatedPack([], random),
  ];
  const pack = packs.find((p) => p.owns(key));
  if (!pack) return null;
  const question = pack.questionFor(key, 'focus', { missingFactor: false });
  return { ...question, id };
}

/** The packs a game keeps records for under a focus (everything the built ladder uses). */
export const FOCUS_PACKS = ['times-tables', 'early-facts', 'add-sub', 'division', 'generated'] as const;
export type FocusPackId = (typeof FOCUS_PACKS)[number];

/** Every mastery key the built ladder asks, with the pack that keeps its record. */
export function ladderKeyPacks(): Map<string, FocusPackId> {
  const out = new Map<string, FocusPackId>();
  for (const skill of LADDER) {
    if (!skill.built) continue;
    for (const key of skill.keys) {
      const pack = packIdOfKey(key);
      if (pack) out.set(key, pack);
    }
  }
  return out;
}

// ---------------------------------------------------------------- the auto pack

/**
 * One skill pack for the whole ladder. It picks the next fact (60% the skill the student is
 * on, 30% review, 10% stretch, hard tables a bit likelier in review) and asks whichever pack
 * owns that fact for the question, so records stay in the same keys the other games use.
 */
export class AutoPack implements SkillPack {
  readonly id = 'auto';
  readonly label = 'Auto';
  readonly curriculumTags = [...new Set(LADDER.filter((s) => s.built).flatMap((s) => s.curriculumTags))];
  private packs: (BandedPack | TimesTables)[];
  private memory: SessionMemory = newMemory();
  /** Each pack numbers its own questions, so the ladder numbers them again: a question box tells questions apart by this. */
  private asked = 0;
  private listeners = new Set<(answer: FactAnswer) => void>();

  constructor(
    saved: FactStats[] = [],
    private random: () => number = Math.random,
    now: () => number = Date.now,
    private opts: LadderOptions = {},
  ) {
    const only = (pack: { owns(key: string): boolean }) => saved.filter((s) => pack.owns(s.key));
    const shells = [earlyFactsPack(), new BandedPack(BANDED_PACKS['add-sub']), new TimesTables(), new BandedPack(BANDED_PACKS.division), generatedPack()];
    this.packs = [
      earlyFactsPack(only(shells[0]), random, now),
      new BandedPack(BANDED_PACKS['add-sub'], only(shells[1]), random, now),
      new TimesTables(only(shells[2]), random, now),
      new BandedPack(BANDED_PACKS.division, only(shells[3]), random, now),
      generatedPack(only(shells[4]), random, now),
    ];
    for (const pack of this.packs) pack.onAnswer((a) => this.listeners.forEach((l) => l(a)));
  }

  private ownerOf(key: string) {
    const pack = this.packs.find((p) => p.owns(key));
    if (!pack) throw new Error(`auto: nothing owns "${key}"`);
    return pack;
  }

  onAnswer(listener: (answer: FactAnswer) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  stats(): FactStats[] {
    return this.packs.flatMap((p) => p.stats());
  }

  /** The pack that keeps the record for a key (so saving can sort answers by pack). */
  static packOf(key: string) {
    return packIdOfKey(key);
  }

  /** Where the student is on the ladder right now. */
  progress(): LadderProgress {
    return ladderProgress(this.stats(), this.opts);
  }

  nextQuestion(ctx: QuestionContext = {}): Question | null {
    const progress = this.progress();
    const focusSpec = this.opts.focus && focusSkills(this.opts.focus).length ? this.opts.focus : null;
    const pools = focusSpec ? focusPools(focusSpec, this.opts) : autoPools(progress, this.opts);
    const focus = new Set(pools.focus);
    const hardTable = (key: string) => {
      const mul = parseFactKey(key);
      if (mul) return HARD_TABLES.includes(mul.a) || HARD_TABLES.includes(mul.b);
      const div = /^div:\d+\/(\d+)$/.exec(key);
      return !!div && HARD_TABLES.includes(Number(div[1]));
    };
    const weight = (key: string) => (!focus.has(key) && hardTable(key) ? HARD_TABLE_WEIGHT : 1);
    const byKey = new Map(this.stats().map((s) => [s.key, s]));
    const picked = pickFromPools(pools, ctx, byKey, this.memory, this.random, weight);
    if (!picked) return null;
    const pack = this.ownerOf(picked.key);
    // Missing-factor questions come in once the first tables skill is behind the student.
    // Under a focus the teacher's own setting decides, else it starts at the first chosen skill after ×2, ×5, ×10.
    const firstTables = progress.skills.findIndex((p) => p.skill.stage === 'times-tables');
    const at = focusSpec ? LADDER.indexOf(focusSkills(focusSpec)[0]) : progress.skills.findIndex((p) => p.status === 'current');
    const missingFactor = focusSpec && ctx.missingFactor !== undefined ? ctx.missingFactor : at < 0 || at > firstTables;
    return { ...pack.questionFor(picked.key, picked.band, { ...ctx, missingFactor }), id: ++this.asked };
  }

  recordAnswer(q: Question, answer: number, ms: number): AnswerResult {
    const result = this.ownerOf(q.factKey).recordAnswer(q, answer, ms);
    if (!result.correct) scheduleRepeat(this.memory, q.factKey, this.random);
    return result;
  }
}
