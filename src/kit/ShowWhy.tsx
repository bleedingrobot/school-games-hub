/**
 * Game kit: the show-why screen (docs/LEARNING-DESIGN.md rule 7, maths review R5), lifted from Kiwi's Beanstalk.
 * No game words inside. The game passes its lines, its picture (the model drawn for this mistake), its CSS prefix and its
 * `say` (which plays the game's own clip folder, e.g. public/voice/<game>/, and falls back to the browser voice).
 * The prefix names the classes: `${prefix}-why`, `${prefix}-why--look`, `${prefix}-why--try`, `${prefix}-why__title`
 * and, for the skip button, `${prefix}-hear`. The rules for the flow are in shared/kit/mistakes.ts.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface WhyProps {
  /** The game's CSS prefix, e.g. 'bs'. */
  prefix: string;
  /** The model that shows the mistake: frames joined, fish counted, a number line. */
  picture: ReactNode;
  /** The why-line, also read aloud by the game. */
  line: string;
  /** Changes with each wrong tap, so the screen animates in again. */
  tapKey: string | number;
}

/** After the first wrong tap of a go: the picture and the line, until the next tap. */
export function ShowWhy({ prefix, picture, line, tapKey }: WhyProps) {
  return (
    <div className={`${prefix}-why`} role="status" key={tapKey}>
      {picture}
      <p>{line}</p>
    </div>
  );
}

interface LookProps {
  prefix: string;
  /** "Let's look together." */
  title: string;
  picture: ReactNode;
  /** The full explanation, read aloud while the picture fills. */
  line: string;
  /** Said on the skip button once it shows. */
  skipLabel: string;
  canSkip: boolean;
  onSkip: () => void;
}

/** The second wrong tap of a go: "Let's look together" with the picture filling in. */
export function LookTogether({ prefix, title, picture, line, skipLabel, canSkip, onSkip }: LookProps) {
  return (
    <div className={`${prefix}-why ${prefix}-why--look`} role="status">
      <p className={`${prefix}-why__title`}>{title}</p>
      {picture}
      <p>{line}</p>
      {canSkip && (
        <button type="button" className={`${prefix}-hear`} onClick={onSkip}>
          {skipLabel}
        </button>
      )}
    </div>
  );
}

/** After "Let's look together": "Now you try", until the go is right. */
export function NowYouTry({ prefix, line }: { prefix: string; line: string }) {
  return <p className={`${prefix}-why ${prefix}-why--try`}>{line}</p>;
}

// ---------------------------------------------------------------- the look-together timing

const FILL_STEP_MS = 450;
const START_FALLBACK_MS = 1800;
const SKIP_AFTER_MS = 3000;
const LONGEST_MS = 12000;
const SETTLE_MS = 700;
/** Counting aloud: the wait per berry, a child's pace, not a voice-over's. */
const COUNT_STEP_MS = 1500;
/** Counting aloud: how long the explanation may take before the count starts anyway (voice off or slow). */
const COUNT_START_MS = 3000;
/** Counting with `waitForVoice`: the pause after a step's line before the next step. */
const STEP_PAUSE_MS = 500;
/** How long `endLine` may take before the look ends anyway. */
const END_LINE_MS = 9000;

/** What "Let's look together" is showing: `filled` of the steps so far (a dot of the partner every so often). */
export interface Look {
  anchor: number;
  filled: number;
  canSkip: boolean;
}

export interface LookRun {
  /** Which choice the look is about (a leaf, a shell): the game says what it means. */
  anchor: number;
  /** How many steps fill in, one every 0.45 seconds (the dots of the partner, the fish counted). */
  steps: number;
  /** "Let's look together." */
  openingLine: string;
  /** The full explanation. */
  fillLine: string;
  /**
   * Counting aloud (optional): after the explanation has been said, the steps fill one at a time, `stepMs` apart, and each is said
   * with `stepLine(k)` (k from 1) as it appears. Without it the steps fill every 0.45 seconds while the explanation is said.
   */
  stepLine?: (k: number) => string;
  /** The wait between two counted steps when `stepLine` is given (default 1500). */
  stepMs?: number;
  /**
   * With `stepLine`: each step waits for its line to be said (and at least `stepMs`, with a short pause after the voice), so a
   * step can be a whole sentence ("This side has eight stones."), not only a number.
   */
  waitForVoice?: boolean;
  /** With `stepLine`: how long the explanation may take before the count starts anyway (default 3000). */
  countStartMs?: number;
  /** With `stepLine`: said once the count is over, before the look ends ("Now it is level."). */
  endLine?: string;
  /** Runs once when the look ends (by itself or skipped): the game moves to "Now you try". */
  onEnd: () => void;
}

