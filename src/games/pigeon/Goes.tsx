/**
 * Today's challenge at Pigeon's Number Line: ten goes on the berry branch (docs/PIGEON-PLAN.md).
 *
 *  - Place: tap where a number goes on the line (a lens on the zoom steps).
 *  - Read: what number is at the arrow? Four number cards.
 *  - Ten more, ten less: four number cards.
 *  - Closer: which ten (or hundred) is the number nearest to? Four cards.
 *
 * Each go comes with its help level from the server (marksFor): 5 every ten marked (only the ends and the middle written), down to 0 the two ends. A wrong tap
 * shows why (ShowWhy), a second one is "Let's look together" (LookTogether, the branch with every number marked and Bella
 * naming the two marks either side), then "Now you try". The answer is never shown or said before the child has found it.
 * Only the taps are sent; the server replays them.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { NumberLine, type Landmark, type Arc, type LinePoint, type NumberLineProps } from '../../kit';
import { HearAgain } from '../../kit/HearAgain';
import { PointingHand } from '../../kit/PointingHand';
import { DemoBar } from '../../kit/DemoBar';
import { useSeenKinds } from '../../kit/useSeenKinds';
import { useKindDemo } from '../../kit/useKindDemo';
import { useGuidedFirstGo } from '../../kit/useGuidedFirstGo';
import { LookTogether, NowYouTry, ShowWhy, useLookTogether } from '../../kit/ShowWhy';
import { STRUGGLE_GOES } from '../../../shared/kit/help';
import { stepGo, NEW_GO, type GoState } from '../../../shared/kit/mistakes';
import { tapRight, type Tap } from '../../../shared/pigeon/play';
import type { Friend as FriendName } from '../../../shared/pigeon/progress';
import { GOES_PER_ROUND, kindOfKey, marksFor, pictureFor, showRound, sisterGo, tapValue, type Go, type HelpLevel, type Round } from '../../../shared/pigeon/round';
import { playSound } from '../sounds';
import { Friend, sceneStyle, type Pose, type Scenery } from './art';
import { DEMO_KIND, DEMO_STEPS, DemoScene, hasDemo } from './demo';
import { reasonFor } from './reason';
import { askLine, lookLine, slipLine } from './voiceLines';
import { WORDS } from './words';

/**
 * Height kept above and below the line (kit `room`), so it never moves when the reason is drawn. The most any go needs: the
 * tallest jump arc and its label is about 60 picture units (a jump is never wider than a tenth of the line, or two tenths for
 * a wrong ten more card), the arrow and its label 64. The same on the zoom lens, which needs nothing below.
 */
const ROOM = 72;
const ROOM_BELOW = 72;
const LENS_ROOM = 72;
const RIGHT_MS = 1900;
const WOBBLE_MS = 500;
/** How long a wrong tap on the sister shows its why-line, before the original go's right answer is marked. */
const SISTER_WHY_MS = 2600;

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
  /** The kinds of go the child has seen: a demo plays once for a kind they have not. `saveSeen` remembers them. */
  seenKinds: readonly string[];
  saveSeen: (kinds: string[]) => Promise<unknown>;
}

const permilleOf = (go: Go, value: number) => Math.min(1000, Math.max(0, Math.round(((value - go.lo) / (go.hi - go.lo)) * 1000)));

/** The kit line for a go at a help level, with the extra marks and points a screen wants. */
export function lineFor(go: Go, level: HelpLevel, points: LinePoint[], extraMarks: Landmark[] = [], arcs: Arc[] = [], showPosts = false): Omit<NumberLineProps, 'label'> {
  const mainMarks = marksFor(level, 0, go.max);
  const toLandmarks = (named: number[]): Landmark[] => named.map((value) => ({ value }));
  /** Big marks with no number written: the child counts them. Put first so a named mark wins in `dedupe`. */
  const toBig = (big: number[]): Landmark[] => big.map((value) => ({ value, label: null }));
  const tickStep = (ticks: number[]) => (ticks.length > 1 ? ticks[1] - ticks[0] : undefined);
  const posts: Landmark[] = showPosts && go.posts ? go.posts.map((value) => ({ value })) : [];
  const landmarks = dedupe([...toBig(mainMarks.big), ...toLandmarks(mainMarks.named), ...posts, ...(go.lens ? [] : extraMarks)]);
  const props: Omit<NumberLineProps, 'label'> = { min: 0, max: go.max, step: tickStep(mainMarks.ticks), landmarks };
  if (go.lens) {
    const lensMarks = marksFor(level, go.lens.lo, go.lens.hi);
    props.lens = {
      from: go.lens.lo,
      to: go.lens.hi,
      step: tickStep(lensMarks.ticks),
      landmarks: dedupe([...toBig(lensMarks.big), ...toLandmarks(lensMarks.named), ...extraMarks]),
      points,
      arcs,
      room: LENS_ROOM,
    };
    props.room = 0;
    props.roomBelow = 0;
  } else {
    props.points = points;
    props.arcs = arcs;
    props.room = ROOM;
    props.roomBelow = ROOM_BELOW;
  }
  return props;
}

