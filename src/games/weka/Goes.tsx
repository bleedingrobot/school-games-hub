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
 *  - "Hear it again" reads the question again;
 *  - after every right answer the child fills in the split they used as a part-whole bond (the smaller number on top,
 *    the hops to the big rock and the hops after it below), and Bella says it in full (James, 5 Nov 2026).
 * None of this changes what counts: only the final picks are sent, and the server replays them and records the first
 * pick of each fact. The first step is help only and is never sent.
 */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Tap } from '../../../shared/weka/play';
import type { Friend as FriendName } from '../../../shared/weka/progress';
import { askLine, BOND_MORE, bondAskLine, bondLine, fromTenLine, GOES_PER_ROUND, showRound, stemLine, toTenChoicesFor, toTenLine, type Go, type Help, type Round } from '../../../shared/weka/round';
import type { HelpSetting } from '../../../shared/weka/server';
import { playSound } from '../sounds';
import type { Pose } from './art';
import { backFor, type Scenery } from './Stream';
import { Friend, Hop, StepStone, Stone } from './WekaArt';
import { rightLine } from './voiceLines';
import { WORDS } from './words';

const RIGHT_MS = 1800;
const WOBBLE_MS = 500;
const HOP_MS = 260;
const COUNT_MS = 700;
const GUIDE_MS = 2600;
/** After this many goes in a row with a wrong first tap, full help comes back for the rest of the round. */
const STRUGGLE_GOES = 3;
/**
 * The stones shown: 1 to 20. Every go starts, lands and passes within 5 to 20, so a wide screen shows 5 to 20 in one
 * line; a narrow one shows two rows of ten (1 to 10 ending at the big rock, then 11 to 20), like a twenty-frame.
 */
const STONES = Array.from({ length: 20 }, (_, i) => i + 1);

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

