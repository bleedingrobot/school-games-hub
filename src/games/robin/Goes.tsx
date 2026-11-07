/**
 * Today's challenge at Robin’s Berry Basket: ten goes of counting out a set (docs/ROBIN-PLAN.md).
 *
 *  - Give me N: a pile of berries and a basket. Each tap on a pile berry puts it in the basket; the child presses
 *    "That's all" when there are N. The game never stops them: stopping is the maths. The pick sent is the count in the basket.
 *  - How many: a group of berries (in rows, scattered or in a ring). The child touches each berry (it dims, and the count
 *    shows or is said, by help level), then taps the number on one of four cards.
 *  - One more: a plate under a cloth shows how many are under it; one more berry comes; how many now? Four cards.
 *
 * Each go comes with its help level from the server: 5 numbered slots in the basket and Bella says each number; 4 numbered
 * slots; 3 a plain basket and Bella says each number; 2 the number above the basket; 1 nothing, but a Peek; 0 a free pile.
 * A first wrong tap lifts that go's level by one, a second takes it to the top (levelFor), and three goes in a row with a
 * wrong first tap keep the top level for the round. The answer is never shown or said before a right tap.
 *
 * Mistakes that teach: the first wrong tap says what went wrong, with a small picture; the second is "Let's count again"
 * (Robin counts along), then "Now you try!" (a give go shows the lit space to stop at, other goes two cards). Only a go's
 * first tap is scored (play.ts). Only the picks are sent; the server replays them.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { STRUGGLE_GOES } from '../../../shared/kit/help';
import { NEW_GO, stepGo } from '../../../shared/kit/mistakes';
import { helpShows, type Friend as FriendName } from '../../../shared/robin/config';
import type { Tap } from '../../../shared/robin/play';
import { GOES_PER_ROUND, levelFor, redoCards, showRound, type Go, type Round, type Slip } from '../../../shared/robin/round';
import { HearAgain } from '../../kit/HearAgain';
import { PointingHand } from '../../kit/PointingHand';
import { LookTogether, NowYouTry, ShowWhy, useLookTogether } from '../../kit/ShowWhy';
import { useGuidedFirstGo } from '../../kit/useGuidedFirstGo';
import { playSound } from '../sounds';
import { Basket, Berry, BerrySvg, Friend, Plate, sceneStyle, type Pose } from './art';
import { askLine, countLine, modelLine, whyLine } from './voiceLines';
import { WORDS } from './words';

const RIGHT_MS = 3200;
const WOBBLE_MS = 600;
const LAUGH_MS = 1400;
/** The guided first go: after this pause the hand points at the next berry, then at That's all. */
const GUIDE_MS = 3000;

type Phase = 'ask' | 'right' | 'done';

interface Props {
  round: Round;
  friend: FriendName;
  /** The child's very first challenge: a hand shows them the way on the first go. */
  guide?: boolean;
  sound: boolean;
  say: (text: string, onEnd?: () => void) => void;
  onDone: (taps: Tap[]) => void;
}

/** After a wrong tap: the berries that were counted (or given), as a small row, so the slip can be seen. */
function WhyPicture({ pick, kind }: { pick: number; kind: Slip }) {
  const shown = Math.min(pick, 24);
  return (
    <div className={`rb-whypic rb-whypic--${kind}`} aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => <BerrySvg key={i} />)}
    </div>
  );
}

/** "Let's count again": the berries count up one at a time (in the basket for a give go, marked in the group otherwise). */
function CountingPicture({ go, filled }: { go: Go; filled: number }) {
  const shown = Math.min(filled, go.answer);
  if (go.kind === 'give') return <Basket placed={shown} slots above={false} lit={null} label={WORDS.basketLabel(shown)} />;
  return (
    <div className="rb-group" role="img" aria-label={WORDS.groupLabel}>
      {go.points.map((p, i) => (
        <span key={i} className="rb-berrybtn" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          <Berry mark={i < shown && go.kind === 'howmany' ? i + 1 : null} dim={false} />
        </span>
      ))}
    </div>
  );
}

