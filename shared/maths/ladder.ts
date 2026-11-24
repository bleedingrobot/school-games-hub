/**
 * The maths ladder: one ordered list of skills, easiest first (docs/MATHS-FOCUS-PLAN.md,
 * sections 3 and 12). Auto mode walks a student up it, and `ladderProgress` tells a student
 * (and a teacher) how far along they are.
 *
 * It's only data: to change the order, move a line in `LADDER`. A skill owns a set of mastery
 * keys (the facts or question types that make it up) and its questions come from the pack
 * that owns those keys. Skills with `built: true` are stubs for the later stages: they hold
 * their place in the list, but auto skips them and they don't count towards progress yet.
 */
import { CAMPAIGN_STEPS, HARD_TABLES, HARD_TABLE_WEIGHT, TABLES } from './config';
import { factsIn, parseFactKey } from './facts';
import type { FactStats } from './leitner';
import { newMemory, pickFromPools, scheduleRepeat, STEP_SECURE_SHARE, type Pools, type QuestionContext, type SessionMemory } from './selector';
import type { FactAnswer } from './leitner';
import type { AnswerResult, Question, SkillPack } from './skillPack';
import { BANDED_PACKS } from './skillPacks';
import { EARLY_FACTS, earlyFactsPack, SKIP_FROM_STEPS, SKIP_MORE_STEPS, SKIP_STEPS } from './skillPacks/earlyFacts';
import { foldBondPairs } from './skillPacks/bondPairs';
import { GENERATED_SKILL_KEYS, generatedPack, isGeneratedKey } from './skillPacks/generated';
import { BandedPack } from './banded';
import { TimesTables } from './skillPacks/timesTables';

export type LadderStage =
  | 'early-facts'
  | 'times-tables'
  | 'place-value'
  | 'rounding'
  | 'order-of-operations'
  | 'fractions-decimals-percentages'
  // Year 7-8 (docs/plans/ladder-7-8/PLAN.md).
  | 'integers'
  | 'algebra'
  | 'measurement-geometry'
  | 'data-chance';

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
  /** False keeps a skill out of the placement warm-up, so the warm-up's ten questions still reach as high as before. */
  inWarmUp?: false;
  /**
   * False keeps a skill beside the ladder rather than on it: auto never makes it the current skill or asks it as review, and
   * it doesn't count towards progress. A teacher can still choose it as a focus, and a game (Pipi) can ask it from its own rules.
   */
  inAuto?: false;
  /**
   * The school year the NZC teaching sequence puts the skill in, for Year 7 and 8 skills only (left out below Year 7). A pupil
   * whose teacher ticked "Stop at Year 6" never has these on auto (`LadderOptions.capAtYear6`).
   */
  year?: 7 | 8;
  /** For a times-tables skill: its table (7 for ×7). */
  table?: number;
  /** For a times-tables skill: which step of `CAMPAIGN_STEPS` its table is in (0 for ×2, ×5 and ×10). */
  tablesStep?: number;
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

/**
 * Times tables, one skill per table (James, 19 Nov 2026: "split them apart"), in the order of `CAMPAIGN_STEPS`: ×2, ×5, ×10,
 * ×3, ×4, ×8, ×6, ×9, ×7, ×11, ×12. The multiplication and division facts of a table go together. A fact like 3 × 4 sits in
 * the first table that uses it, so a later table is only its new facts. `tablesStep` says which campaign step a table came
 * from: jumping ahead, Training and missing-factor questions still go by the old steps.
 */
function tablesSkills(): LadderSkill[] {
  const tags = ['MS.Y2.NUM.OP.P9', 'MS.Y3.NUM.OP.P6', 'MS.Y4.NUM.OP.P2', 'MS.Y4.NUM.OP.P2', 'MS.Y5.NUM.OP.P2'];
  const seen = new Set<string>();
  return CAMPAIGN_STEPS.flatMap((step, i) => {
    const upTo = step.upTo ?? 12;
    return step.add.map((table, j): LadderSkill => {
      const mul = [...factsIn([table])].filter((k) => parseFactKey(k)!.b <= upTo && !seen.has(k));
      mul.forEach((k) => seen.add(k));
      const div = divKeys([table]).filter((k) => !seen.has(k)); // facts like 132 ÷ 12 are in the pack too
      div.forEach((k) => seen.add(k));
      return {
        id: `tables-${table}`,
        label: `Times tables: ×${table}`,
        stage: 'times-tables',
        curriculumTags: [tags[i] ?? tags[tags.length - 1]],
        keys: [...mul, ...div],
        built: true,
        table,
        tablesStep: i,
        // The warm-up asks the first table of each old step only, so its ten questions still reach as high as before.
        ...(j > 0 ? { inWarmUp: false as const } : {}),
      };
    });
  });
}

