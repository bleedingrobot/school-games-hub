/**
 * Choosing the next fact to ask. About 60% come from the current focus tables, 30% review
 * earlier tables (weak facts more often) and 10% stretch into the next table up. Within
 * those, facts in lower mastery boxes come up more often, the last few facts asked are
 * skipped, and a fact answered wrongly comes back 3–6 questions later.
 */
import { AVOID_RECENT, BOX_WEIGHTS, CAMPAIGN_STEPS, MIX, REPEAT_AFTER, TABLES } from './config';
import { factsIn, parseFactKey } from './facts';
import type { FactStats } from './leitner';

/** What the game wants from the next question. */
export interface QuestionContext {
  /** Campaign level: decides the focus, review and stretch tables. */
  level?: number;
  /** Use these focus tables instead of the campaign's (review is then every other enabled table). */
  focusTables?: number[];
  /** Tables the teacher has left on. Default: all 12. */
  enabledTables?: number[];
  /** Missing-factor questions (? × 8 = 56). Default: on from campaign level 4. */
  missingFactor?: boolean;
  /** Division questions (56 ÷ 8 = ?). Default off. */
  division?: boolean;
  /** Four choices to tap instead of typing. Default off. */
  multipleChoice?: boolean;
  /** Only facts in these mastery boxes, when there are any (e.g. [3, 4] for confidence builders). */
  boxes?: number[];
  /** Only the focus tables: no review or stretch (e.g. the Level Key). */
  onlyFocus?: boolean;
}

export type Band = 'focus' | 'review' | 'stretch' | 'repeat';

export interface Pools {
  focus: string[];
  review: string[];
  stretch: string[];
}

/** What the selector remembers within one session. */
export interface SessionMemory {
  /** Questions asked so far. */
  asked: number;
  /** The most recent facts asked, newest last. */
  recent: string[];
  /** Facts answered wrongly, and the question number they come back at. */
  repeats: { key: string; due: number }[];
}

export const newMemory = (): SessionMemory => ({ asked: 0, recent: [], repeats: [] });

function stepIndex(level: number): number {
  const i = CAMPAIGN_STEPS.findIndex((s) => s.levels.includes(level));
  return i >= 0 ? i : level < CAMPAIGN_STEPS[0].levels[0] ? 0 : CAMPAIGN_STEPS.length - 1;
}

/** The focus tables of a campaign level, e.g. [2, 5, 10] for levels 1–2. */
export const campaignTables = (level: number) => CAMPAIGN_STEPS[stepIndex(level)].add;

/** The facts each band draws from, for this context. */
export function poolsFor(ctx: QuestionContext): Pools {
  const enabled = new Set(ctx.enabledTables ?? TABLES);
  const on = (tables: number[]) => tables.filter((t) => enabled.has(t));
  let focusTables: number[];
  let reviewTables: number[];
  let stretchTables: number[];
  let upTo = 12;
  if (ctx.focusTables) {
    focusTables = on(ctx.focusTables);
    reviewTables = on(TABLES.filter((t) => !ctx.focusTables!.includes(t)));
    stretchTables = [];
  } else {
    const step = stepIndex(ctx.level ?? 1);
    focusTables = on(CAMPAIGN_STEPS[step].add);
    reviewTables = on(CAMPAIGN_STEPS.slice(0, step).flatMap((s) => s.add));
    stretchTables = on(CAMPAIGN_STEPS[step + 1]?.add ?? []);
    upTo = CAMPAIGN_STEPS[step].upTo ?? 12;
  }
  const small = (key: string) => parseFactKey(key)!.b <= upTo;
  const focus = new Set([...factsIn(focusTables)].filter(small));
  const review = [...factsIn(reviewTables)].filter((k) => small(k) && !focus.has(k));
  const stretch = [...factsIn(stretchTables)].filter((k) => small(k) && !focus.has(k) && !review.includes(k));
  return { focus: [...focus], review, stretch };
}

/** How likely a fact is to be picked: lower boxes and more mistakes make it likelier. */
export function factWeight(stats: FactStats | undefined): number {
  if (!stats) return BOX_WEIGHTS[0];
  const wrongShare = stats.attempts ? (stats.attempts - stats.correct) / stats.attempts : 0;
  return BOX_WEIGHTS[Math.min(stats.box, BOX_WEIGHTS.length - 1)] * (1 + wrongShare);
}

function weightedPick(keys: string[], stats: Map<string, FactStats>, random: () => number): string {
  const weights = keys.map((k) => factWeight(stats.get(k)));
  let roll = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < keys.length; i++) {
    roll -= weights[i];
    if (roll < 0) return keys[i];
  }
  return keys[keys.length - 1];
}

/**
 * Picks the next fact, and records that it was asked in `memory`. Returns null only when
 * the teacher has switched every table off.
 */
export function pickFact(
  ctx: QuestionContext,
  stats: Map<string, FactStats>,
  memory: SessionMemory,
  random: () => number,
): { key: string; band: Band } | null {
  const pools = poolsFor(ctx);
  const allowed = new Set([...pools.focus, ...pools.review, ...pools.stretch]);
  if (allowed.size === 0) return null;
  memory.asked++;

  const due = memory.repeats.find((r) => r.due <= memory.asked && allowed.has(r.key));
  let choice: { key: string; band: Band };
  if (due) {
    memory.repeats = memory.repeats.filter((r) => r !== due);
    choice = { key: due.key, band: 'repeat' };
  } else {
    const roll = random();
    const wanted: Band = ctx.onlyFocus || roll < MIX.focus ? 'focus' : roll < MIX.focus + MIX.review ? 'review' : 'stretch';
    // An empty band (e.g. no review at level 1) falls back to the others, focus first.
    const order: (keyof Pools)[] = [wanted as keyof Pools, 'focus', 'review', 'stretch'];
    const band = order.find((b) => pools[b].length > 0)!;
    let keys = pools[band];
    if (ctx.boxes) {
      const inBoxes = keys.filter((k) => ctx.boxes!.includes(stats.get(k)?.box ?? 0));
      if (inBoxes.length) keys = inBoxes;
    }
    const recent = new Set(memory.recent.slice(-AVOID_RECENT));
    const fresh = keys.filter((k) => !recent.has(k));
    if (fresh.length) keys = fresh;
    choice = { key: weightedPick(keys, stats, random), band };
  }
  memory.recent = [...memory.recent, choice.key].slice(-10);
  return choice;
}

/** After a wrong answer: ask this fact again 3–6 questions from now (once). */
export function scheduleRepeat(memory: SessionMemory, key: string, random: () => number) {
  if (memory.repeats.some((r) => r.key === key)) return;
  const gap = REPEAT_AFTER.min + Math.floor(random() * (REPEAT_AFTER.max - REPEAT_AFTER.min + 1));
  memory.repeats.push({ key, due: memory.asked + gap });
}
