/**
 * Today's challenge at Penguin Pairs: ten goes by Kororā's mirror pool (docs/KORORA-PLAN.md).
 *
 *  - A double: fish land on the rock and the still pool shows the same fish upside down. How many fish now?
 *  - A half: a pile of fish to share fairly between the two chicks. How many does each chick get?
 *  - Fair or not (gold days): can the two chicks share this many fish fairly, or is one left over?
 *
 * The support James chose (4 Nov 2026), all in this screen:
 *  - help that fades with the pebbles: bronze days show a clear reflection with each fish joined to its mirror fish and
 *    share halves out one by one; silver days a faint, rippled reflection and the pile only; gold days the words only;
 *  - hints that build up after wrong taps on a go: a wobble, then the pictures come back and Bella counts the fish, then
 *    the hand points to the right number;
 *  - fish sit in rows of five, like a ten-frame;
 *  - tap a fish to count it (doubles), or to give it to a chick (halves and fair or not);
 *  - a double comes just before its half, with the same fish (the rules put them together);
 *  - after three goes in a row with a wrong first tap, the full pictures come back for the rest of the round;
 *  - "Hear it again" reads the question again.
 * None of this changes what counts: the taps are replayed by the server, which records the first pick of each fact.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Tap } from '../../../shared/korora/play';
import type { Friend as FriendName, Help } from '../../../shared/korora/progress';
import { followsItsDouble, GOES_PER_ROUND, showRound, type Go, type Round } from '../../../shared/korora/round';
import { playSound } from '../sounds';
import { Chick, Fish, Friend, Pebble } from './KororaArt';
import { backFor, type Scenery } from './Pool';
import { goLine } from './voiceLines';
import { WORDS } from './words';

const RIGHT_MS = 1600;
const WOBBLE_MS = 500;
const SHARE_MS = 320;
const COUNT_MS = 650;
/** After this many goes in a row with a wrong first tap, the full pictures come back for the rest of the round. */
const STRUGGLE_GOES = 3;

const MORE: Record<Help, Help> = { none: 'faint', faint: 'full', full: 'full' };

interface Props {
  round: Round;
  /** The help for today, from the pebbles and the teacher's setting. */
  help: Help;
  scenery: Scenery;
  friend: FriendName;
  /** The child's very first challenge: a hand shows them the way on the first go. */
  guide?: boolean;
  sound: boolean;
  say: (text: string) => void;
  onDone: (taps: Tap[]) => void;
}

type Phase = 'ask' | 'right' | 'done';

/** Fish in rows of five, like a ten-frame: [5, 5, 2] for 12. */
const rowsOf = (n: number) => Array.from({ length: Math.ceil(n / 5) }, (_, r) => Math.min(5, n - r * 5));

