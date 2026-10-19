/**
 * The teacher's skill map (docs/MATHS-FOCUS-PLAN.md section 9): for each student, a colour for every ladder skill from "not
 * started" to "fluent", grouped into the six stages.
 *
 * Nothing here decides its own rules. A skill's share is the one `ladderProgress` works out (the facts or question types in
 * box 2 or higher, with switched-off tables and division left out), and "secure" is the same 70% as auto, so the map, the
 * student's path and the games always agree. Fluent is the same rule one step up: 70% of the skill's facts or types in the top
 * box (right and quick on two different days).
 */
import { TABLES, TOP_BOX } from './config';
import type { FactStats } from './leitner';
import { activeKeys, LADDER, type LadderProgress, type LadderSkill, type LadderStage, type SkillStatus } from './ladder';
import { placeProgress, type LadderInfo } from './place';
import { STEP_SECURE_SHARE } from './selector';

/** The stages in the order a student meets them, with the words teachers see. */
export const STAGES: readonly { id: LadderStage; label: string }[] = [
  { id: 'early-facts', label: 'Early number facts' },
  { id: 'times-tables', label: 'Times tables' },
  { id: 'place-value', label: 'Place value' },
  { id: 'rounding', label: 'Rounding' },
  { id: 'order-of-operations', label: 'Order of operations' },
  {
    id: 'fractions-decimals-percentages',
    label: 'Fractions, decimals and percentages',
  },
];

export const stageLabel = (id: LadderStage) => STAGES.find((s) => s.id === id)?.label ?? id;

/** The built skills of a stage, in ladder order (the order of a column's skills). */
export const stageSkills = (stage: LadderStage): LadderSkill[] => LADDER.filter((s) => s.stage === stage && s.built);

export const stageOfSkill = (skillId: string): LadderStage | null => LADDER.find((s) => s.id === skillId)?.stage ?? null;

/** 'off' = every table the skill uses is switched off for the class, so it is skipped and not counted. */
export type CellLevel = 'off' | 'not-started' | 'learning' | 'secure' | 'fluent';

/** Words and a one-letter mark for each level, so a colour is never the only clue. */
export const LEVELS: Record<CellLevel, { label: string; mark: string; about: string }> = {
  off: {
    label: 'Switched off',
    mark: '–',
    about: 'its tables are switched off for this class',
  },
  'not-started': { label: 'Not started', mark: '', about: 'not asked yet' },
  learning: {
    label: 'Learning',
    mark: 'L',
    about: 'asked, but fewer than 70% are secure',
  },
  secure: {
    label: 'Secure',
    mark: 'S',
    about: '70% or more are secure (the point auto moves on)',
  },
  fluent: {
    label: 'Fluent',
    mark: 'F',
    about: '70% or more are right and quick on two different days',
  },
};

export interface SkillCell {
  skill: LadderSkill;
  level: CellLevel;
  /** Share of the skill's facts or types in box 2 or higher (0 to 1), as `ladderProgress` works it out. */
  share: number;
  /** Share in the top box (0 to 1). */
  fluentShare: number;
  /** How many facts or types count (switched-off tables left out). */
  keys: number;
  /** How many of those have been asked. */
  asked: number;
  /** Where the student is on the ladder at this skill. */
  status: SkillStatus;
  /** Behind the student's starting point but not really secure in their records. */
  passedOver: boolean;
}

export interface StageCell {
  stage: LadderStage;
  label: string;
  cells: SkillCell[];
  /** Skills that count (not switched off). */
  counted: number;
  /** Counted skills that are secure or fluent. */
  secure: number;
  level: CellLevel;
  /** The student's current skill is in this stage. */
  hasCurrent: boolean;
}

export interface StudentMap {
  stages: StageCell[];
  progress: LadderProgress;
  /** The skill auto is on, or null when every skill that counts is secure. */
  current: LadderSkill | null;
  /** The furthest place kept for them, if any. */
  furthest: LadderSkill | null;
}

