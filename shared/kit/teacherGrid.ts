/**
 * Game kit K5 (docs/plans/GAME-KIT-PLAN.md, R7 stage 1): what a teacher needs to see who is stuck, for any set of games.
 * Pure rules, no game words: the caller passes each idea's facts, each game's label and level names, the unit word for a
 * recent-answers flag ("pictures"), and the thresholds (`FlagRules`). Nothing here knows Hop from Weka.
 *
 *  - `ideaLevel`: Not started / Learning / Secure / Fluent for one idea's facts, in the skill map's own words and at its own 70%
 *    (`STEP_SECURE_SHARE`, `TOP_BOX`), so the grid and the skill map never disagree about the same child.
 *  - `stuckFlags`: the small "!" flags with a reason a teacher can read ("5 days on Counting in fives").
 *  - `weakestFacts`: a class's weakest facts among some keys, for "Hardest right now".
 */
import { TOP_BOX } from '../maths/config';
import type { FactStats } from '../maths/leitner';
import { STEP_SECURE_SHARE } from '../maths/selector';
import type { CellLevel } from '../maths/skillMap';

// ---------------------------------------------------------------- one idea's level

export interface IdeaScore {
  level: CellLevel;
  /** Share of the idea's facts in box 2 or higher (0 to 1). */
  share: number;
  /** Share in the top box (0 to 1). */
  fluentShare: number;
  /** Facts of the idea asked at least once. */
  asked: number;
  /** All the idea's facts. */
  keys: number;
  /** Answers over the idea's facts. */
  attempts: number;
  correct: number;
}

/** The skill map's rule (shared/maths/skillMap.ts `levelOf`) for any list of fact keys. No keys at all is 'off'. */
export function ideaLevel(keys: readonly string[], facts: Iterable<FactStats>): IdeaScore {
  const byKey = new Map([...facts].map((f) => [f.key, f]));
  const mine = keys.map((k) => byKey.get(k));
  const asked = mine.filter((f) => (f?.attempts ?? 0) > 0).length;
  const share = keys.length ? mine.filter((f) => (f?.box ?? 0) >= 2).length / keys.length : 0;
  const fluentShare = keys.length ? mine.filter((f) => (f?.box ?? 0) >= TOP_BOX).length / keys.length : 0;
  const level: CellLevel =
    keys.length === 0 ? 'off' : asked === 0 ? 'not-started' : share >= STEP_SECURE_SHARE ? (fluentShare >= STEP_SECURE_SHARE ? 'fluent' : 'secure') : 'learning';
  return {
    level,
    share,
    fluentShare,
    asked,
    keys: keys.length,
    attempts: mine.reduce((n, f) => n + (f?.attempts ?? 0), 0),
    correct: mine.reduce((n, f) => n + (f?.correct ?? 0), 0),
  };
}

// ---------------------------------------------------------------- stuck flags

/** Every threshold in one place (the game passes its own; src/teacher/foundational/config.ts has the first guesses). */
export interface FlagRules {
  /** Days finished at the same level, not the top one, that make "same level too long". */
  sameLevelDays: number;
  /** Wrong taps in one challenge that count as a lot. */
  manyWrongTaps: number;
  /** How many of the latest `guessWindow` challenges need that many wrong taps ("looks like guessing"). */
  guessInWindow: number;
  guessWindow: number;
  /** Idea answers needed, and the share right below which a Learning idea is flagged. */
  lowAccuracyAttempts: number;
  lowAccuracyShare: number;
  /** Counted answers needed, and the share right below which recent answers are flagged. */
  recentAnswers: number;
  recentShare: number;
  /** A pupil who has done this many challenges in all... */
  quietChallenges: number;
  /** ...and has not played for this many school days (Monday to Friday) is "gone quiet". */
  quietSchoolDays: number;
}

export interface Challenge {
  /** The NZ day it was finished, YYYY-MM-DD. */
  day: string;
  /** Wrong taps. */
  wrong: number;
  /** The level or step it was played at, if the game has them. */
  level: number | null;
}

/** One game for one pupil. */
export interface Track {
  /** The game's id and its words ("Hop"). */
  id: string;
  label: string;
  /** Where the pupil is now, and what it is called ("Counting in fives"). Null for a game without levels. */
  level: number | null;
  levelLabel: string | null;
  /** True at the game's highest level, where staying is not being stuck. */
  top: boolean;
  /** Days finished in all, and the last NZ day played. */
  daysDone: number;
  lastDay: string | null;
  /** Latest first. */
  challenges: readonly Challenge[];
}

/** A few answers over a window that are not tied to a level: Quick looks' last pictures. */
export interface Recent {
  id: string;
  label: string;
  /** The word for one answer, plural ("pictures"). */
  unit: string;
  answered: number;
  correct: number;
}