const dedupe = (marks: Landmark[]): Landmark[] => [...new Map(marks.map((m) => [m.value, m])).values()];

export function Goes({ guided = false, round, scenery, friend, sound, say, onDone, seenKinds, saveSeen }: Props) {
  const goes = useMemo(() => showRound(round), [round]);
  const seenSet = useSeenKinds(seenKinds, saveSeen);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [gs, setGs] = useState<GoState>(NEW_GO);
  const [tapped, setTapped] = useState<number[]>([]);
  const [lastSlip, setLastSlip] = useState<string | null>(null);
  const [whyTap, setWhyTap] = useState(0);
  /** How many wrong taps there were when "Let's look together" began, so a later wrong tap in the redo says its slip line again. */
  const [tapsAtLook, setTapsAtLook] = useState(0);
  /** "Now you try one like it": the sister go (local only, never in `taps`) and the child's one wrong tap on it. Null when there is none. */
  const [sis, setSis] = useState<{ go: Go; wrong: number | null } | null>(null);
  /** After a wrong tap on the sister: the original go's right answer is marked, so nobody is stuck. */
  const [stuck, setStuck] = useState(false);
  const [wobble, setWobble] = useState<number | null>(null);
  const [peek, setPeek] = useState(false);
  const [pose, setPose] = useState<Pose>('sit');
  // Three goes in a row with a wrong first tap bring the full picture back for the rest of the round (not saved).
  const [struggle, setStruggle] = useState(false);
  const run = useRef(0);
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
  /** True from the go's start until its demo has ended or been skipped: the real go waits, and nothing is tappable. */
  const demoing = hasDemo(go) && !seenSet.has(DEMO_KIND);
  const kindDemo = useKindDemo({ kind: demoing ? DEMO_KIND : null, seen: seenSet, mark: seenSet.mark, steps: DEMO_STEPS, say });
  /** The go on screen: the sister during "Now you try", else the go itself. */
  const cur: Go = sis ? sis.go : go;
  const curTapped = sis ? (sis.wrong === null ? [] : [sis.wrong]) : tapped;
  const wrongs = sis ? 0 : gs.wrong;
  const pic = pictureFor(cur, wrongs, curTapped, struggle);
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
    // A demo goes first (the question is read once it has ended).
    if (!demoing) {
      say(askLine(go), () => {
        if (live && !tappedYet.current) since.current = Date.now();
      });
    }
    return () => {
      live = false;
    };
    // Read again only when the go changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, goes, demoing]);

  // The sister is read aloud when it comes: "Now you try one like it", then its question.
  useEffect(() => {
    if (sis && sis.wrong === null) say(WORDS.nowYouTry, () => say(askLine(sis.go)));
    // Only when a new sister comes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sis?.go]);

  function nextGo(all: Tap[]) {
    clearTimers();
    setSis(null);
    setStuck(false);
    if (at + 1 < goes.length) {
      setAt(at + 1);
      setPhase('ask');
      setGs(NEW_GO);
      setTapped([]);
      setLastSlip(null);
      setTapsAtLook(0);
      return;
    }
    setPhase('done');
    later(400, () => onDone(all));
  }

  /** A right tap finishes the go: the card is shown right, the friend eats, and the next go comes. */
  function rightTap(next: Tap[]) {
    clearTimers();
    const kind = kindOfKey(go.key);
    if (kind) seenSet.mark([kind]);
    setGs(stepGo(gs, 'right'));
    run.current = gs.wrong > 0 ? run.current + 1 : 0;
    if (run.current >= STRUGGLE_GOES) setStruggle(true);
    setPhase('right');
    setPose('eat');
    say(WORDS.right[at % WORDS.right.length]);
    if (sound) playSound('badge');
    later(RIGHT_MS, () => nextGo(next));
  }

  /** A tap on the sister. It is never saved or sent: a right one ends the go with the ORIGINAL go's right pick, which is what the server replays. */
  function pickSister(sister: Go, value: number) {
    if (sis?.wrong != null) return;
    tappedYet.current = true;
    if (tapRight(sister, value)) {
      const now = Date.now();
      const next = [...taps, { pick: go.kind === 'place' ? permilleOf(go, go.n) : go.answer, ms: now - since.current }];
      since.current = now;
      setTaps(next);
      rightTap(next);
      return;
    }
    const slip = sister.kind === 'place' ? (tapValue(sister, value) < sister.n ? 'early' : 'late') : sister.wrongs.find((w) => w.n === value)?.kind ?? 'one';
    setSis({ go: sister, wrong: value });
    setLastSlip(slip);
    setWobble(value);
    setWhyTap((n) => n + 1);
    if (sound) playSound('tap');
    later(WOBBLE_MS, () => setWobble(null));
    say(slipLine(sister, slip));
    later(SISTER_WHY_MS, () => {
      setSis(null);
      setLastSlip(null);
      setStuck(true);
    });
  }

  function pick(value: number) {
    if (phase !== 'ask' || gs.phase === 'look') return;
    if (sis) return pickSister(sis.go, value);
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
        setTapsAtLook(tapped.length + 1);
        startLook({ anchor: at, steps: 3, openingLine: WORDS.lookTitle, fillLine: lookLine(go), onEnd: () => {
            // "Now you try" is a sister go (same key family, numbers moved by one or two); if none fits, the go itself comes back.
            const sister = sisterGo(round, at, go);
            setSis(sister ? { go: sister, wrong: null } : null);
            setGs((s) => stepGo(s, 'lookDone'));
          } });
      } else say(slipLine(go, slip));
      return;
    }
    rightTap(next);
  }

  const made = at + (phase === 'ask' ? 0 : 1);
  const solved = phase !== 'ask';
  const slipText = lastSlip ? slipLine(cur, lastSlip) : '';
  const lastTap = curTapped.length ? curTapped[curTapped.length - 1] : null;
  /** The child's last wrong answer in the line's own units: where they tapped, or the card. */
  const lastValue = lastTap === null ? null : cur.kind === 'place' ? tapValue(cur, lastTap) : lastTap;
  const ringAt = lastValue !== null && !solved && lastValue >= cur.lo && lastValue <= cur.hi ? [{ value: lastValue, look: 'ring' as const }] : [];
  const marked = solved || stuck;
  const rightDot = marked ? [{ value: cur.kind === 'near' || cur.kind === 'tens' ? cur.answer : cur.n, label: String(cur.kind === 'near' || cur.kind === 'tens' ? cur.answer : cur.n), tone: 'landmark' as const }] : [];
  const arrow = cur.kind === 'read' && !solved ? [{ value: cur.n, look: 'arrow' as const }] : [];
  const mark = cur.kind === 'tens' || cur.kind === 'near' ? [{ value: cur.n, label: String(cur.n) }] : [];
  // From "Let's look together" on, the reason is drawn on the line and stays for the rest of the go.
  // The sister has none until the child taps it wrong.
  const reason = (gs.phase === 'look' || gs.phase === 'redo') && !solved && (!sis || sis.wrong !== null) ? reasonFor(cur, lastValue) : null;
  const points: LinePoint[] = reason ? [...reason.points, ...(stuck && cur.kind !== 'place' ? rightDot : [])] : [...arrow, ...mark, ...ringAt, ...rightDot];
  const arcs = reason ? reason.arcs : [];
  const bandMarks: Landmark[] = pic.band ? pic.band.map((value) => ({ value })) : [];
  const lookMarks: Landmark[] = look && go.kind === 'place' ? lookMarksFor(go, look.filled) : [];
  const lineProps = lineFor(cur, seen, points, [...bandMarks, ...lookMarks], arcs, gs.phase === 'look' || gs.phase === 'redo' || solved);
  const label = cur.kind === 'place' ? `A branch from ${cur.lens ? cur.lens.lo : 0} to ${cur.lens ? cur.lens.hi : cur.max}. Tap where ${cur.n} goes.` : cur.kind === 'read' ? `A branch from 0 to ${cur.max} with an arrow at a number.` : `A branch from 0 to ${cur.max}.`;
  const canTapLine = cur.kind === 'place' && phase === 'ask' && gs.phase !== 'look';
  const cards = phase === 'ask' ? pic.choices : cur.choices;

  const picture = (
    <NumberLine {...lineProps} label={label} onPick={canTapLine ? (v) => pick(permilleOf(cur, v)) : undefined} pickOn={cur.lens ? 'lens' : 'line'} className="pg-line" />
  );

  if (demoing) {
    return (
      <div className={`pg-play pg-scene--${scenery}`} style={sceneStyle(scenery)}>
        <h2 className="pg-sr" tabIndex={-1} ref={heading}>{WORDS.demoTitle}</h2>
        <div className="pg-top">
          <div className="pg-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
            {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
              <span key={i} className={i < made ? 'pg-pip pg-pip--done' : 'pg-pip'} />
            ))}
          </div>
        </div>
        <div className="pg-stage">
          <span className="pg-stage__friend" aria-hidden="true"><Friend friend={friend} pose="sit" /></span>
          <p className="pg-ask" aria-live="polite">{DEMO_STEPS[kindDemo.step]?.line}</p>
          <DemoScene step={kindDemo.step} />
        </div>
        <DemoBar prefix="pg" skipLabel={WORDS.skip} canSkip={kindDemo.canSkip} onSkip={kindDemo.skip} />
      </div>
    );
  }

  return (
    <div className={`pg-play pg-scene--${scenery}`} style={sceneStyle(scenery)}>
      <h2 className="pg-sr" tabIndex={-1} ref={heading}>{cur.kind === 'place' ? WORDS.tapLine : WORDS.pickCard}</h2>
      <div className="pg-top">
        <div className="pg-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
          {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
            <span key={i} className={i < made ? 'pg-pip pg-pip--done' : 'pg-pip'} />
          ))}
        </div>
        <HearAgain prefix="pg" label={WORDS.hearAgain} onHear={() => say(askLine(cur))} />
      </div>

      <div className="pg-stage" key={`${at}${sis ? 's' : ''}`}>
        <span className="pg-stage__friend" aria-hidden="true"><Friend friend={friend} pose={pose} /></span>
        <p className="pg-ask" aria-live="polite">{askLine(cur)}</p>
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

      <div className="pg-reason">
        {gs.phase === 'why' && lastSlip && <ShowWhy prefix="pg" tapKey={whyTap} picture={null} line={slipText} />}
        {gs.phase === 'look' && look && (
          <LookTogether prefix="pg" title={WORDS.lookTitle} picture={null} line={lookLine(go)} skipLabel={WORDS.skip} canSkip={look.canSkip} onSkip={skip} />
        )}
        {gs.phase === 'redo' &&
          (sis ? (
            sis.wrong === null ? <NowYouTry prefix="pg" line={WORDS.nowYouTry} /> : <ShowWhy prefix="pg" tapKey={whyTap} picture={null} line={slipText} />
          ) : stuck && (tapped.length <= tapsAtLook || !lastSlip) ? null : tapped.length <= tapsAtLook || !lastSlip ? (
            <NowYouTry prefix="pg" line={WORDS.nowYouTry} />
          ) : (
            <ShowWhy prefix="pg" tapKey={whyTap} picture={null} line={slipText} />
          ))}
      </div>

      {cur.kind !== 'place' && (
        <div className={`pg-cards pg-cards--${cur.kind}`} role="group" aria-label={WORDS.pickCard}>
          {cards.map((n) => (
            <button
              key={`${at}${sis ? 's' : ''}-${n}`}
              type="button"
              disabled={gs.phase === 'look'}
              className={`pg-choice${wobble === n ? ' pg-choice--wobble' : ''}${marked && n === cur.answer ? ' pg-choice--right' : ''}${solved && n !== cur.answer ? ' pg-choice--off' : ''}`}
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
