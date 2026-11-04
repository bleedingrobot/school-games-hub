/**
 * Today's challenge at Weka's Stepping Stones: ten goes across the stream (docs/WEKA-PLAN.md).
 *
 *  - Adding: "8 + 5". Weka is on stone 8 and hops 5 more. Where does Weka land? (8 and 2 make 10, then 3 more: 13.)
 *  - Smaller first (silver and gold days): "5 + 8". Start on the bigger number.
 *  - Hopping back (gold days): "13 − 5". Weka is on 13 and hops back 5 (3 back to the big rock, then 2 more: 8).
 *
 * The support, all in this screen (plan section 4):
 *  - each go's help comes with it from the server, from the child's record of that fact: 'full' (every stone numbered,
 *    the hops split into two colours, and two steps: first "how many hops to the big rock?", then "where will Weka
 *    land?"), 'faint' (every fifth stone numbered and the big rock, one tap) or 'none' (the sum only); the teacher can
 *    keep it always on or off;
 *  - stones come in fives, light and dark, with the big rock at 10, so the structure of ten shows on the number line;
 *  - hints build after wrong taps: a wobble, then the picture comes back and Bella says the make-ten sentence ("8 and 2
 *    make 10. Then 3 more.") or counts the hops to the big rock with the child, then the hand points;
 *  - after three goes in a row with a wrong first tap, full help comes back for the rest of the round;
 *  - "Hear it again" reads the question again.
 * None of this changes what counts: only the final picks are sent, and the server replays them and records the first
 * pick of each fact. The first step is help only and is never sent.
 */
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Tap } from '../../../shared/weka/play';
import type { Friend as FriendName } from '../../../shared/weka/progress';
import { askLine, fromTenLine, GOES_PER_ROUND, showRound, stemLine, toTenLine, type Go, type Help, type Round } from '../../../shared/weka/round';
import type { HelpSetting } from '../../../shared/weka/server';
import { playSound } from '../sounds';
import type { Pose } from './art';
import { backFor, type Scenery } from './Stream';
import { Friend, Hop, StepStone, Stone } from './WekaArt';
import { WORDS } from './words';

const RIGHT_MS = 1800;
const WOBBLE_MS = 500;
const HOP_MS = 260;
const COUNT_MS = 700;
const GUIDE_MS = 2600;
/** After this many goes in a row with a wrong first tap, full help comes back for the rest of the round. */
const STRUGGLE_GOES = 3;
/** The stretch of stream shown: every go starts, lands and passes within 5 to 20. */
const FIRST = 5;
const LAST = 20;
const STONES = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i);

const MORE: Record<Help, Help> = { none: 'faint', faint: 'full', full: 'full' };

/** The teacher's setting on top of the go's own help. */
export const helpFor = (go: Help, setting: HelpSetting): Help => (setting === 'always' ? 'full' : setting === 'off' ? 'none' : go);

interface Props {
  round: Round;
  /** The class's help setting. */
  setting: HelpSetting;
  scenery: Scenery;
  friend: FriendName;
  /** The child's very first challenge: a hand shows them the way on the first go. */
  guide?: boolean;
  sound: boolean;
  say: (text: string) => void;
  onDone: (taps: Tap[]) => void;
}

type Phase = 'ask' | 'right' | 'done';
type Step = 'toTen' | 'answer';

/** The stones between two numbers, not counting the first: 8 → 10 is [9, 10]; 13 → 10 is [12, 11, 10]. */
const between = (from: number, to: number) => {
  const out: number[] = [];
  for (let n = from; n !== to; ) {
    n += to > from ? 1 : -1;
    out.push(n);
  }
  return out;
};