export interface MapSettings {
  enabledTables?: readonly number[];
  division?: boolean;
}

const skillById = (id: string | null) => (id ? (LADDER.find((s) => s.id === id) ?? null) : null);

function levelOf(keys: number, asked: number, share: number, fluentShare: number): CellLevel {
  if (keys === 0) return 'off';
  if (asked === 0) return 'not-started';
  if (share >= STEP_SECURE_SHARE) return fluentShare >= STEP_SECURE_SHARE ? 'fluent' : 'secure';
  return 'learning';
}

/** A stage's colour from its skills: all fluent, all secure or better, any asked, or none asked. */
function stageLevel(cells: readonly SkillCell[]): CellLevel {
  const counted = cells.filter((c) => c.level !== 'off');
  if (counted.length === 0) return 'off';
  if (counted.every((c) => c.level === 'fluent')) return 'fluent';
  if (counted.every((c) => c.level === 'secure' || c.level === 'fluent')) return 'secure';
  return counted.some((c) => c.level !== 'not-started') ? 'learning' : 'not-started';
}

/**
 * One student's map. `info` is what the database says about their ladder; the place (where "current" is) is worked out the way
 * the student's own path does it when the class has auto on. With auto off nothing is kept or followed, so there is no floor and
 * "current" is simply the first skill that isn't secure yet.
 */
export function studentMap(stats: Iterable<FactStats>, info: LadderInfo, settings: MapSettings = {}): StudentMap {
  const list = [...stats];
  const byKey = new Map(list.map((s) => [s.key, s]));
  const enabledTables = settings.enabledTables ?? undefined;
  const options = { enabledTables, division: settings.division };
  const progress = placeProgress(
    list,
    info.on
      ? info
      : {
          ...info,
          placed: null,
          placement: null,
          furthest: null,
        },
    options,
  );
  const cells: SkillCell[] = progress.skills.map((p) => {
    const keys = p.skill.built ? activeKeys(p.skill, enabledTables ?? TABLES, settings.division !== false) : [];
    const asked = keys.filter((k) => (byKey.get(k)?.attempts ?? 0) > 0).length;
    const top = keys.filter((k) => (byKey.get(k)?.box ?? 0) >= TOP_BOX).length;
    const share = keys.length ? p.share : 0;
    const fluentShare = keys.length ? top / keys.length : 0;
    return {
      skill: p.skill,
      level: p.skill.built ? levelOf(keys.length, asked, share, fluentShare) : 'not-started',
      share,
      fluentShare,
      keys: keys.length,
      asked,
      status: p.status,
      passedOver: !!p.passedOver,
    };
  });
  const stages: StageCell[] = STAGES.map(({ id, label }) => {
    const mine = cells.filter((c) => c.skill.stage === id && c.skill.built);
    const counted = mine.filter((c) => c.level !== 'off');
    return {
      stage: id,
      label,
      cells: mine,
      counted: counted.length,
      secure: counted.filter((c) => c.level === 'secure' || c.level === 'fluent').length,
      level: stageLevel(mine),
      hasCurrent: !!progress.current && progress.current.stage === id,
    };
  });
  return {
    stages,
    progress,
    current: progress.current,
    furthest: skillById(info.on ? info.furthest : null),
  };
}

/** The same level for every student of a class on one skill, as counts (for the foot of the table). */
export function classCounts(maps: readonly StudentMap[], skillId: string): Record<CellLevel, number> {
  const counts: Record<CellLevel, number> = {
    off: 0,
    'not-started': 0,
    learning: 0,
    secure: 0,
    fluent: 0,
  };
  for (const m of maps) {
    const cell = cellFor(m, skillId);
    if (cell) counts[cell.level]++;
  }
  return counts;
}

/** One student's cell for a skill, or undefined if the skill isn't in the ladder. */
export const cellFor = (map: StudentMap, skillId: string): SkillCell | undefined =>
  map.stages.flatMap((s) => s.cells).find((c) => c.skill.id === skillId);