export function Goes({ round, friend, guide = false, sound, say, onDone }: Props) {
  const goes = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  /** The go's place in the two-tap flow (shared/kit/mistakes.ts). */
  const [flow, setFlow] = useState(NEW_GO);
  /** The last wrong pick's mistake, shown with its line until the next tap. */
  const [why, setWhy] = useState<{ pick: number; kind: Slip } | null>(null);
  const { look, start: startLook, skip: skipLook } = useLookTogether(say);
  const [tapped, setTapped] = useState<number[]>([]);
  /** The two cards of "Now you try", the right one among them. */
  const [redo, setRedo] = useState<number[] | null>(null);
  /** Which pile berries are in the basket (give goes), in order; which group berries are counted (the others). */
  const [taken, setTaken] = useState<number[]>([]);
  const [marked, setMarked] = useState<number[]>([]);
  const [wobble, setWobble] = useState<number | null>(null);
  const [needOne, setNeedOne] = useState(false);
  const [peek, setPeek] = useState(false);
  /** Three goes in a row wrong at the first tap: the top level for the rest of the round. */
  const [struggle, setStruggle] = useState(false);
  const run = useRef(0);
  const [pose, setPose] = useState<Pose>('sit');
  const since = useRef(Date.now());
  const tappedYet = useRef(false);
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
  const guideHand = useGuidedFirstGo(guided, GUIDE_MS);
  const inRedo = flow.phase === 'redo';
  const { level, peek: canPeekHere } = levelFor(go.l, flow.wrong, struggle, round.help);
  const shows = helpShows(level);
  const peekOpen = peek || (flow.wrong >= 1 && level <= 1);
  const slots = shows.slots || peekOpen || inRedo;
  const asking = phase === 'ask';
  const placed = taken.length;

  // Each new go is read aloud once.
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    // The clock starts now (a tap during the voice is still timed) and again once the question has been heard.
    let live_ = true;
    tappedYet.current = false;
    since.current = Date.now();
    setPose('sit');
    setPeek(false);
    say(askLine(go), () => {
      if (live_ && !tappedYet.current) since.current = Date.now();
    });
    guideHand.stop();
    guideHand.start();
    return () => {
      live_ = false;
    };
    // Read again only when the go changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, goes]);

  function nextGo(all: Tap[]) {
    clearTimers();
    guideHand.stop();
    if (at + 1 < goes.length) {
      setAt(at + 1);
      setPhase('ask');
      setFlow(NEW_GO);
      setWhy(null);
      setTapped([]);
      setRedo(null);
      setTaken([]);
      setMarked([]);
      setNeedOne(false);
      return;
    }
    setPhase('done');
    later(400, () => onDone(all));
  }

  function pick(n: number) {
    if (phase !== 'ask' || look || tapped.includes(n)) return;
    tappedYet.current = true;
    guideHand.stop();
    setNeedOne(false);
    const now = Date.now();
    const next = [...taps, { pick: n, ms: now - since.current }];
    since.current = now;
    setTaps(next);
    if (n !== go.answer) {
      const after = stepGo(flow, 'wrong');
      const nowTapped = [...tapped, n];
      setFlow(after);
      setTapped(nowTapped);
      setWobble(n);
      setPose('laugh');
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => setWobble(null));
      later(LAUGH_MS, () => setPose('sit'));
      if (after.phase === 'look') {
        // The second wrong tap: Robin counts along, then the same go is asked again.
        setWhy(null);
        const two = go.kind === 'give' ? null : redoCards(go, nowTapped);
        startLook({
          anchor: 0,
          steps: Math.max(1, go.answer),
          openingLine: WORDS.lookTogether,
          fillLine: WORDS.lookFill,
          onEnd: () => {
            setFlow((f) => stepGo(f, 'lookDone'));
            setTapped([]);
            setRedo(two);
            setTaken([]);
            setMarked([]);
            since.current = Date.now();
            say(WORDS.nowTry);
          },
        });
        return;
      }
      const kind: Slip = go.kind === 'give' ? (n > go.answer ? 'over' : 'under') : go.wrongs.find((w) => w.n === n)?.kind ?? 'near';
      setWhy({ pick: n, kind });
      say(whyLine(kind));
      return;
    }
    clearTimers();
    setWhy(null);
    setPhase('right');
    setPose('cheer');
    if (go.kind === 'give') setTaken(Array.from({ length: go.answer }, (_, i) => i));
    else setMarked(go.points.map((_, i) => i));
    // Three goes in a row wrong at the first tap keep the top level for the round.
    run.current = flow.wrong > 0 ? run.current + 1 : 0;
    if (run.current >= STRUGGLE_GOES) setStruggle(true);
    say(modelLine(go));
    if (sound) playSound('badge');
    later(RIGHT_MS, () => nextGo(next));
  }

  /** A pile berry goes into the basket. */
  function takeBerry(i: number) {
    if (!asking || look || taken.includes(i)) return;
    tappedYet.current = true;
    guideHand.stop();
    setNeedOne(false);
    setTaken([...taken, i]);
    if (shows.says) say(countLine(placed + 1));
    if (guided) guideHand.start();
  }
  const putBack = () => asking && !look && placed > 0 && setTaken(taken.slice(0, -1));

  /** A group berry is counted (when the help lets it be marked). */
  function markBerry(i: number) {
    if (!asking || look || marked.includes(i) || !(shows.dims || peekOpen || inRedo)) return;
    tappedYet.current = true;
    setMarked([...marked, i]);
    if (shows.says || inRedo) say(countLine(marked.length + 1));
  }

  function thatsAll() {
    if (!asking || look) return;
    if (placed === 0) {
      // Nothing in the basket yet: say why with a picture (a berry going into the basket), no pick is sent.
      setNeedOne(true);
      say(WORDS.putOneFirst);
      return;
    }
    if (tapped.includes(placed) || (guided && placed !== go.answer)) return;
    pick(placed);
  }

  const made = at + (phase === 'ask' ? 0 : 1);
  const cards = inRedo && redo ? redo : go.choices;
  const nextBerry = go.kind === 'give' ? go.points.findIndex((_, i) => !taken.includes(i)) : -1;
  const guideOnAll = guided && go.kind === 'give' && placed === go.answer;
  const pointing = guideHand.pointing && asking;
  const guidedBlock = guided && go.kind === 'give' && placed !== go.answer;
  const countedNow = marked.length;

  return (
    <div className="rb-play rb-scene" style={sceneStyle()}>
      <h2 className="rb-sr" tabIndex={-1} ref={heading}>{go.kind === 'give' ? WORDS.pickGive : WORDS.pickCard}</h2>
      <div className="rb-top">
        <div className="rb-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
          {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
            <span key={i} className={i < made ? 'rb-pip rb-pip--done' : 'rb-pip'} />
          ))}
        </div>
        <HearAgain prefix="rb" label={WORDS.hearAgain} onHear={() => say(askLine(go))} />
      </div>

      {go.kind === 'give' && <p className="rb-ask" aria-hidden="true">Give me <strong>{go.n}</strong></p>}

      <div className="rb-stage" key={at}>
        <span className="rb-stage__friend" aria-hidden="true"><Friend friend={friend} pose={pose} /></span>

        {go.kind === 'give' && (
          <div className="rb-give">
            <div className="rb-pile" role="group" aria-label={WORDS.pileLabel}>
              {go.points.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className={`rb-berrybtn${taken.includes(i) ? ' rb-berrybtn--gone' : ''}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  disabled={!asking || look !== null || taken.includes(i)}
                  onClick={() => takeBerry(i)}
                  aria-label={`${WORDS.pileLabel}, ${i + 1}`}
                >
                  <Berry />
                  {pointing && guided && i === nextBerry && placed < go.answer && <PointingHand prefix="rb" />}
                </button>
              ))}
            </div>
            <Basket placed={placed} slots={slots} above={shows.numberAbove} lit={inRedo && asking ? go.answer : null} label={WORDS.basketLabel(placed)} />
            <div className="rb-give__row">
              <button type="button" className="rb-button rb-takeback" onClick={putBack} disabled={!asking || look !== null || placed === 0}>
                <span aria-hidden="true">↩</span> {WORDS.takeBack}
              </button>
              <button
                type="button"
                className="button button--play rb-thatsall"
                onClick={thatsAll}
                aria-disabled={!asking || look !== null || placed === 0 || guidedBlock || tapped.includes(placed)}
                aria-label={guideOnAll && pointing ? `${WORDS.thatsAll}, ${WORDS.guideHere}` : WORDS.thatsAll}
              >
                <span aria-hidden="true">✓</span> {WORDS.thatsAll}
                {pointing && guideOnAll && <PointingHand prefix="rb" />}
              </button>
              {needOne && <span className="rb-needone" aria-hidden="true"><BerrySvg />→🧺</span>}
            </div>
          </div>
        )}

        {go.kind === 'howmany' && (
          <>
            <div className="rb-group" role="group" aria-label={WORDS.groupLabel}>
              {go.points.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className={`rb-berrybtn${peekOpen && !shows.dims ? ' rb-berrybtn--peek' : ''}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  disabled={!asking || look !== null}
                  onClick={() => markBerry(i)}
                  aria-label={`${WORDS.groupLabel}, ${i + 1}`}
                >
                  <Berry dim={marked.includes(i)} mark={marked.includes(i) && (shows.says || shows.dims || inRedo) ? marked.indexOf(i) + 1 : null} />
                </button>
              ))}
            </div>
            {(shows.numberAbove || peekOpen) && <p className="rb-count" aria-live="polite">{countedNow}</p>}
            {asking && canPeekHere && level <= 1 && !peekOpen && (
              <button type="button" className="rb-button rb-peek" onClick={() => setPeek(true)}>
                <span aria-hidden="true">👀</span> {WORDS.peek}
              </button>
            )}
          </>
        )}

        {go.kind === 'counton' && <Plate n={go.n} more />}
      </div>

      {why && asking && <ShowWhy prefix="rb" tapKey={taps.length} picture={<WhyPicture pick={why.pick} kind={why.kind} />} line={WORDS.why(why.kind)} />}
      {look && (
        <LookTogether prefix="rb" title={WORDS.lookTogether} picture={<CountingPicture go={go} filled={look.filled} />} line={WORDS.lookFill} skipLabel={WORDS.goOn} canSkip={look.canSkip} onSkip={skipLook} />
      )}
      {inRedo && !why && asking && <NowYouTry prefix="rb" line={WORDS.nowTry} />}

      {go.kind !== 'give' && (
        <div className="rb-cards" role="group" aria-label={WORDS.pickCard}>
          {cards.map((n) => {
            const off = (asking && tapped.includes(n)) || (!asking && n !== go.answer);
            const hint = inRedo && asking && n === go.answer;
            return (
              <button
                key={`${at}-${n}`}
                type="button"
                disabled={asking && (look !== null || tapped.includes(n))}
                className={`rb-choice${off ? ' rb-choice--off' : ''}${wobble === n ? ' rb-choice--wobble' : ''}${hint ? ' rb-choice--hint' : ''}${!asking && n === go.answer ? ' rb-choice--right' : ''}`}
                onClick={() => pick(n)}
                aria-label={hint ? `${n}, ${WORDS.guideHere}` : String(n)}
              >
                <span className="rb-choice__value">{n}</span>
                {hint && <PointingHand prefix="rb" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