/** A skill made of generated question types (kept per type, not per fact). */
const generated = (id: string, label: string, stage: LadderStage, keys: readonly string[], ...curriculumTags: string[]): LadderSkill => ({ id, label, stage, curriculumTags, keys: [...keys], built: true });
const tables = tablesSkills();
const tablesOfStep = (step: number) => tables.filter((s) => s.tablesStep === step);

/** Easiest first. Table skills are in the order of `CAMPAIGN_STEPS`. */
export const LADDER: LadderSkill[] = [
  // The part-whole facts (7 is 4 and 3) sit under the facts to 10, for the youngest. Pipi's Hidden Shells asks them from the
  // child's own records, so they stay beside the ladder (`inAuto`) and an older student's auto practice never meets them.
  { id: 'parts-5', label: 'Parts of numbers to 5', stage: 'early-facts', curriculumTags: ['MS.Y1.NUM.OP.P1'], keys: earlyKeys('parts5'), built: true, inWarmUp: false, inAuto: false },
  { id: 'parts-10', label: 'Parts of numbers to 10', stage: 'early-facts', curriculumTags: ['MS.Y1.NUM.OP.P1'], keys: earlyKeys('parts10'), built: true, inWarmUp: false, inAuto: false },
  // Facts to 5 (1 + 4, 5 − 2) come first (James, 19 Nov 2026), so the youngest start with the smallest numbers.
  { id: 'facts-5', label: 'Number facts to 5', stage: 'early-facts', curriculumTags: ['MS.Y1.NUM.OP.P1'], keys: addKeys((s) => s <= 5), built: true },
  { id: 'facts-10', label: 'Number facts to 10', stage: 'early-facts', curriculumTags: ['MS.Y1.NUM.OP.P1'], keys: [...earlyKeys('bond10'), ...addKeys((s) => s > 5 && s <= 10)], built: true },
  { id: 'dbl-half-10', label: 'Doubles and halves to 10', stage: 'early-facts', curriculumTags: ['MS.Y1.NUM.OP.P2'], keys: earlyKeys('dblHalf10'), built: true },
  { id: 'ten-and', label: 'Ten and a number (10 + 4)', stage: 'early-facts', curriculumTags: ['MS.Y1.NUM.OP.P6'], keys: [...earlyKeys('tenAnd'), ...earlyKeys('tenLess')], built: true },
  { id: 'facts-20', label: 'Number facts to 20', stage: 'early-facts', curriculumTags: ['MS.Y2.NUM.OP.P1'], keys: [...earlyKeys('bond20'), ...addKeys((s) => s > 10)], built: true },
  { id: 'dbl-half-20', label: 'Doubles and halves to 20', stage: 'early-facts', curriculumTags: ['MS.Y2.NUM.OP.P2'], keys: earlyKeys('dblHalf20'), built: true },
  // Skip counting leads into ×10, ×5 and ×2, so a junior meets tens, then fives, then twos (no curriculum tag checked yet).
  // The warm-up leaves it out: a student it places past it has it as passed over, like any skill below their start.
  ...SKIP_STEPS.map(({ step, word }): LadderSkill => ({ id: `skip-${step}`, label: `Counting in ${word}`, stage: 'early-facts', curriculumTags: [], keys: earlyKeys(`skip${step}`), built: true, inWarmUp: false })),
  // Odd and even to 20 sits beside the ladder (`inAuto`): Penguin Pairs asks it on gold days from its own rules, and a teacher can choose it.
  { id: 'odd-even', label: 'Odd and even numbers to 20', stage: 'early-facts', curriculumTags: ['MS.Y2.NUM.OP.P2'], keys: earlyKeys('oddEven'), built: true, inWarmUp: false, inAuto: false },
  // More skip counting sits beside the ladder (`inAuto`): Hop asks threes, fours, tens past 100 and counting from a start that isn't a multiple from its own rules (R8), and a teacher can choose them.
  ...SKIP_MORE_STEPS.map(({ step, word }): LadderSkill => ({ id: `skip-${step}`, label: `Counting in ${word}`, stage: 'early-facts', curriculumTags: [], keys: earlyKeys(`skip${step}`), built: true, inWarmUp: false, inAuto: false })),
  { id: 'skip-10-past-100', label: 'Counting in tens past 100', stage: 'early-facts', curriculumTags: [], keys: earlyKeys('skip10h'), built: true, inWarmUp: false, inAuto: false },
  { id: 'skip-from', label: 'Counting on from a start (3, 13, 23)', stage: 'early-facts', curriculumTags: [], keys: SKIP_FROM_STEPS.flatMap(({ step }) => earlyKeys(`skip${step}o`)), built: true, inWarmUp: false, inAuto: false },
  // Ten more and ten less on the teens (Tūī's step 6) sits beside the ladder too.
  { id: 'ten-more-less-teens', label: 'Ten more and ten less (14 + 10, 24 − 10)', stage: 'early-facts', curriculumTags: ['MS.Y1.NUM.OP.P6'], keys: [...earlyKeys('tenUp'), ...earlyKeys('tenDown')], built: true, inWarmUp: false, inAuto: false },
  // The number line (Pigeon's Number Line) sits beside the ladder (`inAuto`): the game draws and marks its own questions (a line is a picture), and only records these keys like any early fact. Typed, they read as a short sentence.
  { id: 'number-line-100', label: 'The number line to 100', stage: 'place-value', curriculumTags: ['MS.Y3.NUM.NS.P1'], keys: [...earlyKeys('place100'), ...earlyKeys('read100'), ...earlyKeys('near10'), ...earlyKeys('zoom')], built: true, inWarmUp: false, inAuto: false },
  { id: 'ten-more-less', label: 'Ten more and ten less', stage: 'place-value', curriculumTags: ['MS.Y3.NUM.NS.P1'], keys: earlyKeys('tens100'), built: true, inWarmUp: false, inAuto: false },
  { id: 'number-line-1000', label: 'The number line to 1000', stage: 'place-value', curriculumTags: ['MS.Y4.NUM.NS.P1'], keys: [...earlyKeys('place1000'), ...earlyKeys('read1000'), ...earlyKeys('near100')], built: true, inWarmUp: false, inAuto: false },
  // Parrot's See-saw (the equals sign) sits beside the ladder (`inAuto`): the game makes and marks its own questions and only records these keys like any early fact. Typed, they read as short see-saw sentences.
  { id: 'balance-10', label: 'The equals sign: a missing number to 10', stage: 'early-facts', curriculumTags: [], keys: [...earlyKeys('eqmiss'), ...earlyKeys('eqswap')], built: true, inWarmUp: false, inAuto: false },
  { id: 'balance-20', label: 'The equals sign: two numbers each side, and taking away', stage: 'early-facts', curriculumTags: [], keys: [...earlyKeys('eqboth'), ...earlyKeys('eqsub')], built: true, inWarmUp: false, inAuto: false },
  { id: 'true-false', label: 'The equals sign: true or false', stage: 'early-facts', curriculumTags: [], keys: earlyKeys('eqtf'), built: true, inWarmUp: false, inAuto: false },
  // Tens and ones (Lizard's Bundles) sit beside the ladder too (`inAuto`): the game draws bundles and sticks and marks them itself; these keys are only recorded.
  { id: 'bundles-50', label: 'Bundles of ten and tens and ones to 50', stage: 'place-value', curriculumTags: ['MS.Y2.NUM.NS.P1'], keys: [...earlyKeys('pvbuild'), ...earlyKeys('pvread')].filter((k) => Number(/(\d+)$/.exec(k)![1]) <= 50), built: true, inWarmUp: false, inAuto: false },
  { id: 'place-value-100', label: 'Tens and ones to 100, and zero', stage: 'place-value', curriculumTags: ['MS.Y2.NUM.NS.P1'], keys: [...[...earlyKeys('pvbuild'), ...earlyKeys('pvread')].filter((k) => Number(/(\d+)$/.exec(k)![1]) > 50), ...earlyKeys('pvzero')], built: true, inWarmUp: false, inAuto: false },
  { id: 'regroup-100', label: 'Tying and untying bundles', stage: 'place-value', curriculumTags: ['MS.Y2.NUM.NS.P2'], keys: earlyKeys('pvregroup'), built: true, inWarmUp: false, inAuto: false },
  { id: 'ten-more-less-100', label: 'Ten more and ten less with bundles', stage: 'place-value', curriculumTags: ['MS.Y2.NUM.NS.P1'], keys: earlyKeys('pvten'), built: true, inWarmUp: false, inAuto: false },
  { id: 'place-value-1000', label: 'Hundreds, tens and ones', stage: 'place-value', curriculumTags: ['MS.Y3.NUM.NS.P1'], keys: [...earlyKeys('pvbuild3'), ...earlyKeys('pvread3'), ...earlyKeys('pvhun')], built: true, inWarmUp: false, inAuto: false },
  // Equal rows and arrays (Swamp Hen's Reed Rows) sit beside the ladder (`inAuto`): the game draws and marks its own questions and records these keys. Typed, they read as a short sentence.
  { id: 'equal-rows', label: 'Equal rows (4 rows of 6)', stage: 'early-facts', curriculumTags: ['MS.Y2.NUM.OP.P3'], keys: earlyKeys('rows'), built: true, inWarmUp: false, inAuto: false },
  { id: 'arrays-turn', label: 'Turning an array round', stage: 'early-facts', curriculumTags: ['MS.Y2.NUM.OP.P3'], keys: [...earlyKeys('turn'), ...earlyKeys('which')], built: true, inWarmUp: false, inAuto: false },
  { id: 'sharing-rows', label: 'Sharing into equal rows', stage: 'early-facts', curriculumTags: ['MS.Y3.NUM.OP.P4'], keys: earlyKeys('share'), built: true, inWarmUp: false, inAuto: false },
  { id: 'cut-arrays', label: 'Cutting an array into known parts', stage: 'early-facts', curriculumTags: ['MS.Y3.NUM.OP.P3'], keys: earlyKeys('cut'), built: true, inWarmUp: false, inAuto: false },
  // Robin's Berry Basket (counting out a set) sits beside the ladder (`inAuto`): the game makes and marks its own questions and only records these keys like any early fact.
  { id: 'count-out-10', label: 'Counting out and counting a set to 10', stage: 'early-facts', curriculumTags: [], keys: [...earlyKeys('give').filter((k) => Number(k.slice(6)) <= 10), ...earlyKeys('howMany')], built: true, inWarmUp: false, inAuto: false },
  { id: 'count-out-20', label: 'Counting out and counting a set to 20', stage: 'early-facts', curriculumTags: [], keys: [...earlyKeys('give').filter((k) => Number(k.slice(6)) > 10), ...earlyKeys('across')], built: true, inWarmUp: false, inAuto: false },
  { id: 'count-on', label: 'One more: counting on from a covered plate', stage: 'early-facts', curriculumTags: [], keys: earlyKeys('countOn'), built: true, inWarmUp: false, inAuto: false },
  ...tablesOfStep(0),
  generated('bonds-100', 'Pairs that make 100', 'place-value', GENERATED_SKILL_KEYS['bonds-100'], 'MS.Y3.NUM.OP.P1'),
  ...tablesOfStep(1),
  generated('round-10-100', 'Rounding to the nearest 10 and 100', 'rounding', GENERATED_SKILL_KEYS['round-10-100'], 'MS.Y3.NUM.NS.P5'),
  generated('bonds-1000', 'Hundreds that make 1000', 'place-value', GENERATED_SKILL_KEYS['bonds-1000']),
  generated('unit-fraction-of', 'A fraction of an amount (⅓ of 15)', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['unit-fraction-of'], 'MS.Y3.NUM.RN.P7'),
  generated('fraction-bonds', 'Fractions that make 1 (⅜ + ⅝)', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['fraction-bonds'], 'MS.Y3.NUM.RN.P6', 'MS.Y3.NUM.RN.K6'),
  ...tablesOfStep(2),
  ...tablesOfStep(3),
  generated('times-tens', 'Times with tens and hundreds (30 × 4)', 'place-value', GENERATED_SKILL_KEYS['times-tens'], 'MS.Y4.NUM.OP.P3'),
  generated('tenths', 'Tenths and decimals of a half', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['tenths'], 'MS.Y4.NUM.RN.P3', 'MS.Y4.NUM.RN.P5'),
  generated('add-tenths', 'Adding and taking away tenths', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['add-tenths'], 'MS.Y4.NUM.RN.P10'),
  generated('round-1000', 'Rounding to the nearest 1000', 'rounding', GENERATED_SKILL_KEYS['round-1000'], 'MS.Y4.NUM.NS.K4'),
  ...tablesOfStep(4),
  generated('factor-pairs', 'Factor pairs', 'place-value', GENERATED_SKILL_KEYS['factor-pairs'], 'MS.Y5.NUM.NS.P2'),
  generated('round-big', 'Rounding decimals', 'rounding', GENERATED_SKILL_KEYS['round-big'], 'MS.Y5.NUM.NS.P3', 'MS.Y5.NUM.NS.P4'),
  generated('decimal-equivalents', 'Fractions as decimals', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['decimal-equivalents'], 'MS.Y5.NUM.RN.P4'),
  generated('decimal-bonds', 'Decimals that make 1 and 10 (0.35 + 0.65)', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['decimal-bonds'], 'MS.Y4.NUM.RN.P10', 'MS.Y5.NUM.RN.P12'),
  generated('percent-basic', '10%, 25% and 50%', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['percent-basic'], 'MS.Y5.NUM.RN.P5', 'MS.Y5.NUM.RN.P15'),
  generated('fraction-of', 'Fractions of an amount (⅔ of 24)', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['fraction-of'], 'MS.Y5.NUM.RN.P13'),
  generated('times-decimals', 'Times 10 and 100 with decimals', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['times-decimals'], 'MS.Y5.NUM.RN.P7'),
  generated('equivalent-fractions', 'Equivalent fractions and simplifying', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['equivalent-fractions'], 'MS.Y5.NUM.RN.P9', 'MS.Y6.NUM.RN.P6'),
  generated('squares-cubes', 'Square and cube numbers', 'place-value', GENERATED_SKILL_KEYS['squares-cubes'], 'MS.Y6.NUM.NS.P6'),
  generated('fdp-equivalents', 'Fractions, decimals and percentages', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['fdp-equivalents'], 'MS.Y6.NUM.RN.P3', 'MS.Y6.NUM.RN.P4'),
  generated('percent-of', 'Percentages of an amount', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['percent-of'], 'MS.Y6.NUM.RN.P13', 'MS.Y6.NUM.RN.P14'),
  generated('whole-from-fraction', 'Finding the whole from a fraction', 'fractions-decimals-percentages', GENERATED_SKILL_KEYS['whole-from-fraction'], 'MS.Y6.NUM.RN.P12'),
  generated('bedmas', 'Order of operations', 'order-of-operations', GENERATED_SKILL_KEYS.bedmas, 'MS.Y6.NUM.OP.P1'),
  // Year 7 and 8 (docs/plans/ladder-7-8/PLAN.md): only past this point for pupils a teacher hasn't stopped at Year 6.
  { ...generated('int-compare', 'Negative numbers in order', 'integers', GENERATED_SKILL_KEYS['int-compare'], 'MS.Y7.NUM.NS.P3', 'MS.Y7.NUM.NS.P4'), year: 7 },
  { ...generated('int-add-sub', 'Adding and taking away across zero', 'integers', GENERATED_SKILL_KEYS['int-add-sub'], 'MS.Y7.NUM.NS.P5', 'MS.Y7.NUM.NS.P6'), year: 7 },
  { ...generated('int-negatives', 'Adding and taking away negatives', 'integers', GENERATED_SKILL_KEYS['int-negatives'], 'MS.Y8.NUM.NS.P7', 'MS.Y8.NUM.NS.P8'), year: 8 },
];