type Phase = 'ask' | 'right' | 'bond' | 'done';
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
  /** The split after a right answer: how many parts are filled in (0, 1, 2), and wrong taps on the current part. */
  const [bond, setBond] = useState(0);
  const [bondWrongs, setBondWrongs] = useState(0);
  const since = useRef(Date.now());
  const timers = useRef<number[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const pathRef = useRef<HTMLDivElement>(null);
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
    say(rightLine(go, shown));
    if (sound) playSound('badge');
    // Show the whole journey: to the big rock (if not there yet), then on.
    const hopOn = () => hopTo(10, go.answer, () => setPose('cheer'));
    if (pos === 10) hopOn();
    else hopTo(go.from, 10, hopOn);
    later(RIGHT_MS + (Math.abs(go.from - go.answer) * HOP_MS), () => {
      setPhase('bond');
      setBond(0);
      setBondWrongs(0);
      say(bondAskLine(go));
    });
  }

  /** Filling in the split: first the hops to the big rock, then the hops after it. Help only: never sent. */
  function pickBond(n: number) {
    if (phase !== 'bond' || bond >= 2) return;
    if (n !== (bond === 0 ? go.toTen : go.rest)) {
      setBondWrongs((w) => w + 1);
      setWobble(n);
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => setWobble(null));
      say(WORDS.tryAgain);
      return;
    }
    if (sound) playSound('tap');
    setBondWrongs(0);
    setBond(bond + 1);
    say(bond === 0 ? BOND_MORE : bondLine(go, true));
  }

  function nextGo() {
    clearTimers();
    if (at + 1 >= goes.length) {
      setPhase('done');
      later(600, () => onDone(taps));
    } else {
      setAt(at + 1);
      setPhase('ask');
      setWrongs(0);
      setFirstWrong(false);
    }
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
  const stem = phase !== 'bond' && (onBigRock || (wrongs >= 2 && step === 'answer') || phase !== 'ask') && shown !== 'none'
    ? go.kind === 'back' ? `${go.total} − ${go.toTen} = 10, then − ${go.rest}` : `${go.big} + ${go.toTen} = 10, then + ${go.rest}`
    : '';
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
      <p className={`wk-stem${stem ? '' : ' wk-stem--empty'}`} aria-live="polite">{stem}</p>
      {/* The hops Weka will make: one group, or split into to-the-rock and after on full help. */}
      {shown !== 'none' && phase !== 'bond' && (
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
      <div className={`wk-scene wk-scene--${shown}${go.kind === 'back' ? ' wk-scene--back' : ''}`} key={at} aria-hidden="true">
        {shown === 'none' && phase === 'ask' ? (
          <div className="wk-water-only">
            <span className="wk-scene__friend wk-scene__friend--bank"><Friend friend={friend} pose={pose} /></span>
          </div>
        ) : (
          <div className="wk-path" ref={pathRef}>
            {STONES.map((n) => {
              const numbered = shown === 'full' || n % 5 === 0 || phase !== 'ask' || toStones.has(n);
              const mark = toStones.has(n) ? 'to' : onStones.has(n) ? 'on' : null;
              return (
                <span key={n} data-n={n} className={`wk-path__spot${n < 5 ? ' wk-path__spot--narrow' : ''}${n === 10 ? ' wk-path__spot--big' : ''}${lit.includes(n) ? ' wk-path__spot--lit' : ''}`}>
                  <StepStone n={n} big={n === 10} shade={(n - 1) % 10 < 5 ? 'light' : 'dark'} number={numbered} mark={mark} />
                  {n === pos && (
                    <span className="wk-scene__friend">
                      <Friend friend={friend} pose={pose} />
                    </span>
                  )}
                </span>
              );
            })}
            {phase === 'bond' && bond > 0 && <Jumps path={pathRef} go={go} shown={bond} />}
          </div>
        )}
      </div>
      {phase === 'bond' ? (
        <Bond go={go} filled={bond} wrongs={bondWrongs} guided={guided} wobble={wobble} last={at + 1 >= goes.length} onPick={pickBond} onNext={nextGo} />
      ) : (
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
      )}
    </div>
  );
}

/**
 * The two jumps of the split drawn under the stones as arrows (James, 5 Nov 2026): orange from the start to the big rock
 * ("+1"), then blue from the big rock to where Weka landed ("+4"), each appearing as its part of the bond is filled in.
 * Measured from the stones, so it works on one line or two rows of ten; a jump across the rows leaves one row and
 * comes in at the start of the next.
 */
function Jumps({ path, go, shown }: { path: React.RefObject<HTMLDivElement | null>; go: Go; shown: number }) {
  const [box, setBox] = useState<{ w: number; h: number; spots: Record<number, { x: number; y: number; w: number; h: number }> } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = path.current;
      if (!el) return;
      const base = el.getBoundingClientRect();
      const spots: Record<number, { x: number; y: number; w: number; h: number }> = {};
      el.querySelectorAll<HTMLElement>('[data-n]').forEach((s) => {
        const step = s.querySelector('.wk-step') ?? s;
        const r = step.getBoundingClientRect();
        if (r.width) spots[Number(s.dataset.n)] = { x: r.left - base.left + r.width / 2, y: r.bottom - base.top, w: r.width, h: r.height };
      });
      setBox({ w: base.width, h: base.height, spots });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [path]);
  if (!box) return null;
  const sign = go.kind === 'back' ? '−' : '+';
  const jumps: { from: number; to: number; size: number; part: 'to' | 'on' }[] = [
    { from: go.from, to: 10, size: go.toTen, part: 'to' },
    { from: 10, to: go.answer, size: go.rest, part: 'on' },
  ].slice(0, shown) as never;
  const arc = (x1: number, x2: number, y: number, depth: number) => `M ${x1} ${y} Q ${(x1 + x2) / 2} ${y + depth * 2} ${x2} ${y}`;
  return (
    <svg className="wk-jumps" width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true">
      <defs>
        {(['to', 'on'] as const).map((p) => (
          <marker key={p} id={`wk-head-${p}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className={`wk-jumps__head--${p}`} />
          </marker>
        ))}
      </defs>
      {jumps.map((j) => {
        const a = box.spots[j.from];
        const b = box.spots[j.to];
        if (!a || !b) return null;
        const depth = Math.max(14, a.h * 0.55);
        const pieces: string[] = [];
        let label = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + depth + 4 };
        if (Math.abs(a.y - b.y) < 4) {
          const y = Math.max(a.y, b.y) - 2;
          pieces.push(arc(a.x, b.x, y, depth));
          label = { x: (a.x + b.x) / 2, y: y + depth + 4 };
        } else {
          // Across the two rows: out past the end of one row, in from the start of the other.
          const forward = j.to > j.from;
          const edgeA = forward ? box.w : 0;
          const edgeB = forward ? 0 : box.w;
          pieces.push(arc(a.x, edgeA, a.y - 2, depth * 0.6));
          pieces.push(arc(edgeB, b.x, b.y - 2, depth));
          label = { x: (edgeB + b.x) / 2, y: b.y - 2 + depth + 4 };
        }
        return (
          <g key={j.part} className={`wk-jumps__jump wk-jumps__jump--${j.part}`}>
            {pieces.map((d, i) => (
              <path key={i} d={d} markerEnd={i === pieces.length - 1 ? `url(#wk-head-${j.part})` : undefined} />
            ))}
            <text x={label.x} y={label.y} dominantBaseline="hanging" textAnchor="middle">{sign}{j.size}</text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The split as a part-whole bond: the smaller number on top, the hops to the big rock (orange, like those stones) and
 * the hops after it (blue) below. The child taps a number for each empty part; after two wrong taps the hand points.
 */
function Bond({ go, filled, wrongs, guided, wobble, last, onPick, onNext }: {
  go: Go; filled: number; wrongs: number; guided: boolean; wobble: number | null; last: boolean;
  onPick: (n: number) => void; onNext: () => void;
}) {
  const target = filled === 0 ? go.toTen : go.rest;
  const pointAt = filled < 2 && (guided || wrongs >= 2) ? target : null;
  const part = (n: number, which: 'to' | 'on', i: number) => (
    <span className={`wk-bond__part wk-bond__part--${which}${filled === i ? ' wk-bond__part--now' : ''}`}>{filled > i ? n : ''}</span>
  );
  return (
    <div className="wk-bond-area">
      <div className="wk-bond" role="img" aria-label={filled >= 2 ? bondLine(go) : WORDS.splitLabel(go.small)}>
        <svg className="wk-bond__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="50" y1="30" x2="22" y2="72" />
          <line x1="50" y1="30" x2="78" y2="72" />
        </svg>
        <span className="wk-bond__whole">{go.small}</span>
        {part(go.toTen, 'to', 0)}
        {part(go.rest, 'on', 1)}
      </div>
      {filled < 2 ? (
        <div className="wk-choices wk-choices--bond" role="group" aria-label={WORDS.pickNumber}>
          {toTenChoicesFor(target).map((n) => (
            <button
              key={`${filled}-${n}`}
              type="button"
              className={`wk-choice${wobble === n ? ' wk-choice--wobble' : ''}${n === pointAt ? ' wk-choice--pointed' : ''}`}
              onClick={() => onPick(n)}
              aria-label={`${n}${n === pointAt ? `, ${WORDS.guideHere}` : ''}`}
            >
              <Stone metal="grey" value={n} />
              {n === pointAt && <span className="wk-hand" aria-hidden="true">👆</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="wk-bond__done">
          <p className="wk-bond__said" aria-live="polite">{bondLine(go)}</p>
          <button type="button" className="wk-button wk-next" onClick={onNext}>{last ? WORDS.finish : WORDS.next} <span aria-hidden="true">➜</span></button>
        </div>
      )}
    </div>
  );
}
