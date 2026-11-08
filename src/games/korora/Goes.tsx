/**
 * Today's challenge at Penguin Pairs: ten goes with Two-Shoes at the mirror pool (docs/KORORA-PLAN.md).
 *
 *  - A double: fish land on the rock and the still pool shows the same fish upside down. How many fish now?
 *  - A near double (level 5, 6 + 7): the rock's fish and the water's, with one extra fish in the water. How many fish?
 *  - A half: a pile of fish to share fairly between the two chicks. How many does each chick get?
 *  - Fair or not (gold days, R9, FairPile.tsx): a real pile of 6 to 20 fish; the child shares it into two bowls, two fish at a time,
 *    then picks Fair or One left over. Hint after the second wrong pick: the fish pair off. Bella counts one bowl.
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
import { DemoBar } from '../../kit/DemoBar';
import { PointingHand } from '../../kit/PointingHand';
import { LookTogether, NowYouTry, ShowWhy, useLookTogether } from '../../kit/ShowWhy';
import { useKindDemo } from '../../kit/useKindDemo';
import { useSeenKinds } from '../../kit/useSeenKinds';
import { playSound } from '../sounds';
import { FairPile, COUNT_MS } from './FairPile';
import { DEMOS, DEMO_KINDS, type DemoKind } from './demo';
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
  /** The kinds of go this child has seen, and how to remember more (each kind's demo plays once). */
  seen: readonly string[];
  onSeen: (kinds: string[]) => Promise<unknown>;
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

/** The two choices of fair or not: 1 fair, 0 one left over. */
const fairLabel = (n: number) => (n === 1 ? WORDS.fair : WORDS.tooMany);

/** A tiny picture of a choice: two bowls with the same fish, or two bowls and one fish on its own. */
function FairIcon({ fair }: { fair: boolean }) {
  return (
    <span className="kr-fairicon" aria-hidden="true">
      <span className="kr-fairicon__bowl">🐟🐟</span>
      <span className="kr-fairicon__bowl">🐟🐟</span>
      {!fair && <span className="kr-fairicon__alone">🐟</span>}
    </span>
  );
}

/** Fish in rows of five, like a ten-frame: [5, 5, 2] for 12. */
const rowsOf = (n: number) => Array.from({ length: Math.ceil(n / 5) }, (_, r) => Math.min(5, n - r * 5));