export function Goes({ round, help, scenery, friend, guide = false, sound, say, onDone }: Props) {
  const goes = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [wobble, setWobble] = useState<number | null>(null);
  /** Wrong taps on this go: 1 wobble, 2 pictures and counting, 3 the hand. */
  const [wrongs, setWrongs] = useState(0);
  /** Goes in a row with a wrong first tap, and whether the full pictures have come back for the round. */
  const [streak, setStreak] = useState(0);
  const [boost, setBoost] = useState(false);
  /** Fish tapped (or counted with Bella), in order: their count shows on them. */
  const [counted, setCounted] = useState<string[]>([]);
  /** Fish given to each chick, by their place in the pile. */
  const [shared, setShared] = useState<number[]>([]);
  /** The guided first go's hand: on the rock's fish, then the water's, then the right number. */
  const [guideStep, setGuideStep] = useState<0 | 1 | 2>(0);
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
  const line = goLine(go, guided, followsItsDouble(round.goes, at));
  const shown: Help = boost ? 'full' : wrongs >= 2 ? (help === 'none' ? 'full' : MORE[help]) : help;

  // Each new go is read aloud once; bronze-day halves share themselves out while the child watches.
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    since.current = Date.now();
    say(line);
    setGuideStep(0);
    if (guided) {
      later(1800, () => setGuideStep(1));
      later(3600, () => setGuideStep(2));
    }
    if (go.kind === 'half' && help === 'full') shareAll(go.n, 1200);
    // Read again only when the go changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, goes]);

  /** Shares the rest of the pile out, one each in turn. */
  function shareAll(n: number, wait = 0) {
    for (let i = 0; i < n; i++) {
      later(wait + i * SHARE_MS, () => setShared((s) => (s.includes(i) || s.length >= n ? s : [...s, i])));
    }
  }

  /** Bella counts the fish with the child, lighting each one. */
  function countTogether() {
    const fishIds = go.kind === 'double'
      ? [...Array.from({ length: go.n }, (_, i) => `r${i}`), ...Array.from({ length: go.n }, (_, i) => `w${i}`)]
      : Array.from({ length: go.n }, (_, i) => `p${i}`);
    setCounted([]);
    say(WORDS.countWithMe);
    // Halves count one chick's share; doubles count every fish, the rock's then the water's.
    const ids = go.kind === 'half' ? fishIds.filter((_, i) => i % 2 === 0) : fishIds;
    if (go.kind !== 'double') shareAll(go.n);
    ids.forEach((id, i) =>
      later(1600 + i * COUNT_MS, () => {
        setCounted((c) => [...c, id]);
        say(WORDS.yes(i + 1));
      }),
    );
  }

  function pick(n: number) {
    if (phase !== 'ask') return;
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
        if (s >= STRUGGLE_GOES) setBoost(true);
      }
      setWobble(n);
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => setWobble(null));
      if (w === 2 && go.kind !== 'fair') countTogether();
      else say(WORDS.tryAgain);
      return;
    }
    if (first) setStreak(0);
    clearTimers();
    setPhase('right');
    setGuideStep(2);
    say(go.kind === 'fair' ? (go.answer === 1 ? WORDS.fairYes : WORDS.notFairYes) : WORDS.yes(n));
    if (sound) playSound('badge');
    // Show it is fair: the rest of the pile goes to the chicks.
    if (go.kind !== 'double') shareAll(go.n);
    const wait = go.kind === 'double' ? RIGHT_MS : Math.max(RIGHT_MS, go.n * SHARE_MS + 600);
    later(wait, () => {
      if (at + 1 >= goes.length) {
        setPhase('done');
        later(600, () => onDone(next));
      } else {
        setAt(at + 1);
        setPhase('ask');
        setWrongs(0);
        setCounted([]);
        setShared([]);
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

  const pointAt = phase === 'ask' && ((guided && guideStep === 2) || wrongs >= 3) ? go.answer : null;
  const made = at + (phase === 'ask' ? 0 : 1);
  const pose = phase === 'right' || phase === 'done' ? (go.kind === 'double' ? 'gulp' : 'cheer') : 'wait';
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
        <button type="button" className="kr-button" onClick={() => say(line)}>
          <span aria-hidden="true">👂</span> {WORDS.hearAgain}
        </button>
      </div>
      <p className="kr-ask" aria-live="polite">{go.kind === 'fair' ? `${go.n} fish: fair or not?` : go.parts.join(' ')}</p>
      <div className="kr-scene" key={at}>
        <span className={`kr-scene__friend${go.kind === 'double' ? '' : ' kr-scene__friend--low'}`}>
          <Friend friend={friend} pose={pose} />
        </span>
        {go.kind === 'double' ? (
          <Mirror go={go} help={shown} phase={phase} counted={counted} guide={guided && phase === 'ask' ? guideStep : null} onFish={tapFish} />
        ) : (
          <Share go={go} help={shown} phase={phase} counted={counted} shared={shared} onFish={tapFish} />
        )}
      </div>
      <div className={`kr-choices${go.kind === 'fair' ? ' kr-choices--fair' : ''}`} role="group" aria-label={WORDS.pickNumber}>
        {go.choices.map((n) => (
          <button
            key={`${at}-${n}`}
            type="button"
            className={`kr-choice${wobble === n ? ' kr-choice--wobble' : ''}${phase !== 'ask' && n === go.answer ? ' kr-choice--right' : ''}${n === pointAt ? ' kr-choice--pointed' : ''}`}
            onClick={() => pick(n)}
            aria-label={`${go.kind === 'fair' ? (n === 1 ? WORDS.fair : WORDS.notFair) : n}${n === pointAt ? `, ${WORDS.guideHere}` : ''}`}
          >
            {go.kind === 'fair' ? (
              <span className="kr-choice__words">
                <span aria-hidden="true">{n === 1 ? '🐟🐟' : '🐟🐟🐟'}</span> {n === 1 ? WORDS.fair : WORDS.notFair}
              </span>
            ) : (
              <Pebble metal="grey" value={n} />
            )}
            {n === pointAt && <span className="kr-hand" aria-hidden="true">👆</span>}
          </button>
        ))}
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
        {rock.map(({ r, count, start }) => (
          <div key={r} className="kr-row">
            {Array.from({ length: count }, (_, i) => (
              <FishSpot key={i} id={`r${start + i}`} counted={counted} onTap={() => onFish(`r${start + i}`)} className={help === 'full' ? 'kr-fish--linked' : ''} />
            ))}
          </div>
        ))}
      </div>
      <div className={`kr-water${reflection ? ` kr-water--${reflection}` : ''}${guide === 1 ? ' kr-guide' : ''}`}>
        {reflection &&
          [...rock].reverse().map(({ r, count, start }) => (
            <div key={r} className="kr-row kr-row--mirror">
              {Array.from({ length: count }, (_, i) => (
                <FishSpot key={i} id={`w${start + i}`} counted={counted} onTap={() => onFish(`w${start + i}`)} className="kr-fish--mirror" />
              ))}
            </div>
          ))}
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
      <div className="kr-nest__fish">
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
          rowsOf(still.length).map((count, r) => (
            <div key={r} className="kr-row">
              {still.slice(r * 5, r * 5 + count).map((i) => (
                <FishSpot key={i} id={`p${i}`} counted={counted} onTap={() => onFish(`p${i}`, i)} className={done ? 'kr-fish--left-over' : ''} />
              ))}
            </div>
          ))
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
