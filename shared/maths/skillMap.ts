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
import { foldBondPairs } from './skillPacks/bondPairs';
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
  // Bonds to 100 and 1000 have one record per pair as well as the old one: a stand-in old record says what the pairs add up to.
  const byKey = new Map(foldBondPairs(list).map((s) => [s.key, s]));
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

/**
 * The skills a class is using, in ladder order: every skill a pupil has been asked or is on now, plus the next skill on the
 * ladder after the furthest pupil's current one. Skills switched off for every pupil are left out. The teacher's Skill map shows
 * these by default, so a class sees its own few skills rather than all 62.
 */
export function skillsInUse(maps: readonly StudentMap[]): Set<string> {
  const used = new Set<string>();
  let furthest = -1;
  let path: readonly LadderSkill[] = [];
  for (const m of maps) {
    for (const cell of m.stages.flatMap((s) => s.cells)) if (cell.asked > 0 && cell.level !== 'off') used.add(cell.skill.id);
    if (!m.current) continue;
    used.add(m.current.id);
    const skills = m.progress.skills.map((p) => p.skill);
    const at = skills.findIndex((s) => s.id === m.current!.id);
    if (at > furthest) {
      furthest = at;
      path = skills;
    }
  }
  const next = path.slice(furthest + 1).find((s) => s.built && s.inAuto !== false && maps.some((m) => cellFor(m, s.id)?.level !== 'off'));
  if (next) used.add(next.id);
  return used;
}

/** "Who needs a look" on the Skill map. The numbers are guesses a teacher can trust at a glance, not marks. */
export const NEARLY_SHARE = 0.5;
/** Answers per fact asked, on average, before a low share counts as finding it hard. */
export const HARD_PER_FACT = 6;
export const HARD_SHARE = 0.4;
export const BEHIND_SKILLS = 3;
export const QUIET_DAYS = 7;
export const STUCK_DAYS = 14;

export type Look = 'stuck' | 'nearly' | 'hard' | 'behind' | 'quiet';
export const LOOKS: readonly Look[] = ['stuck', 'nearly', 'hard', 'behind', 'quiet'];

/** How far along the ladder a pupil is: the place of their current skill on their path (past the end when all secure, 0 when nothing is). */
export function ladderPlace(map: StudentMap): number {
  const skills = map.progress.skills;
  if (!map.current) return map.progress.secureCount > 0 ? skills.length : 0;
  return skills.findIndex((p) => p.skill.id === map.current!.id);
}

/** The middle pupil's place: half the class is at or behind it. */
export function classMiddle(maps: readonly StudentMap[]): number {
  const places = maps.map(ladderPlace).sort((a, b) => a - b);
  return places.length ? places[Math.floor((places.length - 1) / 2)] : 0;
}

/**
 * Which looks a pupil needs. Nearly: half or more of their current skill is secure. Finding it hard: 6 or more answers per fact asked
 * on average and under 40% secure. Behind the class: 3 or more skills before the middle pupil. Gone quiet: answered ladder maths before, but not in
 * the last 7 days. Stuck: on a Learning skill for 14 days or more (only known for facts first answered from 12 Nov 2026).
 */
export function pupilLooks(map: StudentMap, facts: readonly FactStats[], middle: number, now: number): Set<Look> {
  const looks = new Set<Look>();
  const cell = map.current ? cellFor(map, map.current.id) : undefined;
  const since = nowSince(map, facts);
  if (cell && cell.level === 'learning' && since !== null && now - since >= STUCK_DAYS * 86_400_000) looks.add('stuck');
  if (cell && cell.level === 'learning') {
    const keys = new Set(cell.skill.keys);
    const asked = facts.filter((f) => keys.has(f.key) && f.attempts > 0);
    const perFact = asked.length ? asked.reduce((n, f) => n + f.attempts, 0) / asked.length : 0;
    if (cell.share >= NEARLY_SHARE) looks.add('nearly');
    else if (perFact >= HARD_PER_FACT && cell.share < HARD_SHARE) looks.add('hard');
  }
  if (middle - ladderPlace(map) >= BEHIND_SKILLS) looks.add('behind');
  const last = facts.reduce((m, f) => Math.max(m, f.attempts > 0 ? f.lastSeen : 0), 0);
  if (last > 0 && now - last > QUIET_DAYS * 86_400_000) looks.add('quiet');
  return looks;
}

/** The skill most pupils are on now, and how many. */
export function mostAreOn(maps: readonly StudentMap[]): { skill: LadderSkill; pupils: number } | null {
  const counts = new Map<string, { skill: LadderSkill; pupils: number }>();
  for (const m of maps) {
    if (!m.current) continue;
    const c = counts.get(m.current.id) ?? { skill: m.current, pupils: 0 };
    c.pupils++;
    counts.set(m.current.id, c);
  }
  let best: { skill: LadderSkill; pupils: number } | null = null;
  for (const c of counts.values()) if (!best || c.pupils > best.pupils) best = c;
  return best;
}

/**
 * When the pupil first met their current skill: the earliest first answer among its facts, or null when none of them has a
 * first-answer time (facts first answered before 12 Nov 2026, when the time started being kept).
 */
export function nowSince(map: StudentMap, facts: readonly FactStats[]): number | null {
  if (!map.current) return null;
  const keys = new Set(map.current.keys);
  const asked = facts.filter((f) => keys.has(f.key) && f.attempts > 0);
  if (asked.length === 0 || asked.some((f) => !f.firstSeen)) return null;
  return Math.min(...asked.map((f) => f.firstSeen!));
}