export function Goes({ round, setting, scenery, friend, guide = false, sound, say, onDone }: Props) {
  const goes = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [step, setStep] = useState<Step>('answer');
  const [wobble, setWobble] = useState<number | null>(null);
  /** Wrong taps on this step: 1 wobble, 2 the picture and Bella's sentence, 3 the hand. */
  const [wrongs, setWrongs] = useState(0);
  const [firstWrong, setFirstWrong] = useState(false);
  /** Goes in a row with a wrong first tap, and whether full help has come back for the round. */
  const [streak, setStreak] = useState(0);
  const [boost, setBoost] = useState(false);
  /** Where Weka stands, and the stones lit by counting together. */
  const [pos, setPos] = useState(0);
  const [lit, setLit] = useState<number[]>([]);
  const [pose, setPose] = useState<Pose>('wait');
  const [guidePoint, setGuidePoint] = useState(false);
  const since = useRef(Date.now());
  const timers = useRef<number[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const go: Go = goes[Math.min(at, goes.length - 1)];
  const guided = guide && at === 0;
  const start: Help = boost || guided ? 'full' : helpFor(go.h, setting);
  const twoStep = start === 'full';
  const shown: Help = wrongs >= 2 ? MORE[start] : start;

  /** Weka hops stone by stone to `to`. */
  function hopTo(from: number, to: number, then?: () => void) {
    const path = between(from, to);
    setPose('hop');
    path.forEach((n, i) => later(i * HOP_MS, () => setPos(n)));
    later(path.length * HOP_MS + 60, () => {
      setPose('land');
      then?.();
    });
  }

  // Each new go is read aloud once and Weka waits on the starting stone.
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    since.current = Date.now();
    const s: Step = twoStep ? 'toTen' : 'answer';
    setStep(s);
    setPos(go.from);
    setPose('wait');
    setLit([]);
    setGuidePoint(false);
    say(s === 'toTen' ? toTenLine(go, guided) : askLine(go, guided));
    if (guided) later(GUIDE_MS, () => setGuidePoint(true));
    // Read again only when the go changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, goes]);

  /** Bella counts the hops to the big rock with the child, lighting each stone. */
  function countTogether() {
    const path = between(go.from, 10);
    setLit([]);
    say(WORDS.countWithMe);
    path.forEach((n, i) =>
      later(1500 + i * COUNT_MS, () => {
        setLit((l) => [...l, n]);
        say(WORDS.yes(i + 1));
      }),
    );
  }

  function wrong(n: number) {
    const w = wrongs + 1;
    setWrongs(w);
    if (!firstWrong) {
      setFirstWrong(true);
      const s = streak + 1;
      setStreak(s);
      if (s >= STRUGGLE_GOES) setBoost(true);
    }
    setWobble(n);
    if (sound) playSound('tap');
    later(WOBBLE_MS, () => setWobble(null));
    if (w === 2) {
      if (step === 'toTen') countTogether();
      else {
        setLit(between(go.from, 10));
        say(stemLine(go));
      }
    } else say(WORDS.tryAgain);
  }

  function pick(n: number) {
    if (phase !== 'ask') return;
    if (step === 'toTen') {
      // Help only: never sent, never recorded.
      if (n !== go.toTen) return wrong(n);
      clearTimers();
      setWrongs(0);
      setGuidePoint(false);
      setLit([]);
      if (sound) playSound('tap');
      hopTo(go.from, 10, () => {
        setStep('answer');
        since.current = Date.now();
        say(fromTenLine(go));
        if (guided) later(GUIDE_MS, () => setGuidePoint(true));
      });
      return;
    }
    const now = Date.now();
    const next = [...taps, { pick: n, ms: now - since.current }];
    since.current = now;
    setTaps(next);
    if (n !== go.answer) return wrong(n);
    if (!firstWrong) setStreak(0);
    clearTimers();
    setPhase('right');
    say(WORDS.yes(n));
    if (sound) playSound('badge');
    // Show the whole journey: to the big rock (if not there yet), then on.
    const hopOn = () => hopTo(10, go.answer, () => setPose('cheer'));
    if (pos === 10) hopOn();
    else hopTo(go.from, 10, hopOn);
    later(RIGHT_MS + (Math.abs(go.from - go.answer) * HOP_MS), () => {
      if (at + 1 >= goes.length) {
        setPhase('done');
        later(600, () => onDone(next));
      } else {
        setAt(at + 1);
        setPhase('ask');
        setWrongs(0);
        setFirstWrong(false);
      }
    });
  }

  const choices = step === 'toTen' ? go.toTenChoices : go.choices;
  const target = step === 'toTen' ? go.toTen : go.answer;
  const pointAt = phase === 'ask' && ((guided && guidePoint) || wrongs >= 3) ? target : null;
  const made = at + (phase === 'ask' ? 0 : 1);
  const style = { ...backFor(scenery) } as CSSProperties;
  const sign = go.kind === 'back' ? '−' : '+';
  const onBigRock = pos === 10 && step === 'answer';
  const ask = step === 'toTen'
    ? `${go.parts.join(' ').replace(' = ?', '')}: how many hops to 10?`
    : go.parts.join(' ');
  /** The stones on the way to the big rock, shown once Weka has hopped there or a hint lights them. */
  const toStones = new Set(onBigRock || phase !== 'ask' ? between(go.from, 10) : lit);
  const onStones = new Set(phase !== 'ask' ? between(10, go.answer) : []);

  return (
    <div className={`wk-play wk-stream--${scenery}`} style={style}>
      <h2 className="wk-sr" tabIndex={-1} ref={heading}>{WORDS.pickNumber}</h2>
      <div className="wk-top">
        <div className="wk-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
          {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
            <span key={i} className={i < made ? 'wk-pip wk-pip--done' : 'wk-pip'} />
          ))}
        </div>
        <button type="button" className="wk-button" onClick={() => say(step === 'toTen' ? toTenLine(go) : onBigRock ? fromTenLine(go) : askLine(go))}>
          <span aria-hidden="true">👂</span> {WORDS.hearAgain}
        </button>
      </div>
      <p className="wk-ask" aria-live="polite">{ask}</p>
      {/* The make-ten sentence, once Weka is on the big rock or a hint has said it. */}
      <p className="wk-stem" aria-live="polite">
        {(onBigRock || (wrongs >= 2 && step === 'answer') || phase !== 'ask') && shown !== 'none'
          ? go.kind === 'back'
            ? `${go.total} − ${go.toTen} = 10, then − ${go.rest}`
            : `${go.big} + ${go.toTen} = 10, then + ${go.rest}`
          : ' '}
      </p>
      {/* The hops Weka will make: one group, or split into to-the-rock and after on full help. */}
      {shown !== 'none' && (
        <div className="wk-hops" aria-hidden="true">
          <span className="wk-hops__label">{sign}{go.small}</span>
          {Array.from({ length: go.small }, (_, i) => (
            <Fragment key={i}>
              {shown === 'full' && i === go.toTen && <span className="wk-hops__gap" />}
              <Hop part={shown === 'full' && i >= go.toTen ? 'on' : 'to'} />
            </Fragment>
          ))}
        </div>
      )}
      <div className={`wk-scene wk-scene--${shown}`} key={at} aria-hidden="true">
        {shown === 'none' && phase === 'ask' ? (
          <div className="wk-water-only">
            <span className="wk-scene__friend wk-scene__friend--bank"><Friend friend={friend} pose={pose} /></span>
          </div>
        ) : (
          <div className="wk-path">
            {STONES.map((n) => {
              const numbered = shown === 'full' || n % 5 === 0 || phase !== 'ask' || toStones.has(n);
              const mark = toStones.has(n) ? 'to' : onStones.has(n) ? 'on' : null;
              return (
                <span key={n} className={`wk-path__spot${n === 10 ? ' wk-path__spot--big' : ''}${lit.includes(n) ? ' wk-path__spot--lit' : ''}`}>
                  <StepStone n={n} big={n === 10} shade={(n - 1) % 10 < 5 ? 'light' : 'dark'} number={numbered} mark={mark} />
                </span>
              );
            })}
            <span className="wk-scene__friend" style={{ left: `${((pos - FIRST + 0.5) / STONES.length) * 100}%` }}>
              <Friend friend={friend} pose={pose} />
            </span>
          </div>
        )}
      </div>
      <div className="wk-choices" role="group" aria-label={WORDS.pickNumber}>
        {choices.map((n) => (
          <button
            key={`${at}-${step}-${n}`}
            type="button"
            className={`wk-choice${wobble === n ? ' wk-choice--wobble' : ''}${phase !== 'ask' && n === go.answer ? ' wk-choice--right' : ''}${n === pointAt ? ' wk-choice--pointed' : ''}`}
            onClick={() => pick(n)}
            aria-label={`${n}${n === pointAt ? `, ${WORDS.guideHere}` : ''}`}
          >
            <Stone metal="grey" value={n} />
            {n === pointAt && <span className="wk-hand" aria-hidden="true">👆</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