export interface FlagInput {
  tracks: readonly Track[];
  /** Each idea's score with the track (game) it belongs to. */
  ideas: readonly { id: string; label: string; track: string; score: Pick<IdeaScore, 'level' | 'attempts' | 'correct'> }[];
  recents: readonly Recent[];
  /** Today, the NZ day, YYYY-MM-DD. */
  today: string;
}

export type FlagKind = 'same-level' | 'guessing' | 'low-accuracy' | 'recent-accuracy' | 'quiet';

export interface Flag {
  kind: FlagKind;
  /** The track (game) it is about; absent for 'quiet'. */
  track?: string;
  /** In words that say what happened and never "failing". */
  reason: string;
  /** A grey flag, not a warning colour. */
  quiet: boolean;
}

const dayNumber = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000;

/** School days (Monday to Friday, holidays not known) after `from` up to and including `to`. */
export function schoolDaysSince(from: string, to: string): number {
  let n = 0;
  for (let d = dayNumber(from) + 1; d <= dayNumber(to); d++) if (![0, 6].includes(new Date(d * 86_400_000).getUTCDay())) n++;
  return n;
}

const percent = (share: number) => Math.round(share * 100);

/** Every flag for one pupil. No flag means show nothing. */
export function stuckFlags(pupil: FlagInput, rules: FlagRules): Flag[] {
  const flags: Flag[] = [];
  for (const t of pupil.tracks) {
    if (t.level !== null && !t.top) {
      const days = new Set(t.challenges.filter((c) => c.level === t.level).map((c) => c.day)).size;
      if (days >= rules.sameLevelDays) flags.push({ kind: 'same-level', track: t.id, reason: `${t.label}: ${days} days on ${t.levelLabel ?? `level ${t.level}`}`, quiet: false });
    }
    const latest = t.challenges.slice(0, rules.guessWindow);
    const many = latest.filter((c) => c.wrong >= rules.manyWrongTaps).length;
    if (many >= rules.guessInWindow) flags.push({ kind: 'guessing', track: t.id, reason: `${t.label}: many wrong taps in ${many} of the last ${latest.length} challenges`, quiet: false });
  }
  for (const i of pupil.ideas) {
    if (i.score.level === 'learning' && i.score.attempts >= rules.lowAccuracyAttempts && i.score.correct / i.score.attempts < rules.lowAccuracyShare) {
      flags.push({ kind: 'low-accuracy', track: i.track, reason: `${i.label}: ${i.score.correct} of ${i.score.attempts} right`, quiet: false });
    }
  }
  for (const r of pupil.recents) {
    if (r.answered >= rules.recentAnswers && r.correct / r.answered < rules.recentShare) {
      flags.push({ kind: 'recent-accuracy', track: r.id, reason: `${r.label}: under ${percent(rules.recentShare)}% right on the last ${r.answered} ${r.unit}`, quiet: false });
    }
  }
  const played = pupil.tracks.reduce((n, t) => n + t.daysDone, 0);
  const last = pupil.tracks.reduce<string | null>((a, t) => (t.lastDay && (!a || t.lastDay > a) ? t.lastDay : a), null);
  if (last && played >= rules.quietChallenges) {
    const quiet = schoolDaysSince(last, pupil.today);
    if (quiet >= rules.quietSchoolDays) flags.push({ kind: 'quiet', reason: `Not played for ${quiet} school days`, quiet: true });
  }
  return flags;
}

// ---------------------------------------------------------------- the class's weakest facts

export interface WeakFact {
  key: string;
  attempts: number;
  correct: number;
  /** Pupils who have been asked it. */
  students: number;
}

/**
 * The `count` facts among `keys` that the class gets wrong most, ignoring any asked fewer than `minAttempts` times in all (a few
 * answers say too little). Worst share first; the more asked first on a tie.
 */
export function weakestFacts(pupils: Iterable<readonly FactStats[]>, keys: Iterable<string>, opts: { minAttempts: number; count: number }): WeakFact[] {
  const want = new Set(keys);
  const total = new Map<string, WeakFact>();
  for (const facts of pupils) {
    for (const f of facts) {
      if (!want.has(f.key) || f.attempts <= 0) continue;
      const row = total.get(f.key) ?? { key: f.key, attempts: 0, correct: 0, students: 0 };
      row.attempts += f.attempts;
      row.correct += f.correct;
      row.students += 1;
      total.set(f.key, row);
    }
  }
  return [...total.values()]
    .filter((r) => r.attempts >= opts.minAttempts)
    .sort((a, b) => a.correct / a.attempts - b.correct / b.attempts || b.attempts - a.attempts || (a.key < b.key ? -1 : 1))
    .slice(0, opts.count);
}
