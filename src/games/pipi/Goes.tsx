/**
 * Today's challenge: ten goes on the sand. Each go, a wave washes in and some of the pipi dig down; the child taps the
 * shell with how many are hiding. A right shell lifts the sand and the hiding pipi pop up and wave; a wrong one wobbles
 * back, with no penalty (docs/PIPI-PLAN.md sections 1, 2 and 4).
 *
 * The help fades with the day's colour: on bronze days the pipi sit in a five-frame or ten-frame and the hiding ones
 * leave a dashed outline; on silver days the frame goes and the outlines are faint; on gold days the hiding ones leave
 * no mark at all, so only "7 altogether" and the pipi still showing are there to go on.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Tap } from '../../../shared/pipi/play';
import type { Friend as FriendName, Help } from '../../../shared/pipi/progress';
import { GOES_PER_ROUND, showRound, type Go, type Round } from '../../../shared/pipi/round';
import { playSound } from '../sounds';
import { backFor, PaperLayers, type Scenery } from './Beach';
import { Friend, Hidden, NumberShell, Pipi } from './PipiArt';
import { WORDS } from './words';

/** How long the wave takes to wash in and the pipi to dig down, before the shells can be tapped. */
export const TIDE_MS = 1300;
const RIGHT_MS = 1500;
const WOBBLE_MS = 500;

interface Props {
  round: Round;
  help: Help;
  scenery: Scenery;
  friend: FriendName;
  /** The child's very first challenge: a hand shows them the right shell on the first go. */
  guide?: boolean;
  sound: boolean;
  say: (text: string) => void;
  onDone: (taps: Tap[]) => void;
}

type Phase = 'tide' | 'ask' | 'right' | 'done';
type Spot = 'pipi' | 'hidden' | 'popped' | 'empty';

/**
 * What sits in each spot of the frame for a go. The spots are filled from the left, as in a ten-frame. Two tides: the
 * ones that were showing (on the left) have dug in and the others (on the right) have come up.
 */
function spotsFor(go: Go, phase: Phase, tideIn: boolean): Spot[] {
  const size = go.whole <= 5 ? 5 : 10;
  const spots: Spot[] = Array.from({ length: size }, () => 'empty');
  const answered = phase === 'right' || phase === 'done';
  for (let i = 0; i < go.whole; i++) {
    if (go.kind === 'altogether') spots[i] = i < go.showing ? 'pipi' : 'popped';
    else if (go.kind === 'twoTides') {
      // Before the second tide: the first `before` are showing. After it: the rest are.
      const before = go.before ?? 0;
      const showingNow = phase === 'tide' && !tideIn ? i < before : i >= before;
      spots[i] = showingNow ? 'pipi' : answered ? 'popped' : 'hidden';
    } else {
      const shown = i < go.showing;
      spots[i] = shown || (phase === 'tide' && !tideIn) ? 'pipi' : answered ? 'popped' : 'hidden';
    }
  }
  return spots;
}

