/**
 * Notes about each question the question box showed: answered, or closed without an answer (a skip). See
 * docs/QUESTION-SKIPS-PLAN.md.
 *
 * The box only notes; where the notes go is set once by the website (src/data/questionLog.ts sends them to the server). In
 * tests and previews nothing is set, so nothing is sent.
 *
 * It also keeps the class's skip rule (stage S.3), which the website sets the same way.
 */
import { useSyncExternalStore } from 'react';

export interface QuestionNote {
  /** The kind of question, e.g. "Pit stop", "Mana Well". */
  spot: string;
  /** True if the box closed without an answer: a skip button, Escape, the time ran out, or the game moved on. */
  skipped: boolean;
  /** How long the question was on screen. */
  ms: number;
}

export type QuestionSink = (note: QuestionNote & { at: number }) => void;

/**
 * A box gone in less time than this was never really seen (React's development double-render, or a game swapping one
 * question straight for another), so it isn't counted as a skip.
 */
export const MIN_SHOWN_MS = 300;

let sink: QuestionSink | null = null;

export function setQuestionSink(next: QuestionSink | null): void {
  sink = next;
}

// Which question boxes are on screen right now (newest last), so "left the page" notes can say a question was open
// (src/data/pageAway.ts). A box adds itself when its question shows and takes itself off when it goes.
const openSpots: string[] = [];

/** A question box's question is showing. Call the returned function when it goes. */
export function questionOpened(spot: string): () => void {
  openSpots.push(spot);
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    const i = openSpots.lastIndexOf(spot);
    if (i >= 0) openSpots.splice(i, 1);
  };
}

/** The kind of question showing now, or null when no question box is open. */
export function openQuestion(): string | null {
  return openSpots.length ? openSpots[openSpots.length - 1] : null;
}

// Right answers in a row, in any game, since the page opened. A wrong answer or a skip starts it again.
let inARow = 0;

/** Counts a marked answer; returns how many right answers in a row there now are. */
export function countAnswer(correct: boolean): number {
  inARow = correct ? inARow + 1 : 0;
  return inARow;
}

/** From this many right answers in a row the question box cheers. */
export const STREAK_FROM = 3;

export function noteQuestion(note: QuestionNote): void {
  if (note.skipped && note.ms >= MIN_SHOWN_MS) inARow = 0;
  if (!sink || (note.skipped && note.ms < MIN_SHOWN_MS)) return;
  try {
    sink({ spot: note.spot, skipped: note.skipped, ms: Math.round(note.ms), at: Date.now() });
  } catch {
    // A note is never worth breaking a game.
  }
}

// ---------------------------------------------------------------------------
// The class's "Skip button" switch (stage S.3): on, 3 per game, or off
// ---------------------------------------------------------------------------
// Set by the website (src/data/questionSkips.ts) from the class's settings, and never for a teacher. In tests and previews
// nothing sets it, so the skip button is always there, as before.

export type SkipMode = 'on' | 'limited' | 'off';

/** With the switch on "3 per game": skips allowed per visit to a game page. */
export const SKIPS_PER_GAME = 3;

/** `canSkip`: a skip button may show. `left`: how many skips are left, when they are limited (null when they aren't). */
export interface SkipRule {
  canSkip: boolean;
  left: number | null;
}

let skipMode: SkipMode = 'on';
let skipsUsed = 0;
let rule: SkipRule = { canSkip: true, left: null };
const ruleWatchers = new Set<() => void>();

function ruleChanged() {
  const left = skipMode === 'limited' ? Math.max(0, SKIPS_PER_GAME - skipsUsed) : null;
  const canSkip = skipMode === 'on' || (skipMode === 'limited' && left! > 0);
  if (rule.canSkip === canSkip && rule.left === left) return;
  rule = { canSkip, left };
  ruleWatchers.forEach((watcher) => watcher());
}

export function setSkipMode(mode: SkipMode): void {
  skipMode = mode;
  ruleChanged();
}

/** A new game page: the skips used start again. */
export function resetSkips(): void {
  skipsUsed = 0;
  ruleChanged();
}

/** Uses one skip, if one may be used now. False means "answer it first". */
export function spendSkip(): boolean {
  if (!rule.canSkip) return false;
  if (skipMode === 'limited') {
    skipsUsed += 1;
    ruleChanged();
  }
  return true;
}

export function skipRule(): SkipRule {
  return rule;
}

/** The rule, kept up to date in a component. */
export function useSkipRule(): SkipRule {
  return useSyncExternalStore(
    (watcher) => {
      ruleWatchers.add(watcher);
      return () => ruleWatchers.delete(watcher);
    },
    skipRule,
    skipRule,
  );
}

/** The kind of question from a box's title: "Power-up pad: Shield" → "Power-up pad"; numbers left out. */
export function spotFromTitle(title: string): string {
  const spot = title.split(':')[0].replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 40).trim();
  return spot || 'Question';
}

// Help me (docs/plans/help-me/PLAN.md, H1): when a pupil opens Help me, the website tells the database, and the answer saved
// next doesn't count (James, 26 Nov 2026: nothing gets ticked off if they ask for help). Set once by the website
// (src/data/questionLog.ts); in tests and previews nothing is set, so nothing is sent.
export interface HelpSink {
  /** Help me was opened on the question showing now. Resolves once the database knows (or gave up). */
  opened: (kind: string) => Promise<void>;
  /** The help opened on this question no longer applies (the box closed without an answer, or the answer was marked). */
  cancelled: () => void;
  /** The pupil's secure facts ("mul:6x7"), so help can start from a fact they know (H2). */
  known?: () => Promise<string[]>;
}

let helpSink: HelpSink | null = null;

export function setHelpSink(next: HelpSink | null): void {
  helpSink = next;
  knownFacts = null;
}

/** Help me was opened. Never rejects, and gives up after `waitMs` so a slow network can't hold up the answer. */
export function helpOpened(kind: string, waitMs = 1500): Promise<void> {
  if (!helpSink) return Promise.resolve();
  const sent = helpSink.opened(kind).catch(() => undefined);
  return Promise.race([sent, new Promise<void>((done) => setTimeout(done, waitMs))]);
}

export function helpCancelled(): void {
  try {
    helpSink?.cancelled();
  } catch {
    // Never worth interrupting a game.
  }
}

let knownFacts: Promise<Set<string>> | null = null;

/** The pupil's secure facts, loaded once per page the first time Help me opens. Empty when nothing is set or it fails. */
export function helpKnownFacts(): Promise<Set<string>> {
  if (!helpSink?.known) return Promise.resolve(new Set());
  knownFacts ??= helpSink
    .known()
    .then((keys) => new Set(keys))
    .catch(() => {
      knownFacts = null;
      return new Set<string>();
    });
  return knownFacts;
}
