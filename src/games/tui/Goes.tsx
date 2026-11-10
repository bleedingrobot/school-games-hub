/**
 * Today's challenge at Tūī's Ten Tree: ten goes, each a teen number seen as ten and some more (docs/TUI-PLAN.md).
 *
 *  - Way 0 "10 + 4": the full branch, then 4 loose berries. How many berries?
 *  - Way 1 "4 + 10": the loose berries first, on the left.
 *  - Way 2 "10 + ? = 14": the ten, and empty spaces where berries are missing. How many more?
 *  - Way 3 "14 − 10": the ten flies away. How many are left?
 *
 * Each go comes with its help level from the server (plan section 4): 5 every berry, popping in one at a time; 4 every
 * berry at once, with the sum written; 3 the ten tucked into a kete with a "10" tag; 2 the kete small and faint beside a
 * big sum; 1 the sum only, with a Peek; 0 the sum only. A wrong tap brings more picture for that go (pictureFor): the
 * answer is never shown or said.
 *
 * Mistakes that teach (maths review R5). Every go has four nests, each wrong one tagged with its mistake (round.ts). The
 * first wrong tap greys that nest out for good and says why, with a picture of that kind (arrow cards of 4 tens and 1 for
 * 41, two full frames for 20, the ten lit, the berries counted in, the whole with the ten greyed, the ten flying off). The
 * second stops the free taps: "Let's look together", the arrow cards play the whole sum, then "Now you try!": the same go
 * again at the child's own level, nests back in a new order. Only a go's first tap is scored (play.ts), so a shown go
 * is never a clean right. After every right answer, the arrow cards: the ones card slides onto the 0 of the
 * "10" and makes the teen number, at every level. Only the picks are sent; the server replays them.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Tap } from '../../../shared/tui/play';
import type { Friend as FriendName } from '../../../shared/tui/progress';
import { STRUGGLE_GOES } from '../../../shared/kit/help';
import { NEW_GO, stepGo } from '../../../shared/kit/mistakes';
import { GOES_PER_ROUND, KIND_OF_WAY, pictureFor, showRound, type Go, type HelpLevel, type Round, type TuiKind } from '../../../shared/tui/round';
import { DemoBar } from '../../kit/DemoBar';
import { HearAgain } from '../../kit/HearAgain';
import { useKindDemo } from '../../kit/useKindDemo';
import { useSeenKinds } from '../../kit/useSeenKinds';
import { LookTogether, NowYouTry, ShowWhy, useLookTogether } from '../../kit/ShowWhy';
import { playSound } from '../sounds';
import { backFor, Friend, Kete, Nest, TenFrame, type Pose, type Scenery } from './art';
import { DEMO_WAYS, demoNumber, demoSteps } from './demo';
import { askLine } from './voiceLines';
import { WORDS } from './words';

const RIGHT_MS = 3400;
const WOBBLE_MS = 500;
const FINALE_MS = 4200;
/** The guided first go: the hand at the full branch, then the loose berries, then over the nests. */
const GUIDE_AT = { branch: 400, loose: 3200, nests: 6000 };

type Phase = 'ask' | 'right' | 'finale' | 'done';
type Guide = 'branch' | 'loose' | 'nests' | null;

interface Props {
  round: Round;
  scenery: Scenery;
  friend: FriendName;
  /** The child's very first challenge: a hand shows them the way on the first go. */
  guide?: boolean;
  /** A gold day's first challenge: two full kete, "ten and ten", after the last go. */
  finale?: boolean;
  /** The kinds of go this child has seen, and how to remember more (each kind's demo plays once). */
  seen: readonly string[];
  onSeen: (kinds: string[]) => Promise<unknown>;
  sound: boolean;
  say: (text: string, onEnd?: () => void) => void;
  onDone: (taps: Tap[]) => void;
}

/** The sum as written: "10 + 4 = ?", with a real minus sign. */
const written = (go: Go) => go.parts.join(' ').replace(/-/g, '−');

