/**
 * Today's challenge: ten goes on the sand. Each go, a wave washes in and some of the pipi dig down; the child taps the
 * shell with how many are hiding. A right shell lifts the sand and the hiding pipi pop up and wave; a wrong one wobbles
 * back, with no penalty (docs/PIPI-PLAN.md sections 1, 2 and 4).
 *
 * Mistakes that teach (maths review R5). A wrong shell greys out for good (it can't be tapped again in that try) and the
 * picture for its kind of mistake shows with a line that says why. The second wrong shell of a go stops the free taps:
 * "Let's look together" lifts the sand, all the pipi wave and "7 = 4 + 3" fills in, coloured to match the dots. Then the
 * child gets "Now you try one like it": a sister go (another split of the same whole, or a nearby whole), with the child's
 * own help and nothing pointed at, never sent. A right shell on it sends the first go's right pick instead; a wrong one shows why,
 * then the first go comes back with its right shell pointed at. Only a go's first shell
 * is scored (shared/pipi/play.ts), so a shown go is never a clean right; the finished round still turns its shell.
 *
 * The help follows the child, fact by fact (maths review R6, each go's `h` from shared/pipi/round.ts): full is the pipi in
 * a five-frame or ten-frame and a dashed outline where each hiding one is; faint drops the frame and fades the outlines;
 * none leaves no mark at all, so only "7 altogether" and the pipi still showing are there to go on. A go with no `h` (a
 * round saved before R6) shows the calendar's help for the round: bronze days full, silver faint, gold none. After three
 * goes in a row with a wrong first shell the full help comes back for the rest of the round (not saved), with a line that
 * says so once. The teacher's help switch still wins: off means none, and the three-in-a-row boost does not bring it back.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { STRUGGLE_GOES } from '../../../shared/kit/help';
import { NEW_GO, stepGo } from '../../../shared/kit/mistakes';
import { replay, wrongFirstRun, type Tap } from '../../../shared/pipi/play';
import type { Friend as FriendName, Help } from '../../../shared/pipi/progress';
import { GOES_PER_ROUND, showRound, sisterGo, type Go, type Round, type WrongKind } from '../../../shared/pipi/round';
import { DemoBar } from '../../kit/DemoBar';
import { HearAgain } from '../../kit/HearAgain';
import { LookTogether, NowYouTry, ShowWhy, useLookTogether } from '../../kit/ShowWhy';
import { useKindDemo } from '../../kit/useKindDemo';
import { useSeenKinds } from '../../kit/useSeenKinds';
import { playSound } from '../sounds';
import { backFor, PaperLayers, type Scenery } from './Beach';
import { paint } from './art';
import { DEMO_KINDS, DEMO_STEPS, demoGo, type DemoKind } from './demo';
import { Friend, Hidden, NumberShell, Pipi } from './PipiArt';
import { SplitSum, WhyPicture } from './WhyPicture';
import { lookLine, whyLine, WORDS } from './words';

/** The painted tide (scripts/pipi-art.py `tide/wave`); the plain drawn wave until it is painted. */
const WAVE = paint('tide/wave');

/** How long the wave takes to wash in and the pipi to dig down, before the shells can be tapped. */
export const TIDE_MS = 1300;
const RIGHT_MS = 1500;
const WOBBLE_MS = 500;
/** How long a wrong shell stays after its why line has been said. */
const WHY_LEAVE_MS = 1200;
/** How long a wrong shell on the sister shows its why-line, before the first go's right shell is pointed at. */
const SISTER_WHY_MS = 2600;

