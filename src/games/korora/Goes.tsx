/**
 * Today's challenge at Penguin Pairs: ten goes with Two-Shoes at the mirror pool (docs/KORORA-PLAN.md).
 *
 *  - A double: fish land on the rock and the still pool shows the same fish upside down. How many fish now?
 *  - A near double (level 5, 6 + 7): the rock's fish and the water's, with one extra fish in the water. How many fish?
 *  - A half: a pile of fish to share fairly between the two chicks. How many does each chick get?
 *  - Fair or not (gold days, R9, FairPile.tsx): a real pile of 6 to 20 fish; the child shares it into two bowls, two fish at a time,
 *    then picks Fair share, One too many or One too few. Hint after the second wrong pick: the fish pair off. Bella counts one bowl.
 *
 * The support James chose (4 Nov 2026), all in this screen:
 *  - help that follows the child, fact by fact (maths review R6, each go's `h` from shared/korora/round.ts): a fact still
 *    new shows a clear reflection with each fish joined to its mirror fish and shares halves out one by one; then a
 *    faint, rippled reflection and the pile only; then the words only. A go with no `h` (a round saved before R6) shows
 *    the calendar's help for the round: bronze days full, silver faint, gold none. The teacher's setting still wins;
 *  - mistakes that teach (maths review R5, shared/kit/mistakes.ts): every wrong stone of a double or a half is a real
 *    mistake (shared/korora/round.ts). The first wrong tap of a go greys that stone out and shows the mistake's picture
 *    with a line (WhyPicture.tsx). The second stops the free taps: "Let's look together", the full picture and Bella
 *    explaining the whole go, counting the fish. Then the same go comes back ("Now you try") with every stone back in a
 *    new order, at the child's own help level; wrong taps there show why again and the hand points after two. Fair or
 *    not keeps its old wobble and "Try again!" (R9);
 *  - fish sit in rows of five, like a ten-frame, a short row lined up on the left (James, 4 Nov 2026);
 *  - tap a fish to count it (doubles), or to give it to a chick (halves and fair or not);
 *  - a double comes just before its half, with the same fish (the rules put them together);
 *  - after three goes in a row with a wrong first tap, the full pictures come back for the rest of the round (not
 *    saved), with a line that says so once. The teacher's "off" keeps them away;
 *  - "Hear it again" reads the question again.
 * None of this changes what counts: the taps are replayed by the server, which records the first pick of each fact.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Tap } from '../../../shared/korora/play';
import type { Friend as FriendName, Help } from '../../../shared/korora/progress';
import { followsItsDouble, GOES_PER_ROUND, showRound, type Go, type Round, type WrongKind } from '../../../shared/korora/round';
import { helpWithSetting, STRUGGLE_GOES, type HelpSetting } from '../../../shared/kit/help';
import { LOOK_AT, NEW_GO, stepGo } from '../../../shared/kit/mistakes';
import { LookTogether, NowYouTry, ShowWhy, useLookTogether } from '../../kit/ShowWhy';
import { playSound } from '../sounds';
import { FairPile, COUNT_MS } from './FairPile';
import { Chick, Fish, Friend, Pebble } from './KororaArt';
import { backFor, type Scenery } from './Pool';
import { goLine, whyLine } from './voiceLines';
import { WhyPicture } from './WhyPicture';
import { WORDS } from './words';

const RIGHT_MS = 1600;
const WOBBLE_MS = 500;
const SHARE_MS = 320;
interface Props {
  round: Round;
  /** The help for a go saved with none of its own (a round open before R6): the calendar's, from the pebbles. */
  help: Help;
  /** The teacher's setting: 'always' and 'off' win over the child's own help, and 'off' keeps the three-in-a-row boost away too. */
  setting?: HelpSetting;
  scenery: Scenery;
  friend: FriendName;
  /** The child's very first challenge: a hand shows them the way on the first go. */
  guide?: boolean;
  sound: boolean;
  say: (text: string, onEnd?: () => void) => void;
  onDone: (taps: Tap[]) => void;
}

type Phase = 'ask' | 'right' | 'done';

/** A new order for the same stones: never the order they were in, when there is another. */
function reordered(items: number[]): number[] {
  for (let tries = 0; tries < 8; tries++) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.some((x, i) => x !== items[i])) return out;
  }
  return [...items].reverse();
}