export function Goes({ round, scenery, friend, guide = false, finale = false, seen, onSeen, sound, say, onDone }: Props) {
  const goes = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  /** The go's place in the two-tap flow (shared/kit/mistakes.ts). */
  const [flow, setFlow] = useState(NEW_GO);
  /** The last wrong nest's mistake, shown with its line until the next tap. */
  const [why, setWhy] = useState<{ n: number; kind: TuiKind } | null>(null);
  const { look, start: startLook, skip: skipLook } = useLookTogether(say);
  const [tapped, setTapped] = useState<number[]>([]);
  const [wobble, setWobble] = useState<number | null>(null);
  const [peek, setPeek] = useState(false);
  const [pointAt, setPointAt] = useState<Guide>(null);
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

  // Three goes in a row with a wrong first tap bring level 5 back for the rest of the round (not saved; Off keeps it away).
  const [streak, setStreak] = useState(0);
  const [boost, setBoost] = useState(false);
  /** Set when the boost has just begun and its line is still to be said, after the line for the wrong tap. */
  const backLine = useRef(false);
  const boosted = boost && round.help !== 'off';
  const planned: Go = goes[Math.min(at, goes.length - 1)];
  const go: Go = boosted && planned.l < 5 ? { ...planned, l: 5 } : planned;
  const guided = guide && at === 0;
  const kinds = useSeenKinds(seen, onSeen);
  /** A way not yet seen (turning round, how many more, taking away) gets its demo before the first go of it, once. */
  const needsDemo = DEMO_WAYS.includes(go.v) && !kinds.has(KIND_OF_WAY[go.v]);
  const demoWay = needsDemo && phase === 'ask' ? go.v : null;
  const demoN = demoNumber(go.n);
  const demo = useKindDemo({ kind: demoWay === null ? null : KIND_OF_WAY[demoWay], seen: kinds, mark: kinds.mark, steps: demoWay === null ? [] : demoSteps(demoWay, demoN), say });
  const demoWas = useRef(false);
  const redo = flow.phase === 'redo';
  // "Now you try" is at the child's own level, not the extra help the two wrong taps brought.
  const pic = pictureFor(go, redo ? 0 : flow.wrong);
  // Level 1's Peek (opened by the child or by a wrong tap) brings back level 3's picture. Off has no Peek.
  const canPeek = go.l === 1 && round.help !== 'off' && pic.level <= 1;
  const shownLevel: HelpLevel = pic.level <= 1 && (pic.peekOpen || peek) ? 3 : pic.level;
  // A why-picture needs the berries drawn: the frames, and counted in for a slip of one.
  const level: HelpLevel = why ? (Math.max(shownLevel, why.kind === 'off1' ? 5 : 4) as HelpLevel) : shownLevel;

  // Each new go is read aloud once.
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    // The clock starts now (a tap during the voice is still timed) and again once the question has been heard.
    let live = true;
    tappedYet.current = false;
    since.current = Date.now();
    setPose('sit');
    setPeek(false);
    // A way not yet seen is shown first; its question is read when the demo is over.
    if (!(DEMO_WAYS.includes(go.v) && !kinds.has(KIND_OF_WAY[go.v]))) {
      say(askLine(go), () => {
        if (live && !tappedYet.current) since.current = Date.now();
      });
    }
    if (guided) {
      later(GUIDE_AT.branch, () => setPointAt('branch'));
      later(GUIDE_AT.loose, () => setPointAt('loose'));
      later(GUIDE_AT.nests, () => setPointAt('nests'));
    } else setPointAt(null);
    return () => {
      live = false;
    };
    // Read again only when the go changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, goes]);

  // When a demo ends (or is skipped) the real go starts: its question is read and the clock begins.
  useEffect(() => {
    if (demo.playing) {
      demoWas.current = true;
      return;
    }
    if (!demoWas.current) return;
    demoWas.current = false;
    since.current = Date.now();
    say(askLine(go), () => {
      if (!tappedYet.current) since.current = Date.now();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.playing]);

  function nextGo(all: Tap[]) {
    clearTimers();
    if (at + 1 < goes.length) {
      setAt(at + 1);
      setPhase('ask');
      setFlow(NEW_GO);
      setWhy(null);
      setTapped([]);
      return;
    }
    if (finale) {
      setPhase('finale');
      setPose('sing');
      say(WORDS.tenAndTen);
      if (sound) playSound('badge');
      later(FINALE_MS, () => onDone(all));
    } else {
      setPhase('done');
      later(400, () => onDone(all));
    }
  }

  function pick(n: number) {
    if (phase !== 'ask' || look || demo.playing || tapped.includes(n)) return;
    tappedYet.current = true;
    const now = Date.now();
    const next = [...taps, { pick: n, ms: now - since.current }];
    since.current = now;
    setTaps(next);
    const first = flow.wrong === 0;
    if (n !== go.answer) {
      if (first) {
        const run = streak + 1;
        setStreak(run);
        if (run >= STRUGGLE_GOES && !boost && round.help !== 'off') {
          setBoost(true);
          // Said once, and only if some go from here on was not already at level 5.
          if (goes.some((g, i) => i >= at && g.l < 5)) backLine.current = true;
        }
      }
      const after = stepGo(flow, 'wrong');
      setFlow(after);
      setTapped((t) => [...t, n]);
      setWobble(n);
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => setWobble(null));
      if (after.phase === 'look') {
        // The second wrong tap: the whole sum is played with the arrow cards, then the same go is asked again.
        setWhy(null);
        startLook({
          anchor: 0,
          steps: go.n,
          openingLine: WORDS.lookTogether,
          fillLine: WORDS.right(go.answer, go.n),
          onEnd: () => {
            setFlow((f) => stepGo(f, 'lookDone'));
            setTapped([]);
            since.current = Date.now();
            say(WORDS.nowTry);
          },
        });
        return;
      }
      const kind = go.wrongs.find((w) => w.n === n)!.kind;
      setWhy({ n, kind });
      if (backLine.current) say(WORDS.why(kind, n, go.v), () => say(WORDS.berriesBack));
      else say(WORDS.why(kind, n, go.v));
      backLine.current = false;
      return;
    }
    if (first) setStreak(0);
    clearTimers();
    setPointAt(null);
    setWhy(null);
    kinds.mark([KIND_OF_WAY[go.v]]);
    setPhase('right');
    setPose('eat');
    say(WORDS.right(go.answer, go.n));
    if (sound) playSound('badge');
    later(RIGHT_MS, () => nextGo(next));
  }

  const made = at + (phase === 'ask' ? 0 : 1);
  const style = backFor(scenery);
  // Four nests always; in "Now you try" they come back in a new order (the server only cares which nest was tapped).
  const nests = redo ? [...go.choices].reverse() : go.choices;

  if (demo.playing && demoWay !== null) {
    const shown: Go = { ...go, n: demoN, teen: 10 + demoN, l: 4 };
    const answered = demo.step >= 1;
    return (
      <div className={`tui-play tui-scene--${scenery}`} style={style}>
        <h2 className="tui-sr" tabIndex={-1} ref={heading}>{WORDS.demoTitle}</h2>
        <div className="tui-top">
          <div className="tui-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
            {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
              <span key={i} className={i < made ? 'tui-pip tui-pip--done' : 'tui-pip'} />
            ))}
          </div>
        </div>
        <div className="tui-stage">
          <span className="tui-stage__friend" aria-hidden="true"><Friend friend={friend} pose={answered ? 'cheer' : 'sit'} /></span>
          <Picture go={shown} level={4} pointAt={null} solved={answered} lit={null} />
          {!answered && <p className="tui-sum" aria-live="polite">{written(shown)}</p>}
          {answered && <ArrowCards n={demoN} />}
        </div>
        <DemoBar prefix="tui" skipLabel={WORDS.skip} canSkip={demo.canSkip} onSkip={demo.skip} />
      </div>
    );
  }

  return (
    <div className={`tui-play tui-scene--${scenery}`} style={style}>
      <h2 className="tui-sr" tabIndex={-1} ref={heading}>{WORDS.pickNest}</h2>
      <div className="tui-top">
        <div className="tui-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
          {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
            <span key={i} className={i < made ? 'tui-pip tui-pip--done' : 'tui-pip'} />
          ))}
        </div>
        <HearAgain prefix="tui" label={WORDS.hearAgain} onHear={() => say(askLine(go))} />
      </div>

      {phase === 'finale' ? (
        <div className="tui-finale" role="img" aria-label={WORDS.tenAndTen}>
          <div className="tui-finale__kete">
            <Kete className="tui-kete--in" />
            <span className="tui-finale__and">+</span>
            <Kete className="tui-kete--in tui-kete--late" />
          </div>
          <p className="tui-sum tui-sum--big">10 + 10 = 20</p>
        </div>
      ) : (
        <>
          <div className="tui-stage" key={at}>
            <span className="tui-stage__friend" aria-hidden="true"><Friend friend={friend} pose={pose} /></span>
            <Picture key={why ? `why${taps.length}` : 'p'} go={go} level={level} pointAt={pointAt} solved={phase !== 'ask'} lit={why?.kind ?? null} />
            {/* The sum from level 4 down; on "how many more?" and "take the ten away" always, as the picture can't say the target. */}
            {(level <= 4 || go.v >= 2) && phase === 'ask' && <p className={`tui-sum${level <= 2 ? ' tui-sum--big' : ''}`} aria-live="polite">{written(go)}</p>}
            {phase !== 'ask' && <ArrowCards n={go.n} />}
            {canPeek && !peek && phase === 'ask' && (
              <button type="button" className="tui-button tui-peek" onClick={() => setPeek(true)}>
                <span aria-hidden="true">🍃</span> {WORDS.peek}
              </button>
            )}
          </div>
          {why && phase === 'ask' && (
            <ShowWhy prefix="tui" tapKey={taps.length} picture={<WhyPicture kind={why.kind} wrong={why.n} />} line={WORDS.why(why.kind, why.n, go.v)} />
          )}
          {look && (
            <LookTogether prefix="tui" title={WORDS.lookTogether} picture={<ArrowCards n={go.n} />} line={WORDS.right(go.answer, go.n)} skipLabel={WORDS.goOn} canSkip={look.canSkip} onSkip={skipLook} />
          )}
          {redo && !why && phase === 'ask' && <NowYouTry prefix="tui" line={WORDS.nowTry} />}
          <div className={`tui-nests${pointAt === 'nests' ? ' tui-nests--guide' : ''}`} role="group" aria-label={WORDS.pickNest}>
            {nests.map((n) => (
              <button
                key={`${at}-${n}`}
                type="button"
                disabled={phase === 'ask' && (look !== null || tapped.includes(n))}
                className={`tui-choice${tapped.includes(n) && phase === 'ask' ? ' tui-choice--off' : ''}${wobble === n ? ' tui-choice--wobble' : ''}${phase !== 'ask' && n === go.answer ? ' tui-choice--right' : ''}${phase !== 'ask' && n !== go.answer ? ' tui-choice--off' : ''}`}
                onClick={() => pick(n)}
                aria-label={String(n)}
              >
                <Nest value={n} />
              </button>
            ))}
            {pointAt === 'nests' && <span className="tui-hand tui-hand--hover" aria-hidden="true">👆</span>}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The berries for a go at a help level. Levels 5 and 4: two ten-frames (the full branch and the loose berries, or the
 * empty spaces on "how many more?"). Levels 3 and 2: the ten is one kete with a "10" tag. Below 2: no picture.
 */
function Picture({ go, level, pointAt, solved, lit }: { go: Go; level: HelpLevel; pointAt: Guide; solved: boolean; lit: TuiKind | null }) {
  if (level <= 1) return null;
  const frames = level >= 4;
  const hand = (where: Guide) => pointAt === where && <span className="tui-hand" aria-hidden="true">👆</span>;
  const ten = (
    <div className={`tui-ten${go.v === 3 ? ' tui-ten--fly' : ''}${lit === 'ones' ? ' tui-lit' : ''}${lit === 'total' && go.v === 2 ? ' tui-grey' : ''}`} key="ten">
      {frames ? <TenFrame count={10} branch label={WORDS.berries(10)} /> : <Kete className="tui-kete--in" label={WORDS.keteOfTen} />}
      {hand('branch')}
    </div>
  );
  const missing = go.v === 2 && !solved;
  const ones = (
    <div className={`tui-ones${lit === 'ones' || (lit === 'total' && go.v === 2) ? ' tui-lit tui-lit--late' : ''}`} key="ones">
      {frames ? (
        missing ? (
          <TenFrame count={0} empty={go.n} label={WORDS.missing(go.n)} />
        ) : (
          <TenFrame count={go.n} popFrom={level === 5 && !solved ? 0 : undefined} label={WORDS.berries(go.n)} />
        )
      ) : missing ? (
        <span className="tui-gap" role="img" aria-label={WORDS.missing(go.n)}>?</span>
      ) : (
        <span className="tui-loose" role="img" aria-label={WORDS.berries(go.n)}>
          <TenFrame count={go.n} label={WORDS.berries(go.n)} />
        </span>
      )}
      {hand('loose')}
    </div>
  );
  return (
    <div className={`tui-picture${level === 2 ? ' tui-picture--faint' : ''}${frames ? '' : ' tui-picture--kete'}`}>
      {go.v === 1 ? [ones, ten] : [ten, ones]}
    </div>
  );
}

/** Place-value arrow cards: the ones card slides onto the 0 of the "10", and 10 and 4 is 14. */
function ArrowCards({ n }: { n: number }) {
  return (
    <div className="tui-cards" role="img" aria-label={`10 and ${n} is ${10 + n}`}>
      <span className="tui-card tui-card--ten">
        <span>1</span>
        <span>0</span>
      </span>
      <span className="tui-card tui-card--ones">
        <span>{n}</span>
      </span>
    </div>
  );
}

/** What a wrong nest's mistake looks like when it isn't the stage picture itself (the stage lights, greys or counts for the others). */
function WhyPicture({ kind, wrong }: { kind: TuiKind; wrong: number }) {
  if (kind === 'reverse') {
    // 41 is four tens and one: the cards pulled apart, not slid together.
    return (
      <div className="tui-cards tui-cards--apart" role="img" aria-label={`${Math.floor(wrong / 10)} tens and ${wrong % 10}`}>
        <span className="tui-card tui-card--ten">
          <span>{Math.floor(wrong / 10)}</span>
          <span>0</span>
        </span>
        <span className="tui-card tui-card--plain">
          <span>{wrong % 10}</span>
        </span>
      </div>
    );
  }
  if (kind === 'tens') {
    return (
      <div className="tui-twotens" role="img" aria-label="Two tens">
        <TenFrame count={10} branch label={WORDS.berries(10)} />
        <TenFrame count={10} branch label={WORDS.berries(10)} />
      </div>
    );
  }
  return null;
}
