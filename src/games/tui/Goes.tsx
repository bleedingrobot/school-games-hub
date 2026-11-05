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
 * answer is never shown or said. After every right answer, the arrow cards: the ones card slides onto the 0 of the
 * "10" and makes the teen number, at every level. Only the picks are sent; the server replays them.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Tap } from '../../../shared/tui/play';
import type { Friend as FriendName } from '../../../shared/tui/progress';
import { GOES_PER_ROUND, pictureFor, showRound, type Go, type HelpLevel, type Round } from '../../../shared/tui/round';
import { playSound } from '../sounds';
import { backFor, Friend, Kete, Nest, TenFrame, type Pose, type Scenery } from './art';
import { askLine, storyLine, sumLine } from './voiceLines';
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
  sound: boolean;
  say: (text: string) => void;
  onDone: (taps: Tap[]) => void;
}

/** The sum as written: "10 + 4 = ?", with a real minus sign. */
const written = (go: Go) => go.parts.join(' ').replace(/-/g, '−');

export function Goes({ round, scenery, friend, guide = false, finale = false, sound, say, onDone }: Props) {
  const goes = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [wrongs, setWrongs] = useState(0);
  const [tapped, setTapped] = useState<number[]>([]);
  const [wobble, setWobble] = useState<number | null>(null);
  const [peek, setPeek] = useState(false);
  const [pointAt, setPointAt] = useState<Guide>(null);
  const [pose, setPose] = useState<Pose>('sit');
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
  const pic = pictureFor(go, wrongs, tapped);
  // Level 1's Peek (opened by the child or by a wrong tap) brings back level 3's picture. Off has no Peek.
  const canPeek = go.l === 1 && round.help !== 'off' && pic.level <= 1;
  const level: HelpLevel = pic.level <= 1 && (pic.peekOpen || peek) ? 3 : pic.level;

  // Each new go is read aloud once.
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    since.current = Date.now();
    setPose('sit');
    setPeek(false);
    say(askLine(go));
    if (guided) {
      later(GUIDE_AT.branch, () => setPointAt('branch'));
      later(GUIDE_AT.loose, () => setPointAt('loose'));
      later(GUIDE_AT.nests, () => setPointAt('nests'));
    } else setPointAt(null);
    // Read again only when the go changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, goes]);

  function nextGo(all: Tap[]) {
    clearTimers();
    if (at + 1 < goes.length) {
      setAt(at + 1);
      setPhase('ask');
      setWrongs(0);
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
    if (phase !== 'ask') return;
    const now = Date.now();
    const next = [...taps, { pick: n, ms: now - since.current }];
    since.current = now;
    setTaps(next);
    if (n !== go.answer) {
      const w = wrongs + 1;
      setWrongs(w);
      setTapped((t) => [...t, n]);
      setWobble(n);
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => setWobble(null));
      // The second wrong tap brings every berry back, and Bella tells the story.
      say(w === 2 ? storyLine(go) : WORDS.tryAgain);
      return;
    }
    clearTimers();
    setPointAt(null);
    setPhase('right');
    setPose('eat');
    say(WORDS.right(go.answer, go.n));
    if (sound) playSound('badge');
    later(RIGHT_MS, () => nextGo(next));
  }

  const made = at + (phase === 'ask' ? 0 : 1);
  const style = backFor(scenery);
  const nests = phase === 'ask' ? pic.nests : go.choices;

  return (
    <div className={`tui-play tui-scene--${scenery}`} style={style}>
      <h2 className="tui-sr" tabIndex={-1} ref={heading}>{WORDS.pickNest}</h2>
      <div className="tui-top">
        <div className="tui-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
          {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
            <span key={i} className={i < made ? 'tui-pip tui-pip--done' : 'tui-pip'} />
          ))}
        </div>
        <button type="button" className="tui-button" onClick={() => say(sumLine(go))}>
          <span aria-hidden="true">👂</span> {WORDS.hearAgain}
        </button>
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
            <Picture go={go} level={level} pointAt={pointAt} solved={phase !== 'ask'} />
            {/* The sum from level 4 down; on "how many more?" and "take the ten away" always, as the picture can't say the target. */}
            {(level <= 4 || go.v >= 2) && phase === 'ask' && <p className={`tui-sum${level <= 2 ? ' tui-sum--big' : ''}`} aria-live="polite">{written(go)}</p>}
            {phase !== 'ask' && <ArrowCards n={go.n} />}
            {canPeek && !peek && phase === 'ask' && (
              <button type="button" className="tui-button tui-peek" onClick={() => setPeek(true)}>
                <span aria-hidden="true">🍃</span> {WORDS.peek}
              </button>
            )}
          </div>
          <div className={`tui-nests${pointAt === 'nests' ? ' tui-nests--guide' : ''}`} role="group" aria-label={WORDS.pickNest}>
            {nests.map((n) => (
              <button
                key={`${at}-${n}`}
                type="button"
                className={`tui-choice${wobble === n ? ' tui-choice--wobble' : ''}${phase !== 'ask' && n === go.answer ? ' tui-choice--right' : ''}${phase !== 'ask' && n !== go.answer ? ' tui-choice--off' : ''}`}
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
function Picture({ go, level, pointAt, solved }: { go: Go; level: HelpLevel; pointAt: Guide; solved: boolean }) {
  if (level <= 1) return null;
  const frames = level >= 4;
  const hand = (where: Guide) => pointAt === where && <span className="tui-hand" aria-hidden="true">👆</span>;
  const ten = (
    <div className={`tui-ten${go.v === 3 ? ' tui-ten--fly' : ''}`} key="ten">
      {frames ? <TenFrame count={10} branch label={WORDS.berries(10)} /> : <Kete className="tui-kete--in" label={WORDS.keteOfTen} />}
      {hand('branch')}
    </div>
  );
  const missing = go.v === 2 && !solved;
  const ones = (
    <div className="tui-ones" key="ones">
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
