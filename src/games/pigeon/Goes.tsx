/**
 * Today's challenge at Pigeon's Number Line: ten goes on the berry branch (docs/PIGEON-PLAN.md).
 *
 *  - Place: tap where a number goes on the line (a lens on the zoom steps).
 *  - Read: what number is at the arrow? Four number cards.
 *  - Ten more, ten less: four number cards.
 *  - Closer: which of the two posts is nearer? Two cards.
 *
 * Each go comes with its help level from the server (marksFor): 5 every number marked, down to 0 the two ends. A wrong tap
 * shows why (ShowWhy), a second one is "Let's look together" (LookTogether, the branch with every number marked and Bella
 * naming the two marks either side), then "Now you try". The answer is never shown or said before the child has found it.
 * Only the taps are sent; the server replays them.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { NumberLine, type Landmark, type LinePoint, type NumberLineProps } from '../../kit';
import { HearAgain } from '../../kit/HearAgain';
import { PointingHand } from '../../kit/PointingHand';
import { useGuidedFirstGo } from '../../kit/useGuidedFirstGo';
import { LookTogether, NowYouTry, ShowWhy, useLookTogether } from '../../kit/ShowWhy';
import { stepGo, NEW_GO, type GoState } from '../../../shared/kit/mistakes';
import { tapRight, type Tap } from '../../../shared/pigeon/play';
import type { Friend as FriendName } from '../../../shared/pigeon/progress';
import { GOES_PER_ROUND, marksFor, pictureFor, showRound, tapValue, type Go, type HelpLevel, type Round } from '../../../shared/pigeon/round';
import { playSound } from '../sounds';
import { Friend, sceneStyle, type Pose, type Scenery } from './art';
import { PLACE_LINES, SLIP_LINES, askLine, lookLine } from './voiceLines';
import { WORDS } from './words';

const RIGHT_MS = 1900;
const WOBBLE_MS = 500;

type Phase = 'ask' | 'right' | 'done';

/** The very first go: after this long without a tap the hand points at the line. */
const GUIDE_MS = 2600;

interface Props {
  /** The child's very first challenge: the hand points at the line on the first go if nothing is tapped. */
  guided?: boolean;
  round: Round;
  scenery: Scenery;
  friend: FriendName;
  sound: boolean;
  say: (text: string, onEnd?: () => void) => void;
  onDone: (taps: Tap[]) => void;
}

const permilleOf = (go: Go, value: number) => Math.min(1000, Math.max(0, Math.round(((value - go.lo) / (go.hi - go.lo)) * 1000)));

/** The kit line for a go at a help level, with the extra marks and points a screen wants. */
function lineFor(go: Go, level: HelpLevel, points: LinePoint[], extraMarks: Landmark[] = []): Omit<NumberLineProps, 'label'> {
  const mainMarks = marksFor(level, 0, go.max);
  const toLandmarks = (named: number[]): Landmark[] => named.map((value) => ({ value }));
  const tickStep = (ticks: number[]) => (ticks.length > 1 ? ticks[1] - ticks[0] : undefined);
  const posts: Landmark[] = go.posts ? go.posts.map((value) => ({ value })) : [];
  const landmarks = dedupe([...toLandmarks(mainMarks.named), ...posts, ...(go.lens ? [] : extraMarks)]);
  const props: Omit<NumberLineProps, 'label'> = { min: 0, max: go.max, step: tickStep(mainMarks.ticks), landmarks };
  if (go.lens) {
    const lensMarks = marksFor(level, go.lens.lo, go.lens.hi);
    props.lens = {
      from: go.lens.lo,
      to: go.lens.hi,
      step: tickStep(lensMarks.ticks),
      landmarks: dedupe([...toLandmarks(lensMarks.named), ...extraMarks]),
      points,
    };
  } else props.points = points;
  return props;
}

const dedupe = (marks: Landmark[]): Landmark[] => [...new Map(marks.map((m) => [m.value, m])).values()];