export function Goes({ round, help, scenery, friend, guide = false, sound, say, onDone }: Props) {
  const goes = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('tide');
  /** Halfway through the tide: the wave has covered the sand and the pipi have dug in. */
  const [tideIn, setTideIn] = useState(false);
  const [wobble, setWobble] = useState<number | null>(null);
  const since = useRef(Date.now());
  const timers = useRef<number[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);
  // Each go: the wave washes in, then the question is read aloud and the shells can be tapped.
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    setPhase('tide');
    setTideIn(false);
    if (sound) playSound('tap');
    const half = window.setTimeout(() => setTideIn(true), TIDE_MS / 2);
    const ask = window.setTimeout(() => {
      setPhase('ask');
      since.current = Date.now();
      say(guide && at === 0 ? `${goes[0].spoken} ${WORDS.guideStart}` : goes[at].spoken);
    }, TIDE_MS);
    return () => {
      window.clearTimeout(half);
      window.clearTimeout(ask);
    };
    // Only when the go changes, not when the guide ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, goes]);

  const go = goes[Math.min(at, goes.length - 1)];
  const spots = spotsFor(go, phase, tideIn);
  // Gold days (or help off): the hiding ones leave no mark, and the spots close up so the gaps don't give it away.
  const shown = help === 'none' ? spots.filter((s) => s === 'pipi' || s === 'popped') : spots;
  const framed = help === 'full';

  function pick(n: number) {
    if (phase !== 'ask') return;
    const now = Date.now();
    const next = [...taps, { pick: n, ms: now - since.current }];
    since.current = now;
    setTaps(next);
    if (n !== go.answer) {
      setWobble(n);
      say(WORDS.tryAgain);
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => setWobble(null));
      return;
    }
    setPhase('right');
    say(WORDS.yes(n));
    if (sound) playSound('badge');
    later(RIGHT_MS, () => {
      if (at + 1 >= goes.length) {
        setPhase('done');
        later(RIGHT_MS / 2, () => onDone(next));
      } else setAt(at + 1);
    });
  }

  const pointAt = guide && at === 0 && phase === 'ask' ? go.answer : null;
  const done = at + (phase === 'right' || phase === 'done' ? 1 : 0);
  const ask = go.kind === 'altogether' ? WORDS.howManyAltogether : go.kind === 'twoTides' ? WORDS.howManyNow : WORDS.howManyHiding;

  return (
    <div className={`pp-play pp-scene--${scenery}`} style={backFor(scenery)}>
      <PaperLayers />
      <h2 className="pp-sr" tabIndex={-1} ref={heading}>{WORDS.pickShell}</h2>
      <div className="pp-progress" aria-label={WORDS.goesDone(done, GOES_PER_ROUND)}>
        {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
          <span key={i} className={i < done ? 'pp-pip pp-pip--done' : 'pp-pip'} />
        ))}
      </div>
      <div className="pp-sign" aria-live="polite">
        {go.kind === 'altogether' && phase !== 'right' && phase !== 'done' ? (
          // The parts, not the total: the total is the answer.
          <>
            <span className="pp-sign__whole">{WORDS.parts(go.showing, go.hiding)}</span>
            <span className="pp-sign__words">{WORDS.hereAndPopped}</span>
          </>
        ) : (
          <>
            <span className="pp-sign__whole">{go.whole}</span>
            <span className="pp-sign__words">altogether</span>
          </>
        )}
        {phase !== 'tide' && <span className="pp-sign__ask">{ask}</span>}
      </div>
      <div className="pp-stage" key={at}>
        {(phase === 'tide') && <span className={`pp-wave${tideIn ? ' pp-wave--out' : ''}`} aria-hidden="true" />}
        <div
          className={`pp-frame pp-frame--${framed ? (spots.length === 5 ? 'five' : 'ten') : 'row'} pp-frame--${help}`}
          role="img"
          aria-label={
            go.kind === 'altogether'
              ? `${go.showing} pipi here and ${go.hiding} popped up`
              : `${WORDS.altogether(go.whole)}, ${go.showing} showing`
          }
        >
          {shown.map((s, i) => (
            <span key={i} className={`pp-spot pp-spot--${s}${guide && at === 0 && s === 'hidden' ? ' pp-spot--pointed' : ''}`}>
              {s === 'pipi' && <Pipi pose={phase === 'tide' && tideIn ? 'dig' : phase === 'done' ? 'wave' : 'sit'} />}
              {s === 'popped' && <Pipi pose="wave" />}
              {s === 'hidden' && <Hidden outline={help} />}
            </span>
          ))}
        </div>
        <span className="pp-play__friend">
          <Friend friend={friend} pose={phase === 'right' || phase === 'done' ? 'cheer' : 'wait'} />
        </span>
      </div>
      <div className="pp-shells" role="group" aria-label={WORDS.pickShell}>
        {go.choices.map((n, i) => (
          <button
            key={`${at}-${n}`}
            type="button"
            disabled={phase === 'tide'}
            className={`pp-shellbtn${wobble === n ? ' pp-shellbtn--wobble' : ''}${phase !== 'ask' && phase !== 'tide' && n === go.answer ? ' pp-shellbtn--right' : ''}${n === pointAt ? ' pp-shellbtn--pointed' : ''}`}
            style={{ ['--pp-i' as string]: i }}
            onClick={() => pick(n)}
            aria-label={n === pointAt ? `${n}, ${WORDS.guideHere}` : String(n)}
          >
            <NumberShell value={n} />
            {n === pointAt && <span className="pp-hand" aria-hidden="true">👇</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