interface Props {
  round: Round;
  /** The help for a go saved with none of its own (a round open before R6): the calendar's, from the shells. */
  help: Help;
  /** False when the teacher has turned the help in the sand off: none at all, and three wrong first shells don't bring it back. */
  helpOn?: boolean;
  scenery: Scenery;
  friend: FriendName;
  /** The child's very first challenge: a hand shows them the right shell on the first go. */
  guide?: boolean;
  /** The kinds of go this child has seen, and how to remember more (each kind's demo plays once). */
  seen: readonly string[];
  onSeen: (kinds: string[]) => Promise<unknown>;
  sound: boolean;
  say: (text: string, onEnd?: () => void) => void;
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

/** The shells in a new order (where they sit only: which number is which stays the same). */
function reordered(items: number[]): number[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join() === items.join() && out.length > 1 ? [...out.slice(1), out[0]] : out;
}

/** The made-up go of a "Show me first" demo: the same sand, sign and shells as a real go, with nothing to tap. */
function DemoView({ kind, round, scenery, friend, step, canSkip, onSkip, heading, done }: {
  kind: DemoKind; round: Round; scenery: Scenery; friend: FriendName; step: number; canSkip: boolean; onSkip: () => void;
  heading: RefObject<HTMLHeadingElement | null>; done: number;
}) {
  const go = useMemo(() => demoGo(kind, round), [kind, round]);
  const target = DEMO_STEPS[kind][step]?.target;
  const tides = kind === 'twoTides';
  const phase: Phase = tides && step === 0 ? 'tide' : 'ask';
  const spots = spotsFor(go, phase, tides ? step >= 1 : true);
  return (
    <div className={`pp-play pp-scene--${scenery}`} style={backFor(scenery)}>
      <PaperLayers />
      <h2 className="pp-sr" tabIndex={-1} ref={heading}>{WORDS.demoTitle}</h2>
      <div className="pp-top">
        <div className="pp-progress" aria-label={WORDS.goesDone(done, GOES_PER_ROUND)}>
          {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
            <span key={i} className={i < done ? 'pp-pip pp-pip--done' : 'pp-pip'} />
          ))}
        </div>
      </div>
      <div className="pp-sign" aria-live="polite">
        {kind === 'altogether' && step < 2 ? (
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
      </div>
      <div className="pp-stage">
        <div className={`pp-frame pp-frame--${spots.length === 5 ? 'five' : 'ten'} pp-frame--full`} role="img" aria-label={WORDS.altogether(go.whole)}>
          {spots.map((s, i) => (
            <span key={i} className={`pp-spot pp-spot--${s}`}>
              {(s === 'pipi' || s === 'popped') && <Pipi pose={s === 'popped' ? 'wave' : phase === 'tide' ? 'dig' : 'sit'} />}
              {s === 'hidden' && <Hidden outline="full" />}
            </span>
          ))}
        </div>
        <span className="pp-play__friend">
          <Friend friend={friend} pose="wait" />
        </span>
      </div>
      <div className="pp-shells" role="group" aria-label={WORDS.pickShell}>
        {go.choices.map((n, i) => {
          const pointed = target === 'shell' && n === go.answer;
          return (
            <button key={n} type="button" disabled className={`pp-shellbtn${pointed ? ' pp-shellbtn--pointed' : ''}`} style={{ ['--pp-i' as string]: i }} aria-label={String(n)}>
              <NumberShell value={n} />
              {pointed && <span className="pp-hand" aria-hidden="true">👇</span>}
            </button>
          );
        })}
      </div>
      <DemoBar prefix="pp" skipLabel={WORDS.skip} canSkip={canSkip} onSkip={onSkip} />
    </div>
  );
}

export function Goes({ round, help, helpOn = true, scenery, friend, guide = false, seen, onSeen, sound, say, onDone }: Props) {
  const goes = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('tide');
  /** Halfway through the tide: the wave has covered the sand and the pipi have dug in. */
  const [tideIn, setTideIn] = useState(false);
  const [wobble, setWobble] = useState<number | null>(null);
  /** The wrong shells tapped in this try of the go: grey, and not tappable again. */
  const [tried, setTried] = useState<number[]>([]);
  /** The last wrong shell and its kind, shown with its why-line until the next tap. */
  const [why, setWhy] = useState<{ n: number; kind: WrongKind } | null>(null);
  /** The go's place in the two-tap flow (shared/kit/mistakes.ts). */
  const flow = useRef(NEW_GO);
  /** "Now you try!": the same go again after "Let's look together". */
  const [redo, setRedo] = useState(false);
  /** "Now you try one like it": the sister go (local only, never in `taps`, nothing on it marked) and the child's one wrong shell on it. */
  const [sister, setSister] = useState<{ go: Go; wrong: number | null } | null>(null);
  /** After a wrong shell on the sister: the first go's right shell is pointed at, so nobody is stuck. */
  const [stuck, setStuck] = useState(false);
  /** During "Let's look together" the sand is lifted and all the pipi wave. */
  const [lifted, setLifted] = useState(false);
  /** The shells' order for the redo; null is the go's own order. */
  const [order, setOrder] = useState<number[] | null>(null);
  const { look, start: startLook, skip: skipLook } = useLookTogether(say);
  /** Three goes in a row began with a wrong shell: full help for the rest of this round (not saved; the child's own help is). */
  const [boosted, setBoosted] = useState(false);
  /** Wrong shells that have had their why line and left the row (`go-shell` keys, so a late callback can't hit another go). */
  const [gone, setGone] = useState<string[]>([]);
  const kinds = useSeenKinds(seen, onSeen);
  const demoWas = useRef(false);
  const since = useRef(Date.now());
  /** Set by the first tap on this question, so the end of its read-aloud no longer restarts the clock. */
  const tappedYet = useRef(false);
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
    // A kind not yet seen is shown first (no tide): its question is read when the demo is over.
    if (DEMO_KINDS.includes(goes[at].kind) && !kinds.has(goes[at].kind)) {
      setPhase('ask');
      setTideIn(true);
      tappedYet.current = false;
      return;
    }
    setPhase('tide');
    setTideIn(false);
    if (sound) playSound('tap');
    const half = window.setTimeout(() => setTideIn(true), TIDE_MS / 2);
    // The clock starts when the shells can be tapped (a tap during the voice is still timed) and again once the question has been heard.
    let live = true;
    const ask = window.setTimeout(() => {
      setPhase('ask');
      tappedYet.current = false;
      since.current = Date.now();
      say(guide && at === 0 ? `${goes[0].spoken} ${WORDS.guideStart}` : goes[at].spoken, () => {
        if (live && !tappedYet.current) since.current = Date.now();
      });
    }, TIDE_MS);
    return () => {
      live = false;
      window.clearTimeout(half);
      window.clearTimeout(ask);
    };
    // Only when the go changes, not when the guide ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, goes]);

  const base = goes[Math.min(at, goes.length - 1)];
  const go = sister ? sister.go : base;
  const demoKind = DEMO_KINDS.includes(go.kind) && !kinds.has(go.kind) && phase === 'ask' && !redo ? (go.kind as DemoKind) : null;
  const demo = useKindDemo({ kind: demoKind, seen: kinds, mark: kinds.mark, steps: demoKind ? DEMO_STEPS[demoKind] : [], say });
  // When a demo ends (or is skipped) the real go starts: its question is read and the clock begins.
  useEffect(() => {
    if (demo.playing) {
      demoWas.current = true;
      return;
    }
    if (!demoWas.current) return;
    demoWas.current = false;
    since.current = Date.now();
    tappedYet.current = false;
    say(go.spoken, () => {
      if (!tappedYet.current) since.current = Date.now();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.playing]);
  const helpAt = (i: number): Help => (helpOn ? round.goes[i]?.h ?? help : 'none');
  const helpNow: Help = boosted ? 'full' : helpAt(at);
  const spots = spotsFor(go, lifted && phase === 'ask' ? 'right' : phase, tideIn);
  // Gold days (or help off): the hiding ones leave no mark, and the spots close up so the gaps don't give it away.
  const shown = helpNow === 'none' ? spots.filter((s) => s === 'pipi' || s === 'popped') : spots;
  const framed = helpNow === 'full';
  // The outlines show how many hide, so they wait for a first wrong shell on this go (or the struggle boost).
  const outlineNow: Help = !boosted && tried.length === 0 ? 'none' : helpNow;

  /** Back to a fresh go: nothing tried, no why, the go's own order. */
  function freshGo() {
    flow.current = NEW_GO;
    setTried([]);
    setGone([]);
    setWhy(null);
    setRedo(false);
    setLifted(false);
    setOrder(null);
    setSister(null);
    setStuck(false);
  }

  /** "Hear it again": the why-line if one is showing, otherwise the question (not the look-together step, and no first-go intro). */
  function hearAgain() {
    if (look || phase !== 'ask') return;
    const line = why ? whyLine(why.kind, go.kind, go.whole, go.showing, go.hiding) : go.spoken;
    say(line, () => {
      if (!tappedYet.current) since.current = Date.now();
    });
  }

  /** The second wrong shell of a go: lift the sand, read the split out, then ask the same go again. */
  function lookTogether() {
    setWhy(null);
    setLifted(true);
    startLook({
      anchor: go.answer,
      steps: 3,
      openingLine: WORDS.lookTogether,
      fillLine: lookLine(go.kind, go.whole, go.showing, go.hiding),
      onEnd: () => {
        flow.current = stepGo(flow.current, 'lookDone');
        setLifted(false);
        setRedo(true);
        setTried([]);
        setGone([]);
        // "Now you try one like it": a sister go (another split of the same whole, or a nearby whole); if none fits, the go itself with its shells in a new order.
        const sis = sisterGo(round, at, go);
        setSister(sis ? { go: sis, wrong: null } : null);
        setOrder(sis ? null : reordered(go.choices));
        tappedYet.current = false;
        since.current = Date.now();
        say(WORDS.nowTry, sis ? () => say(sis.spoken) : undefined);
      },
    });
  }

  /** A tap on the sister. Never saved or sent: a right one ends the go with the FIRST go's right pick, which is what the server replays. */
  function pickSister(s: { go: Go; wrong: number | null }, n: number) {
    if (s.wrong !== null) return;
    tappedYet.current = true;
    if (n === s.go.answer) {
      const now = Date.now();
      const next = [...taps, { pick: base.answer, ms: now - since.current }];
      since.current = now;
      setTaps(next);
      rightTap(next, n);
      return;
    }
    setSister({ go: s.go, wrong: n });
    setTried([n]);
    setWobble(n);
    if (sound) playSound('tap');
    later(WOBBLE_MS, () => setWobble(null));
    const kind = s.go.wrongs.find((w) => w.n === n)?.kind ?? 'off1';
    setWhy({ n, kind });
    say(whyLine(kind, s.go.kind, s.go.whole, s.go.showing, s.go.hiding));
    later(SISTER_WHY_MS, () => {
      setSister(null);
      setWhy(null);
      setTried([]);
      setStuck(true);
    });
  }

  /** The go is right: the shell lifts the sand, then the next go (or the end). */
  function rightTap(next: Tap[], n: number) {
    flow.current = stepGo(flow.current, 'right');
    kinds.mark([go.kind]);
    setWhy(null);
    setPhase('right');
    say(WORDS.yes(n));
    if (sound) playSound('badge');
    later(RIGHT_MS, () => {
      if (at + 1 >= goes.length) {
        setPhase('done');
        later(RIGHT_MS / 2, () => onDone(next));
      } else {
        freshGo();
        setAt(at + 1);
      }
    });
  }

  function pick(n: number) {
    if (phase !== 'ask' || look || demo.playing || tried.includes(n)) return;
    if (sister) return pickSister(sister, n);
    tappedYet.current = true;
    const now = Date.now();
    const next = [...taps, { pick: n, ms: now - since.current }];
    since.current = now;
    setTaps(next);
    if (n !== go.answer) {
      setWobble(n);
      setTried([...tried, n]);
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => setWobble(null));
      flow.current = stepGo(flow.current, 'wrong');
      // Each go is scored at its first shell: three in a row wrong bring the full help back, and the line says so once.
      const struggling =
        helpOn && !boosted && wrongFirstRun(replay(round, next).answers) >= STRUGGLE_GOES && round.goes.some((_, i) => i >= at && helpAt(i) !== 'full');
      if (struggling) setBoosted(true);
      if (flow.current.phase === 'look') {
        lookTogether();
        return;
      }
      const kind = go.wrongs.find((w) => w.n === n)?.kind ?? 'off1';
      setWhy({ n, kind });
      const line = whyLine(kind, go.kind, go.whole, go.showing, go.hiding);
      // Once the why line has been said, the wrong shell slips out of the row (a moment later, so it is seen).
      const slip = () => later(WHY_LEAVE_MS, () => setGone((g) => [...g, `${at}-${n}`]));
      if (struggling) say(line, () => { slip(); say(WORDS.outlinesBack); });
      else say(line, slip);
      return;
    }
    rightTap(next, n);
  }

  const pointAt = !sister && phase === 'ask' && ((guide && at === 0) || stuck) ? go.answer : null;
  const done = at + (phase === 'right' || phase === 'done' ? 1 : 0);
  const ask = go.kind === 'altogether' ? WORDS.howManyAltogether : go.kind === 'twoTides' ? WORDS.howManyNow : WORDS.howManyHiding;

  if (demo.playing && demoKind) return <DemoView kind={demoKind} round={round} scenery={scenery} friend={friend} step={demo.step} canSkip={demo.canSkip} onSkip={demo.skip} heading={heading} done={done} />;

  return (
    <div className={`pp-play pp-scene--${scenery}`} style={backFor(scenery)}>
      <PaperLayers />
      <h2 className="pp-sr" tabIndex={-1} ref={heading}>{WORDS.pickShell}</h2>
      <div className="pp-top">
        <div className="pp-progress" aria-label={WORDS.goesDone(done, GOES_PER_ROUND)}>
          {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
            <span key={i} className={i < done ? 'pp-pip pp-pip--done' : 'pp-pip'} />
          ))}
        </div>
        <HearAgain prefix="pp" label={WORDS.hearAgain} onHear={hearAgain} />
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
        {(phase === 'tide') && (
          <span
            className={`pp-wave${WAVE ? ' pp-wave--painted' : ''}${tideIn ? ' pp-wave--out' : ''}`}
            style={WAVE ? ({ '--pp-wave': `url(${WAVE})` } as CSSProperties) : undefined}
            aria-hidden="true"
          />
        )}
        <div
          className={`pp-frame pp-frame--${framed ? (spots.length === 5 ? 'five' : 'ten') : 'row'} pp-frame--${helpNow}`}
          role="img"
          aria-label={
            go.kind === 'altogether'
              ? `${go.showing} pipi here and ${go.hiding} popped up`
              : `${WORDS.altogether(go.whole)}, ${go.showing} showing`
          }
        >
          {shown.map((s, i) => (
            <span key={i} className={`pp-spot pp-spot--${s}${guide && at === 0 && s === 'hidden' ? ' pp-spot--pointed' : ''}`}>
              {s === 'pipi' && <Pipi pose={phase === 'tide' && tideIn ? 'dig' : phase === 'done' || lifted ? 'wave' : 'sit'} />}
              {s === 'popped' && <Pipi pose="wave" />}
              {s === 'hidden' && <Hidden outline={outlineNow} />}
            </span>
          ))}
        </div>
        {why && (
          <ShowWhy
            prefix="pp"
            tapKey={`${why.n}-${taps.length}`}
            picture={<WhyPicture go={go} kind={why.kind} />}
            line={whyLine(why.kind, go.kind, go.whole, go.showing, go.hiding)}
          />
        )}
        {look && (
          <LookTogether
            prefix="pp"
            title={WORDS.lookTogether}
            picture={<SplitSum go={go} filled={look.filled} />}
            line={lookLine(go.kind, go.whole, go.showing, go.hiding)}
            skipLabel={WORDS.goOn}
            canSkip={look.canSkip}
            onSkip={skipLook}
          />
        )}
        {redo && !why && !look && <NowYouTry prefix="pp" line={WORDS.nowTry} />}
        <span className="pp-play__friend">
          <Friend friend={friend} pose={phase === 'right' || phase === 'done' || lifted ? 'cheer' : 'wait'} />
        </span>
      </div>
      <div className="pp-shells" role="group" aria-label={WORDS.pickShell}>
        {(order ?? go.choices).filter((n) => n === go.answer || !gone.includes(`${at}-${n}`)).map((n, i) => (
          <button
            key={`${at}-${n}`}
            type="button"
            disabled={phase === 'tide' || look !== null || tried.includes(n) || (sister !== null && sister.wrong !== null)}
            className={`pp-shellbtn${tried.includes(n) ? ' pp-shellbtn--tried' : ''}${wobble === n ? ' pp-shellbtn--wobble' : ''}${phase !== 'ask' && phase !== 'tide' && n === go.answer ? ' pp-shellbtn--right' : ''}${n === pointAt ? ' pp-shellbtn--pointed' : ''}`}
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