/**
 * Skills that were renamed or taken out (19 Nov 2026: the times-table steps split into one table each, and rounding to a million
 * dropped). Teachers' focuses, placements and furthest places saved before then still name the old ids, so they are read as the
 * new ones. An old id with no new ones (round-million) is just dropped from a focus.
 */
export const FORMER_SKILLS: Readonly<Record<string, { label: string; now: readonly string[] }>> = {
  'tables-2-5-10': { label: 'Times tables: ×2, ×5, ×10', now: ['tables-2', 'tables-5', 'tables-10'] },
  'tables-3-4-8': { label: 'Times tables: ×3, ×4, ×8', now: ['tables-3', 'tables-4', 'tables-8'] },
  'tables-6-9': { label: 'Times tables: ×6, ×9', now: ['tables-6', 'tables-9'] },
  'tables-11-12': { label: 'Times tables: ×11, ×12', now: ['tables-11', 'tables-12'] },
  'round-million': { label: 'Rounding to the nearest million', now: [] },
};

/** Skill ids as they are now: an old id becomes the skills it was split into. Order kept, no repeats. */
export function currentSkillIds(ids: readonly string[]): string[] {
  return [...new Set(ids.flatMap((id) => (Object.hasOwn(FORMER_SKILLS, id) ? FORMER_SKILLS[id].now : [id])))];
}