export function Goes({ guided = false, round, scenery, friend, sound, say, onDone }: Props) {
  const goes = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [gs, setGs] = useState<GoState>(NEW_GO);
  const [tapped, setTapped] = useState<number[]>([]);
  const [lastSlip, setLastSlip] = useState<string | null>(null);
  const [whyTap, setWhyTap] = useState(0);
  const [wobble, setWobble] = useState<number | null>(null);
  const [peek, setPeek] = useState(false);
  const [pose, setPose] = useState<Pose>('sit');
  const since = useRef(Date.now());
  /** Set by the first tap on this question, so the end of its read-aloud no longer restarts the clock. */
  const tappedYet = useRef(false);
  const timers = useRef<number[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);
  const { look, start: startLook, skip } = useLookTogether(say);
  const guideHand = useGuidedFirstGo(guided && at === 0, GUIDE_MS);

  const go: Go = goes[Math.min(at, goes.length - 1)];
  const wrongs = gs.wrong;
  const pic = pictureFor(go, wrongs, tapped);
  const canPeek = go.l === 1 && round.help !== 'off' && pic.level <= 1;
  const level: HelpLevel = pic.level <= 1 && (pic.peekOpen || peek) ? 3 : pic.level;
  const seen: HelpLevel = gs.phase === 'look' || gs.phase === 'redo' ? 5 : level;

  // Each new go is read aloud once.
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    let live = true;
    tappedYet.current = false;
    since.current = Date.now();
    setPose('sit');
    setPeek(false);
    guideHand.start();
    say(askLine(go), () => {
      if (live && !tappedYet.current) since.current = Date.now();
    });
    return () => {
      live = false;
    };
    // Read again only when the go changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, goes]);

  function nextGo(all: Tap[]) {
    clearTimers();
    if (at + 1 < goes.length) {
      setAt(at + 1);
      setPhase('ask');
      setGs(NEW_GO);
      setTapped([]);
      setLastSlip(null);
      return;
    }
    setPhase('done');
    later(400, () => onDone(all));
  }

  function pick(value: number) {
    if (phase !== 'ask' || gs.phase === 'look') return;
    tappedYet.current = true;
    guideHand.stop();
    const now = Date.now();
    const next = [...taps, { pick: value, ms: now - since.current }];
    since.current = now;
    setTaps(next);
    if (!tapRight(go, value)) {
      const state = stepGo(gs, 'wrong');
      setGs(state);
      setTapped((t) => [...t, value]);
      setWobble(value);
      setWhyTap((n) => n + 1);
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => setWobble(null));
      const slip = go.kind === 'place' ? (tapValue(go, value) < go.n ? 'early' : 'late') : go.wrongs.find((w) => w.n === value)?.kind ?? 'one';
      setLastSlip(slip);
      if (state.phase === 'look') {
        startLook({ anchor: at, steps: 3, openingLine: WORDS.lookTitle, fillLine: lookLine(go), onEnd: () => setGs((s) => stepGo(s, 'lookDone')) });
      } else say(go.kind === 'place' ? PLACE_LINES[slip as 'early' | 'late'] : SLIP_LINES[slip as keyof typeof SLIP_LINES]);
      return;
    }
    clearTimers();
    setGs(stepGo(gs, 'right'));
    setPhase('right');
    setPose('eat');
    say(WORDS.right[at % WORDS.right.length]);
    if (sound) playSound('badge');
    later(RIGHT_MS, () => nextGo(next));
  }

  const made = at + (phase === 'ask' ? 0 : 1);
  const solved = phase !== 'ask';
  const lastWrongPlace = go.kind === 'place' && tapped.length ? tapped[tapped.length - 1] : null;
  const wrongDot = lastWrongPlace !== null && !solved ? [{ value: tapValue(go, lastWrongPlace), look: 'ring' as const }] : [];
  const rightDot = solved ? [{ value: go.kind === 'near' || go.kind === 'tens' ? go.answer : go.n, label: String(go.kind === 'near' || go.kind === 'tens' ? go.answer : go.n), tone: 'landmark' as const }] : [];
  const arrow = go.kind === 'read' && !solved ? [{ value: go.n, label: '?' }] : [];
  const mark = go.kind === 'tens' || go.kind === 'near' ? [{ value: go.n, label: String(go.n) }] : [];
  const points: LinePoint[] = [...arrow, ...mark, ...wrongDot, ...rightDot];
  const bandMarks: Landmark[] = pic.band ? pic.band.map((value) => ({ value })) : [];
  const lookMarks: Landmark[] = look && go.kind === 'place' ? lookMarksFor(go, look.filled) : [];
  const lineProps = lineFor(go, seen, points, [...bandMarks, ...lookMarks]);
  const label = go.kind === 'place' ? `A branch from ${go.lens ? go.lens.lo : 0} to ${go.lens ? go.lens.hi : go.max}. Tap where ${go.n} goes.` : go.kind === 'read' ? `A branch from 0 to ${go.max} with an arrow at a number.` : `A branch from 0 to ${go.max}.`;
  const canTapLine = go.kind === 'place' && phase === 'ask' && gs.phase !== 'look';
  const cards = phase === 'ask' ? pic.choices : go.choices;

  const picture = (
    <NumberLine {...lineProps} label={label} onPick={canTapLine ? (v) => pick(permilleOf(go, v)) : undefined} pickOn={go.lens ? 'lens' : 'line'} className="pg-line" />
  );

  return (
    <div className={`pg-play pg-scene--${scenery}`} style={sceneStyle(scenery)}>
      <h2 className="pg-sr" tabIndex={-1} ref={heading}>{go.kind === 'place' ? WORDS.tapLine : WORDS.pickCard}</h2>
      <div className="pg-top">
        <div className="pg-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
          {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
            <span key={i} className={i < made ? 'pg-pip pg-pip--done' : 'pg-pip'} />
          ))}
        </div>
        <HearAgain prefix="pg" label={WORDS.hearAgain} onHear={() => say(askLine(go))} />
      </div>

      <div className="pg-stage" key={at}>
        <span className="pg-stage__friend" aria-hidden="true"><Friend friend={friend} pose={pose} /></span>
        <p className="pg-ask" aria-live="polite">{askLine(go)}</p>
        <div className={`pg-branch${canTapLine ? ' pg-branch--tap' : ''}`}>
          {picture}
          {guideHand.pointing && canTapLine && <PointingHand prefix="pg" />}
        </div>
        {canPeek && !peek && phase === 'ask' && (
          <button type="button" className="pg-button pg-peek" onClick={() => setPeek(true)}>
            <span aria-hidden="true">🍃</span> {WORDS.peek}
          </button>
        )}
      </div>

      {gs.phase === 'why' && lastSlip && (
        <ShowWhy
          prefix="pg"
          tapKey={whyTap}
          picture={<span className="pg-why__icon" aria-hidden="true">🤔</span>}
          line={go.kind === 'place' ? PLACE_LINES[lastSlip as 'early' | 'late'] : SLIP_LINES[lastSlip as keyof typeof SLIP_LINES]}
        />
      )}
      {gs.phase === 'look' && look && (
        <LookTogether prefix="pg" title={WORDS.lookTitle} picture={<span className="pg-why__icon" aria-hidden="true">👀</span>} line={lookLine(go)} skipLabel={WORDS.skip} canSkip={look.canSkip} onSkip={skip} />
      )}
      {gs.phase === 'redo' && <NowYouTry prefix="pg" line={WORDS.nowYouTry} />}

      {go.kind !== 'place' && (
        <div className={`pg-cards pg-cards--${go.kind}`} role="group" aria-label={WORDS.pickCard}>
          {cards.map((n) => (
            <button
              key={`${at}-${n}`}
              type="button"
              disabled={gs.phase === 'look'}
              className={`pg-choice${wobble === n ? ' pg-choice--wobble' : ''}${solved && n === go.answer ? ' pg-choice--right' : ''}${solved && n !== go.answer ? ' pg-choice--off' : ''}`}
              onClick={() => pick(n)}
              aria-label={String(n)}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** What "Let's look together" fills in for a place go: the mark below, then the mark above the number. */
function lookMarksFor(go: Go, filled: number): Landmark[] {
  const size = go.max >= 1000 && !go.lens ? 100 : go.lens && go.hi - go.lo <= 10 ? 1 : 10;
  const low = Math.floor(go.n / size) * size;
  return [...(filled >= 1 ? [{ value: low }] : []), ...(filled >= 2 && low + size <= go.hi ? [{ value: low + size }] : [])];
}