/**
 * The timing of "Let's look together": say the opening line, then the explanation while the steps fill one by one, then
 * a short pause and `onEnd`. The child can skip after 3 seconds; if the voice never finishes, it still ends after 12.
 * Late timers and voice callbacks from an earlier look do nothing.
 */
export function useLookTogether(say: (text: string, onEnd?: () => void) => void) {
  const [look, setLook] = useState<Look | null>(null);
  const run = useRef(0);
  const timers = useRef<number[]>([]);
  const skip = useRef<() => void>(() => {});

  useEffect(() => {
    const pending = timers.current;
    return () => {
      run.current++;
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const start = useCallback(
    ({ anchor, steps, openingLine, fillLine, stepLine, stepMs = COUNT_STEP_MS, waitForVoice = false, countStartMs = COUNT_START_MS, endLine, onEnd }: LookRun) => {
      const me = ++run.current;
      const live = () => run.current === me;
      const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
      let said = false;
      let filled = false;
      let started = false;
      const end = () => {
        if (!live()) return;
        run.current++;
        setLook(null);
        onEnd();
      };
      const endIfDone = () => {
        if (said && filled) later(SETTLE_MS, end);
      };
      const countAloud = (line: (k: number) => string) => {
        let counting = false;
        const finish = () => {
          said = true;
          filled = true;
          if (live()) endIfDone();
        };
        const closing = () => {
          if (!live()) return;
          if (!endLine) return finish();
          let done = false;
          const once = () => {
            if (done) return;
            done = true;
            finish();
          };
          say(endLine, () => live() && once());
          later(END_LINE_MS, once); // the voice is slow: end anyway
        };
        const stepAt = (d: number) => {
          if (!live()) return;
          setLook((l) => l && { ...l, filled: d });
          let moved = false;
          const began = Date.now();
          const next = () => {
            if (moved || !live()) return;
            moved = true;
            if (d < steps) stepAt(d + 1);
            else closing();
          };
          say(line(d), () => live() && later(Math.max(STEP_PAUSE_MS, stepMs - (Date.now() - began)), next));
          later(stepMs * 4, next); // the voice never finished: move on anyway
        };
        const count = () => {
          if (!live() || counting) return;
          counting = true;
          if (waitForVoice) return stepAt(1);
          for (let d = 1; d <= steps; d++) {
            later((d - 1) * stepMs, () => {
              if (!live()) return;
              setLook((l) => l && { ...l, filled: d });
              say(line(d));
            });
          }
          later((steps - 1) * stepMs + stepMs, () => live() && closing());
        };
        say(fillLine, () => live() && later(400, count));
        later(countStartMs, count); // the voice is off or slow: count anyway
      };
      const fill = () => {
        if (!live() || started) return;
        started = true;
        if (stepLine) return countAloud(stepLine);
        say(fillLine, () => {
          said = true;
          if (live()) endIfDone();
        });
        for (let d = 1; d <= steps; d++) later(d * FILL_STEP_MS, () => live() && setLook((l) => l && { ...l, filled: d }));
        later(steps * FILL_STEP_MS + 300, () => {
          filled = true;
          if (live()) endIfDone();
        });
      };
      setLook({ anchor, filled: 0, canSkip: false });
      say(openingLine, fill);
      later(START_FALLBACK_MS, fill); // the voice is off or slow: count anyway
      later(SKIP_AFTER_MS, () => live() && setLook((l) => l && { ...l, canSkip: true }));
      const counted = stepLine ? countStartMs + steps * stepMs * (waitForVoice ? 4 : 1) + (endLine ? END_LINE_MS : 0) : 0;
      later(LONGEST_MS + counted, end);
      skip.current = end;
    },
    [say],
  );

  return { look, start, skip: () => skip.current() };
}