/**
 * A saved place (placement or furthest) as a skill id now: the first table an old step was split into, or for a dropped skill
 * the one that came after it, so nobody's place moves back.
 */
export function currentPlaceId(id: string): string {
  if (id === 'round-million') return 'fdp-equivalents';
  return Object.hasOwn(FORMER_SKILLS, id) ? FORMER_SKILLS[id].now[0] : id;
}

/** The old ids a skill used to be part of ('tables-6' → ['tables-6-9']), so answers still count for a focus saved with them. */
export function formerIdsOf(id: string): string[] {
  return Object.entries(FORMER_SKILLS).filter(([, f]) => f.now.includes(id)).map(([old]) => old);
}

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
  /**
   * "Stop at Year 6" (James, 24 Nov 2026): the teacher capped this pupil, so Year 7 and 8 skills are off auto for them. They
   * show as 'later', never count, and are never focus, review or stretch. A teacher's focus can still name them.
   */
  capAtYear6?: boolean;
}

/** A Year 7 or 8 skill, left out for a pupil stopped at Year 6. */
export const pastYear6 = (skill: LadderSkill) => (skill.year ?? 0) >= 7;

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
 * Jumping ahead (James, 22 Oct 2026): a student whose records show a times-table skill secure (70% of its times facts in box 2
 * or higher) is past every easier skill below it, even ones they have never been asked: someone who knows ×3, ×4 and ×8 isn't
 * kept on bonds to 10. Only times-table skills count, as they are big (30 to 60 facts) so a lucky run can't do it, and only their
 * times facts, so a class with division off (or a student who hasn't met it yet) jumps all the same. Returns the index just
 * after the highest such skill, or 0.
 */
export function tablesJumpFloor(byKey: ReadonlyMap<string, FactStats>, enabled: readonly number[] = TABLES): number {
  let jump = 0;
  // The tables of a campaign step count together (30 to 60 facts), as they did before each table was its own skill.
  CAMPAIGN_STEPS.forEach((_, step) => {
    const skills = LADDER.filter((s) => s.built && s.tablesStep === step);
    const times = skills.flatMap((s) => activeKeys(s, enabled, false)).filter((k) => k.startsWith('mul:'));
    if (times.length === 0) return;
    const share = times.filter((k) => (byKey.get(k)?.box ?? 0) >= 2).length / times.length;
    if (share >= STEP_SECURE_SHARE) jump = Math.max(jump, ...skills.map((s) => LADDER.indexOf(s) + 1));
  });
  return jump;
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
  const byKey = new Map(foldBondPairs(stats).map((s) => [s.key, s]));
  const enabled = opts.enabledTables ?? TABLES;
  let current: LadderSkill | null = null;
  let secureCount = 0;
  let builtCount = 0;
  const floor = Math.max(opts.floor ?? 0, tablesJumpFloor(byKey, enabled));
  const skills: SkillProgress[] = LADDER.map((skill, index) => {
    if (!skill.built || (opts.capAtYear6 && pastYear6(skill))) return { skill, status: 'later' as const, share: 0 };
    const keys = activeKeys(skill, enabled, opts.division !== false);
    if (keys.length === 0) return { skill, status: 'upcoming' as const, share: 1 };
    const share = keys.filter((k) => (byKey.get(k)?.box ?? 0) >= 2).length / keys.length;
    // A skill beside the ladder is shown as behind the student and never counts.
    if (skill.inAuto === false) return { skill, status: 'secure' as const, share, passedOver: share < STEP_SECURE_SHARE };
    builtCount++;
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
  const live = progress.skills.filter((p) => p.skill.built && p.skill.inAuto !== false && p.status !== 'later').map((p) => ({ ...p, keys: activeKeys(p.skill, enabled, opts.division !== false) })).filter((p) => p.keys.length);
  const at = live.findIndex((p) => p.status === 'current');
  if (at < 0) return { focus: [], review: live.flatMap((p) => p.keys), stretch: [] };
  return { focus: live[at].keys, review: live.slice(0, at).flatMap((p) => p.keys), stretch: live[at + 1]?.keys ?? [] };
}

/**
 * For each review key, how many review keys its skill has, so review can pick a skill first and then a fact from it.
 * A key that belongs to more than one skill counts with the first (easiest) one.
 */
export function reviewSkillSizes(review: readonly string[], opts: LadderOptions = {}): Map<string, number> {
  const enabled = opts.enabledTables ?? TABLES;
  const inReview = new Set(review);
  const sizes = new Map<string, number>();
  for (const skill of LADDER) {
    if (!skill.built) continue;
    const keys = activeKeys(skill, enabled, opts.division !== false).filter((k) => inReview.has(k) && !sizes.has(k));
    for (const k of keys) sizes.set(k, keys.length);
  }
  return sizes;
}

/** The built ladder skills a focus really names, in ladder order. Unknown or not-yet-built names are ignored. */
export function focusSkills(spec: FocusSpec): LadderSkill[] {
  const wanted = new Set(currentSkillIds(spec.skills));
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
  const before = LADDER.slice(0, LADDER.indexOf(chosen[0])).filter((s) => s.built && (s.inAuto !== false || chosen[0].inAuto === false));
  return { focus, review: before.flatMap(keysOf).filter((k) => !mine.has(k)), stretch: [] };
}

/** Which skill pack records a mastery key ("mul:7x8" → "times-tables"), or null if it isn't a ladder key. */
export function packIdOfKey(key: string): 'times-tables' | 'early-facts' | 'add-sub' | 'division' | 'generated' | null {
  if (/^mul:\d+x\d+$/.test(key)) return 'times-tables';
  if (/^(rows|turn|share|cut|which):/.test(key)) return 'early-facts';
  if (isGeneratedKey(key)) return 'generated';
  if (/^eq(miss|swap|both|sub|tf):/.test(key)) return 'early-facts';
  if (/^(give|howmany|counton|across):/.test(key)) return 'early-facts';
  if (/^(bond10|bond20|dbl|half|tenand|tenless|tenup|tendown|skip\d+(?:o\d+|h)?|part\d+|oddeven|place100|read100|tens100|near10|near100|zoom|place1000|read1000|pvbuild3?|pvread3?|pvzero|pvregroup|pvten|pvhun):/.test(key)) return 'early-facts';
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
    // Review gives each skill a fair turn (James, 23 Nov 2026): a key counts as one share of its skill, so skip counting's 78
    // facts come up no more often than order of operations' 7. Within a skill, weaker facts still come up more.
    const skillSize = reviewSkillSizes(pools.review, this.opts);
    const weight = (key: string) => (focus.has(key) ? 1 : (hardTable(key) ? HARD_TABLE_WEIGHT : 1) / (skillSize.get(key) ?? 1));
    const byKey = new Map(this.stats().map((s) => [s.key, s]));
    const picked = pickFromPools(pools, ctx, byKey, this.memory, this.random, weight);
    if (!picked) return null;
    const pack = this.ownerOf(picked.key);
    // Missing-factor questions come in once ×2, ×5 and ×10 (the first campaign step) are behind the student.
    // Under a focus the teacher's own setting decides, else it starts at the first chosen skill after ×2, ×5, ×10.
    let firstTables = -1;
    progress.skills.forEach((p, i) => {
      if (p.skill.tablesStep === 0) firstTables = i;
    });
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