export function Goes({ round, help, setting = 'fade', scenery, friend, guide = false, seen, onSeen, sound, say, onDone }: Props) {
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
  const kinds = useSeenKinds(seen, onSeen);
  /** A kind not yet seen gets its demo before the first go of it (never in a redo: it is marked seen when it ends). */
  const demoKind = DEMO_KINDS.includes(go.kind) && !kinds.has(go.kind) && phase === 'ask' ? (go.kind as DemoKind) : null;
  const demo = useKindDemo({ kind: demoKind, seen: kinds, mark: kinds.mark, steps: demoKind ? DEMOS[demoKind].steps : [], say });
  const demoWas = useRef(false);
  const guided = guide && at === 0;
  const line = goLine(go, guided, followsItsDouble(round.goes, at));
  // "Let's look together" shows the full picture; "Now you try" goes back to the child's own help level, not more.
  const helpAt = (i: number): Help => helpWithSetting(round.goes[i]?.h ?? help, setting, { always: 'full', off: 'none' });
  const ownHelp = helpAt(at);
  const shown: Help = (boost && setting !== 'off') || flow.phase === 'look' ? 'full' : ownHelp;
  const mirror = go.kind === 'double' || go.kind === 'near';
  // S26: at full help the child still deals the fish, two at a time (a fish for each nest); the choices wait until all are dealt.
  // Decided when the go begins, so help that comes back part-way through a go does not lock choices already open.
  const mustDeal = useMemo(
    () => go.kind === 'half' && (ownHelp === 'full' || (boost && setting !== 'off')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [at, goes],
  );
  const lookLine = go.kind === 'near' ? WORDS.lookNear(go.n) : go.kind === 'double' ? WORDS.lookDouble(go.n) : WORDS.lookHalf(go.n);
  const lookIds = mirror ? fishIdsOf(go) : fishIdsOf(go).filter((_, i) => i % 2 === 0);

  /** Reads the question, and starts the answer clock once it has been heard. */
  function readGo(alive: () => boolean) {
    say(line, () => {
      if (alive() && !tappedYet.current) since.current = Date.now();
      // Near doubles at a help level that shows the water: the picture said in a line, never the answer.
      if (alive() && go.kind === 'near' && shown !== 'none') say(WORDS.nearMirror(go.n));
    });
  }

  // Each new go is read aloud once; the child deals the fish of a half themselves at every help level.
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    // The clock starts now (a tap during the voice is still timed) and again once the question has been heard.
    let live = true;
    tappedYet.current = false;
    since.current = Date.now();
    // A kind not yet seen is shown first; its question is read when the demo is over.
    if (!(DEMO_KINDS.includes(go.kind) && !kinds.has(go.kind))) readGo(() => live);
    setGuideStep(0);
    if (guided) {
      later(1800, () => setGuideStep(1));
      later(3600, () => setGuideStep(2));
    }
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
    tappedYet.current = false;
    since.current = Date.now();
    readGo(() => true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.playing]);

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
        // The pile goes back to the pile: the child deals it again.
        setShared([]);
        since.current = Date.now();
        say(WORDS.nowTry, () => say(line));
      },
    });
  }

  function pick(n: number) {
    if (phase !== 'ask' || look || demo.playing || flow.phase === 'look' || greyed.includes(n)) return;
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
        // Fair or not: look at one bowl, and after the second wrong choice the fish pair off (R9).
        const line = w === 2 ? WORDS.pairOff : WORDS.countOneBowl;
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
    // A go of a kind finished: that kind is known (a safety net; its demo marks it too).
    if (DEMO_KINDS.includes(go.kind) && !kinds.has(go.kind)) kinds.mark([go.kind]);
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
      if (phase !== 'ask' || look) return;
      // Full help: one tap deals a pair, a fish for each nest, the next two in the pile.
      if (mustDeal) {
        const rest = Array.from({ length: go.n }, (_, i) => i).filter((i) => !shared.includes(i));
        if (rest.length >= 2) setShared([...shared, rest[0], rest[1]]);
      } else setShared((s) => (s.includes(pileIndex) ? s : [...s, pileIndex]));
      if (sound) playSound('tap');
      return;
    }
    setCounted((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  const dealing = mustDeal && shared.length < go.n;
  const locked = (go.kind === 'fair' && phase === 'ask' && !sorted) || (dealing && phase === 'ask');
  // The answer clock starts again when the last fish is dealt, so dealing time is not thinking time.
  useEffect(() => {
    if (mustDeal && !look && phase === 'ask' && shared.length >= go.n) {
      tappedYet.current = true;
      since.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared.length]);
  const hand = go.kind === 'fair' ? wrongs >= 3 && sorted : flow.phase === 'redo' && flow.wrong >= LOOK_AT + 2;
  const lookCounted = look ? lookIds.slice(0, look.filled) : counted;
  const pointAt = phase === 'ask' && !look && ((guided && guideStep === 2) || hand) ? go.answer : null;
  const made = at + (phase === 'ask' ? 0 : 1);
  const pose = phase === 'right' || phase === 'done' ? (mirror ? 'gulp' : 'cheer') : 'wait';
  const style = { ...backFor(scenery) } as CSSProperties;

  if (demo.playing && demoKind) {
    return (
      <div className={`kr-play kr-pool--${scenery}`} style={style}>
        <h2 className="kr-sr" tabIndex={-1} ref={heading}>{WORDS.demoTitle}</h2>
        <div className="kr-top">
          <div className="kr-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
            {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
              <span key={i} className={i < made ? 'kr-pip kr-pip--done' : 'kr-pip'} />
            ))}
          </div>
        </div>
        <DemoScene kind={demoKind} step={demo.step} friend={friend} />
        <DemoBar prefix="kr" skipLabel={WORDS.skip} canSkip={demo.canSkip} onSkip={demo.skip} />
      </div>
    );
  }

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
      <p className="kr-ask" aria-live="polite">{go.kind === 'fair' ? `${go.n} fish. Is it fair?` : go.parts.join(' ')}</p>
      <div className="kr-scene" key={at}>
        <span className={`kr-scene__friend${mirror ? '' : ' kr-scene__friend--low'}`}>
          <Friend friend={friend} pose={pose} />
        </span>
        {mirror ? (
          <Mirror go={go} help={shown} phase={phase} counted={lookCounted} guide={guided && phase === 'ask' ? guideStep : null} onFish={tapFish} />
        ) : go.kind === 'fair' ? (
          <FairPile go={go} help={shown} phase={phase} hint={pairHint} sound={sound} onSorted={setSorted} />
        ) : (
          <Share go={go} help={shown} phase={phase} counted={lookCounted} shared={shared} deal={mustDeal && !look && flow.phase !== 'look'} onFish={tapFish} />
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
                  <FairIcon fair={n === 1} /> {fairLabel(n)}
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

/** The made-up go of a "Show me first" demo: the same pictures and stones as a real go, with nothing to tap. */
function DemoScene({ kind, step, friend }: { kind: DemoKind; step: number; friend: FriendName }) {
  const { go, steps } = DEMOS[kind];
  const target = steps[step]?.target;
  const mirror = kind === 'near';
  const ids = fishIdsOf(go);
  // Near doubles: the double is counted first (the rock's fish and the water's four), then the one more fish.
  // Halves: the pile is dealt out in turn, then one chick's share is counted.
  const counted = kind === 'near' ? (step === 1 ? ids.slice(0, 2 * go.n) : step >= 2 ? ids : []) : kind === 'half' && step >= 2 ? ids.filter((_, i) => i % 2 === 0) : [];
  const [dealt, setDealt] = useState(0);
  useEffect(() => {
    if (kind !== 'half' || step < 1) return;
    const t = window.setInterval(() => setDealt((d) => Math.min(go.n, d + 1)), 140);
    return () => window.clearInterval(t);
  }, [kind, step, go.n]);
  const shared = Array.from({ length: kind === 'half' ? (step >= 2 ? go.n : dealt) : 0 }, (_, i) => i);
  const noop = () => undefined;
  return (
    <>
      <p className="kr-ask">{kind === 'fair' ? `${go.n} fish. Is it fair?` : go.parts.join(' ')}</p>
      <div className="kr-scene kr-demoscene" aria-hidden="true">
        <span className={`kr-scene__friend${mirror ? '' : ' kr-scene__friend--low'}`}>
          <Friend friend={friend} pose={step >= 2 ? 'cheer' : 'wait'} />
        </span>
        {mirror ? (
          <Mirror go={go} help="full" phase="ask" counted={counted} guide={null} onFish={noop} />
        ) : kind === 'fair' ? (
          <FairPile go={go} help="full" phase="ask" hint={step >= 1} sound={false} onSorted={noop} />
        ) : (
          <Share go={go} help="full" phase="ask" counted={counted} shared={shared} deal={false} onFish={noop} />
        )}
      </div>
      <div className="kr-answer">
        <div className={`kr-choices${kind === 'fair' ? ' kr-choices--fair' : ''}`} role="group" aria-label={WORDS.pickNumber}>
          {go.choices.map((n) => {
            const pointed = target === 'card' && n === go.answer;
            return (
              <button key={n} type="button" disabled className={`kr-choice${pointed ? ' kr-choice--pointed' : ''}`} aria-label={`${kind === 'fair' ? fairLabel(n) : n}`}>
                {kind === 'fair' ? (
                  <span className="kr-choice__words">
                    <FairIcon fair={n === 1} /> {fairLabel(n)}
                  </span>
                ) : (
                  <Pebble metal="grey" value={n} />
                )}
                {pointed && <PointingHand prefix="kr" />}
              </button>
            );
          })}
        </div>
      </div>
    </>
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
      {go.kind === 'near' && reflection && <span className="kr-sr">{WORDS.nearMirror(go.n)}</span>}
      <div className="kr-rockline">
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
      {/* Near doubles: the one more fish sits on its own, out of the water, and is not part of the reflection. */}
      {go.kind === 'near' && reflection && (
        <div className="kr-more">
          <FishSpot id={`w${go.n}`} counted={counted} onTap={() => onFish(`w${go.n}`)} className="kr-fish--extra" />
          <span className="kr-more__label" aria-hidden="true">+ 1</span>
        </div>
      )}
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
          </div>
        )}
        {!reflection && <span className="kr-water__ripple" aria-hidden="true" />}
      </div>
    </div>
  );
}

/** A half, or fair or not: the pile of fish, and the two chicks each with the fish they have been given. */
function Share({ go, help, phase, counted, shared, deal, onFish }: {
  go: Go; help: Help; phase: Phase; counted: string[]; shared: number[]; deal: boolean; onFish: (id: string, pile?: number) => void;
}) {
  const pileShown = help !== 'none' || phase !== 'ask' || shared.length > 0;
  const left = shared.filter((_, i) => i % 2 === 0);
  const right = shared.filter((_, i) => i % 2 === 1);
  const still = Array.from({ length: go.n }, (_, i) => i).filter((i) => !shared.includes(i));
  // The next pair goes to the left nest then the right: the nest due the next fish pulses while the child is dealing.
  const dealing = deal && phase === 'ask' && still.length > 0;
  const nest = (items: number[], happy: boolean, side: string) => (
    <div className={`kr-nest kr-nest--${side}${dealing ? ' kr-nest--next' : ''}`}>
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
        {pileShown && phase === 'ask' && shared.length === 0 && (deal || help !== 'full') && <p className="kr-tip">{deal ? WORDS.tapToDeal : WORDS.tapToShare}</p>}
      </div>
      {nest(right, done, 'right')}
    </div>
  );
}