/** The ids of a go's fish in the order they are counted: the rock's then the water's (doubles), or the pile's. */
const fishIdsOf = (go: Go): string[] =>
  go.kind === 'double' || go.kind === 'near'
    ? [...Array.from({ length: go.n }, (_, i) => `r${i}`), ...Array.from({ length: go.n + (go.kind === 'near' ? 1 : 0) }, (_, i) => `w${i}`)]
    : Array.from({ length: go.n }, (_, i) => `p${i}`);

/** The three choices of fair or not: 1 fair, 0 one too many, 2 one too few. */
const fairLabel = (n: number) => (n === 1 ? WORDS.fair : n === 0 ? WORDS.tooMany : WORDS.tooFew);

/** Fish in rows of five, like a ten-frame: [5, 5, 2] for 12. */
const rowsOf = (n: number) => Array.from({ length: Math.ceil(n / 5) }, (_, r) => Math.min(5, n - r * 5));

export function Goes({ round, help, setting = 'fade', scenery, friend, guide = false, sound, say, onDone }: Props) {
  const goes = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [wobble, setWobble] = useState<number | null>(null);
  /** Wrong taps on this go, for the streak and (fair or not) the hand. */
  const [wrongs, setWrongs] = useState(0);
  /** The go's place in the two-tap flow (shared/kit/mistakes.ts). */
  const [flow, setFlow] = useState(NEW_GO);
  /** The stones tapped wrong on this go, greyed out until "Now you try", and the last one's mistake, shown with its line. */
  const [greyed, setGreyed] = useState<number[]>([]);
  const [why, setWhy] = useState<{ n: number; kind: WrongKind; tap: number } | null>(null);
  /** The stones in a new order for "Now you try". */
  const [redoOrder, setRedoOrder] = useState<number[] | null>(null);
  const { look, start: startLook, skip: skipLook } = useLookTogether(say);
  /** Goes in a row with a wrong first tap, and whether the full pictures have come back for the round. */
  const [streak, setStreak] = useState(0);
  const [boost, setBoost] = useState(false);
  /** Set when the boost has just begun and its line is still to be said, after the line for the wrong tap. */
  const backLine = useRef(false);
  /** Fish tapped (or counted with Bella), in order: their count shows on them. */
  const [counted, setCounted] = useState<string[]>([]);
  /** Fish given to each chick, by their place in the pile. */
  const [shared, setShared] = useState<number[]>([]);
  /** Fair or not (R9): the pile is shared out (the choices wait for that), and the pairing-off hint after the second wrong choice. */
  const [sorted, setSorted] = useState(false);
  const [pairHint, setPairHint] = useState(false);
  /** The guided first go's hand: on the rock's fish, then the water's, then the right number. */
  const [guideStep, setGuideStep] = useState<0 | 1 | 2>(0);
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

  const go: Go = goes[Math.min(at, goes.length - 1)];
  const guided = guide && at === 0;
  const line = goLine(go, guided, followsItsDouble(round.goes, at));
  // "Let's look together" shows the full picture; "Now you try" goes back to the child's own help level, not more.
  const helpAt = (i: number): Help => helpWithSetting(round.goes[i]?.h ?? help, setting, { always: 'full', off: 'none' });
  const ownHelp = helpAt(at);
  const shown: Help = (boost && setting !== 'off') || flow.phase === 'look' ? 'full' : ownHelp;
  const mirror = go.kind === 'double' || go.kind === 'near';
  const lookLine = go.kind === 'near' ? WORDS.lookNear(go.n) : go.kind === 'double' ? WORDS.lookDouble(go.n) : WORDS.lookHalf(go.n);
  const lookIds = mirror ? fishIdsOf(go) : fishIdsOf(go).filter((_, i) => i % 2 === 0);

  // Each new go is read aloud once; bronze-day halves share themselves out while the child watches.
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    // The clock starts now (a tap during the voice is still timed) and again once the question has been heard.
    let live = true;
    tappedYet.current = false;
    since.current = Date.now();
    say(line, () => {
      if (live && !tappedYet.current) since.current = Date.now();
    });
    setGuideStep(0);
    if (guided) {
      later(1800, () => setGuideStep(1));
      later(3600, () => setGuideStep(2));
    }
    if (go.kind === 'half' && (ownHelp === 'full' || (boost && setting !== 'off'))) shareAll(go.n, 1200);
    return () => {
      live = false;
    };
    // Read again only when the go changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, goes]);

  /** Shares the rest of the pile out, one each in turn. */
  function shareAll(n: number, wait = 0) {
    for (let i = 0; i < n; i++) {
      later(wait + i * SHARE_MS, () => setShared((s) => (s.includes(i) || s.length >= n ? s : [...s, i])));
    }
  }

  /** The second wrong tap of a go: Bella explains the whole go with the full picture, then the same go is asked again. */
  function lookTogether() {
    setWhy(null);
    setCounted([]);
    if (go.kind === 'half') shareAll(go.n, 1000);
    startLook({
      anchor: 0,
      steps: mirror ? go.answer : go.n / 2,
      openingLine: WORDS.lookTogether,
      fillLine: lookLine,
      onEnd: () => {
        setFlow((f) => stepGo(f, 'lookDone'));
        setGreyed([]);
        setRedoOrder(reordered(go.choices));
        setCounted([]);
        // The pile goes back to how the child's own help level shows it.
        if (!(go.kind === 'half' && (ownHelp === 'full' || (boost && setting !== 'off')))) setShared([]);
        since.current = Date.now();
        say(WORDS.nowTry, () => say(line));
      },
    });
  }

  function pick(n: number) {
    if (phase !== 'ask' || look || flow.phase === 'look' || greyed.includes(n)) return;
    tappedYet.current = true;
    const now = Date.now();
    const next = [...taps, { pick: n, ms: now - since.current }];
    since.current = now;
    setTaps(next);
    const first = wrongs === 0;
    if (n !== go.answer) {
      const w = wrongs + 1;
      setWrongs(w);
      if (first) {
        const s = streak + 1;
        setStreak(s);
        if (s >= STRUGGLE_GOES && !boost && setting !== 'off') {
          setBoost(true);
          // Said once, after the why-line, and only if some go from here on was not already showing the full picture.
          if (goes.some((_, i) => i >= at && helpAt(i) !== 'full')) backLine.current = true;
        }
      }
      setWobble(n);
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => setWobble(null));
      const kind = go.wrongs.find((x) => x.n === n)?.kind;
      if (!kind) {
        // Fair or not: "Try again!", and after the second wrong choice the fish pair off (R9).
        const line = w === 2 ? WORDS.pairOff : WORDS.tryAgain;
        if (w === 2) setPairHint(true);
        if (backLine.current) say(line, () => say(WORDS.picturesBack));
        else say(line);
        backLine.current = false;
        return;
      }
      const after = stepGo(flow, 'wrong');
      setFlow(after);
      setGreyed((g) => [...g, n]);
      if (after.phase === 'look') lookTogether();
      else {
        setWhy({ n, kind, tap: next.length });
        if (backLine.current) say(whyLine(go, kind), () => say(WORDS.picturesBack));
        else say(whyLine(go, kind));
        backLine.current = false;
      }
      return;
    }
    if (first) setStreak(0);
    setFlow(stepGo(flow, 'right'));
    setWhy(null);
    clearTimers();
    setPhase('right');
    setGuideStep(2);
    const bowl = Math.floor(go.n / 2);
    say(go.kind === 'fair' ? (go.answer === 1 ? WORDS.fairYes(bowl) : WORDS.oddYes(bowl)) : WORDS.yes(n));
    if (sound) playSound('badge');
    // The rest of the pile goes to the chicks (a half). Fair or not has been shared by the child already and counts one bowl together.
    if (!mirror && go.kind !== 'fair') shareAll(go.n);
    const wait = mirror ? RIGHT_MS : go.kind === 'fair' ? 4800 + bowl * COUNT_MS : Math.max(RIGHT_MS, go.n * SHARE_MS + 600);
    later(wait, () => {
      if (at + 1 >= goes.length) {
        setPhase('done');
        later(600, () => onDone(next));
      } else {
        setAt(at + 1);
        setPhase('ask');
        setWrongs(0);
        setGreyed([]);
        setRedoOrder(null);
        setCounted([]);
        setShared([]);
        setSorted(false);
        setPairHint(false);
      }
    });
  }

  /** Tapping a fish: count it (doubles), or give it to the next chick (halves, fair or not) on days the pile shows. */
  function tapFish(id: string, pileIndex?: number) {
    if (pileIndex !== undefined) {
      setShared((s) => (s.includes(pileIndex) ? s : [...s, pileIndex]));
      if (sound) playSound('tap');
      return;
    }
    setCounted((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  const locked = go.kind === 'fair' && phase === 'ask' && !sorted;
  const hand = go.kind === 'fair' ? wrongs >= 3 && sorted : flow.phase === 'redo' && flow.wrong >= LOOK_AT + 2;
  const lookCounted = look ? lookIds.slice(0, look.filled) : counted;
  const pointAt = phase === 'ask' && !look && ((guided && guideStep === 2) || hand) ? go.answer : null;
  const made = at + (phase === 'ask' ? 0 : 1);
  const pose = phase === 'right' || phase === 'done' ? (mirror ? 'gulp' : 'cheer') : 'wait';
  const style = { ...backFor(scenery) } as CSSProperties;

  return (
    <div className={`kr-play kr-pool--${scenery}`} style={style}>
      <h2 className="kr-sr" tabIndex={-1} ref={heading}>{WORDS.pickNumber}</h2>
      <div className="kr-top">
        <div className="kr-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
          {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
            <span key={i} className={i < made ? 'kr-pip kr-pip--done' : 'kr-pip'} />
          ))}
        </div>
        <button type="button" className="kr-button" disabled={look !== null} onClick={() => say(line)}>
          <span aria-hidden="true">👂</span> {WORDS.hearAgain}
        </button>
      </div>
      <p className="kr-ask" aria-live="polite">{go.kind === 'fair' ? `${go.n} fish: share them, then fair or not?` : go.parts.join(' ')}</p>
      <div className="kr-scene" key={at}>
        <span className={`kr-scene__friend${mirror ? '' : ' kr-scene__friend--low'}`}>
          <Friend friend={friend} pose={pose} />
        </span>
        {mirror ? (
          <Mirror go={go} help={shown} phase={phase} counted={lookCounted} guide={guided && phase === 'ask' ? guideStep : null} onFish={tapFish} />
        ) : go.kind === 'fair' ? (
          <FairPile go={go} help={shown} phase={phase} hint={pairHint} sound={sound} onSorted={setSorted} />
        ) : (
          <Share go={go} help={shown} phase={phase} counted={lookCounted} shared={shared} onFish={tapFish} />
        )}
      </div>
      <div className="kr-answer">
        {why && <ShowWhy prefix="kr" tapKey={why.tap} picture={<WhyPicture go={go} kind={why.kind} />} line={whyLine(go, why.kind)} />}
        {look && (
          <LookTogether
            prefix="kr"
            title={WORDS.lookTogether}
            picture={null}
            line={lookLine}
            skipLabel={WORDS.goOn}
            canSkip={look.canSkip}
            onSkip={skipLook}
          />
        )}
        {flow.phase === 'redo' && !why && <NowYouTry prefix="kr" line={WORDS.nowTry} />}
        <div className={`kr-choices${go.kind === 'fair' ? ' kr-choices--fair' : ''}${locked ? ' kr-choices--wait' : ''}`} role="group" aria-label={WORDS.pickNumber}>
          {(redoOrder ?? go.choices).map((n) => (
            <button
              key={`${at}-${n}`}
              type="button"
              className={`kr-choice${wobble === n ? ' kr-choice--wobble' : ''}${phase !== 'ask' && n === go.answer ? ' kr-choice--right' : ''}${n === pointAt ? ' kr-choice--pointed' : ''}${greyed.includes(n) ? ' kr-choice--grey' : ''}`}
              disabled={greyed.includes(n) || locked}
              onClick={() => pick(n)}
              aria-label={`${go.kind === 'fair' ? fairLabel(n) : n}${n === pointAt ? `, ${WORDS.guideHere}` : ''}`}
            >
              {go.kind === 'fair' ? (
                <span className="kr-choice__words">
                  <span aria-hidden="true">{n === 1 ? '🐟🐟' : n === 0 ? '🐟🐟🐟' : '🐟'}</span> {fairLabel(n)}
                </span>
              ) : (
                <Pebble metal="grey" value={n} />
              )}
              {n === pointAt && <span className="kr-hand" aria-hidden="true">👆</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A tappable fish, with its count when counted. */
function FishSpot({ id, counted, onTap, className = '', style }: { id: string; counted: string[]; onTap: () => void; className?: string; style?: CSSProperties }) {
  const n = counted.indexOf(id);
  return (
    <span className={`kr-fish${n >= 0 ? ' kr-fish--counted' : ''} ${className}`} style={style} onClick={onTap} aria-hidden="true">
      <Fish />
      {n >= 0 && <span className="kr-fish__count">{n + 1}</span>}
    </span>
  );
}

/** A double: the fish on the rock, the still water, and their reflection upside down (clear, faint or gone). */
function Mirror({ go, help, phase, counted, guide, onFish }: {
  go: Go; help: Help; phase: Phase; counted: string[]; guide: 0 | 1 | 2 | null; onFish: (id: string) => void;
}) {
  const rows = rowsOf(go.n);
  // The reflection is the rock's rows in the opposite order, so the bottom row sits nearest the water's edge.
  const reflection = help !== 'none' || phase !== 'ask' ? help === 'none' ? 'full' : help : null;
  let idx = 0;
  const rock = rows.map((count, r) => {
    const start = idx;
    idx += count;
    return { r, count, start };
  });
  return (
    <div className="kr-mirror">
      <div className={`kr-rock${guide === 0 ? ' kr-guide' : ''}`}>
        <div className="kr-rows">
          {rock.map(({ r, count, start }) => (
            <div key={r} className="kr-row">
              {Array.from({ length: count }, (_, i) => (
                <FishSpot key={i} id={`r${start + i}`} counted={counted} onTap={() => onFish(`r${start + i}`)} className={help === 'full' ? 'kr-fish--linked' : ''} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className={`kr-water${reflection ? ` kr-water--${reflection}` : ''}${guide === 1 ? ' kr-guide' : ''}`}>
        {reflection && (
          <div className="kr-rows">
            {[...rock].reverse().map(({ r, count, start }) => (
              <div key={r} className="kr-row kr-row--mirror">
                {Array.from({ length: count }, (_, i) => (
                  <FishSpot key={i} id={`w${start + i}`} counted={counted} onTap={() => onFish(`w${start + i}`)} className="kr-fish--mirror" />
                ))}
              </div>
            ))}
            {go.kind === 'near' && (
              <div className="kr-row kr-row--mirror">
                <FishSpot id={`w${go.n}`} counted={counted} onTap={() => onFish(`w${go.n}`)} className="kr-fish--mirror kr-fish--extra" />
              </div>
            )}
          </div>
        )}
        {!reflection && <span className="kr-water__ripple" aria-hidden="true" />}
      </div>
    </div>
  );
}

/** A half, or fair or not: the pile of fish, and the two chicks each with the fish they have been given. */
function Share({ go, help, phase, counted, shared, onFish }: {
  go: Go; help: Help; phase: Phase; counted: string[]; shared: number[]; onFish: (id: string, pile?: number) => void;
}) {
  const pileShown = help !== 'none' || phase !== 'ask' || shared.length > 0;
  const left = shared.filter((_, i) => i % 2 === 0);
  const right = shared.filter((_, i) => i % 2 === 1);
  const still = Array.from({ length: go.n }, (_, i) => i).filter((i) => !shared.includes(i));
  const nest = (items: number[], happy: boolean, side: string) => (
    <div className={`kr-nest kr-nest--${side}`}>
      <span className="kr-chick"><Chick happy={happy} /></span>
      <div className="kr-nest__fish kr-rows">
        {rowsOf(items.length).map((count, r) => (
          <div key={r} className="kr-row kr-row--small">
            {items.slice(r * 5, r * 5 + count).map((i) => (
              <FishSpot key={i} id={`p${i}`} counted={counted} onTap={() => onFish(`p${i}`)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
  const done = phase !== 'ask' && still.length <= 1;
  return (
    <div className="kr-share">
      {nest(left, done, 'left')}
      <div className="kr-pile">
        {pileShown ? (
          <div className="kr-rows">
            {rowsOf(still.length).map((count, r) => (
              <div key={r} className="kr-row">
                {still.slice(r * 5, r * 5 + count).map((i) => (
                  <FishSpot key={i} id={`p${i}`} counted={counted} onTap={() => onFish(`p${i}`, i)} className={done ? 'kr-fish--left-over' : ''} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <span className="kr-basket" aria-hidden="true">
            <span className="kr-basket__num">{go.n}</span>
          </span>
        )}
        {pileShown && help !== 'full' && phase === 'ask' && shared.length === 0 && <p className="kr-tip">{WORDS.tapToShare}</p>}
      </div>
      {nest(right, done, 'right')}
    </div>
  );
}
