/**
 * Today's challenge: ten hops. Each hop is a row of lily pads counting in equal steps, with Hop sitting on the pad
 * before the glowing gap. The child taps the glow-worm with the missing number and Hop jumps onto the pad; a wrong
 * glow-worm wobbles and drifts back, with no penalty. The step ("+2") shows on each hop's arc on bronze days, faintly on
 * silver days, and not at all on gold days. The last hop or hops count back: one from the first day a step is secure going forward, up to three, and three on gold days as Hop hops home.
 *
 * Mistakes that teach (maths review R5, shared/kit/mistakes.ts). The first wrong glow-worm of a hop greys out (and can't be
 * tapped again) and a small row of pads shows the mistake behind it, with its line read aloud. The second stops the free
 * taps: "Let's look together", Hop hops the row from its first pad saying each number while the 100 board lights them,
 * then the same hop comes back as "Now you try" with all four glow-worms in a new order and the labels at the child's own
 * level. Only the first glow-worm of a hop is scored (shared/hop/play.ts), so a hop found after looking is not a clean right.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { replay, wrongFirstRun, type Tap } from '../../../shared/hop/play';
import type { Friend as FriendName, Help, Metal } from '../../../shared/hop/progress';
import { HOPS_PER_ROUND, kindOfKey, showRound, type HopMistake, type Round } from '../../../shared/hop/round';
import { STRUGGLE_GOES } from '../../../shared/kit/help';
import { NEW_GO, stepGo } from '../../../shared/kit/mistakes';
import { DemoBar } from '../../kit/DemoBar';
import { HearAgain } from '../../kit/HearAgain';
import { useKindDemo } from '../../kit/useKindDemo';
import { useSeenKinds } from '../../kit/useSeenKinds';
import { LookTogether, NowYouTry, ShowWhy, useLookTogether } from '../../kit/ShowWhy';
import { playSound } from '../sounds';
import { DEMO_STEPS, DemoScene, isDemoKind } from './demo';
import { Friend, GlowWorm, LilyPad } from './HopArt';
import { HundredsBoard } from './HundredsBoard';
import { backFor, type Scenery } from './Pond';
import { WhyPicture } from './WhyPicture';
import { WORDS } from './words';
import { hopLine } from './voiceLines';

const JUMP_MS = 650;
const LAND_MS = 750;
const WOBBLE_MS = 500;

/** The 100 board only opens by itself where it sits beside the pond (CSS: 900px and wider); on a phone it would cover the pads. */
const wideBoard = () => typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 900px)').matches;

/** The glow-worms in a new order, for "Now you try" (only where they sit changes, not which is which). */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface Props {
  round: Round;
  /** The label for a hop saved with no help of its own (a round open before R6): the calendar's. */
  help: Help;
  /** False when the teacher has turned the labels off: no labels at all, and three wrong first taps don't bring them back. */
  labels?: boolean;
  /** The colour the row's pads have reached: green on bronze days, bronze on silver days, silver on gold days. */
  padMetal: Metal;
  scenery: Scenery;
  friend: FriendName;
  /** The child's very first challenge: a hand shows them the right glow-worm on the first hop. */
  guide?: boolean;
  /** The kinds of hop this child has seen, and how to remember more. */
  seenKinds: readonly string[];
  markSeen: (kinds: string[]) => Promise<unknown>;
  sound: boolean;
  say: (text: string, onEnd?: () => void) => void;
  onDone: (taps: Tap[]) => void;
}

type Phase = 'ask' | 'jump' | 'done';

export function Hops({ round, help, labels = true, padMetal, scenery, friend, guide = false, seenKinds, markSeen, sound, say, onDone }: Props) {
  const hops = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [wobble, setWobble] = useState<number | null>(null);
  /** Three hops in a row began with a wrong glow-worm: full labels for the rest of this round (not saved; the child's own help is). */
  const [boosted, setBoosted] = useState(false);
  /** The wrong glow-worms tapped on this hop: greyed out, and not tappable again until "Now you try". */
  const [tried, setTried] = useState<number[]>([]);
  /** The last wrong glow-worm, shown with its picture and line until the next tap. */
  const [why, setWhy] = useState<{ n: number; kind: HopMistake } | null>(null);
  /** The hop's place in the two-tap flow: the second wrong glow-worm is "Let's look together". */
  const go = useRef(NEW_GO);
  const [redo, setRedo] = useState(false);
  /** How many times "Now you try" has come round on this hop: each reshuffles the glow-worms. */
  const [redoCount, setRedoCount] = useState(0);
  const { look, start: startLook, skip: skipLook } = useLookTogether(say);
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
  // Show me first: the first time a hop counts back or starts from a number, one made-up hop is shown before the real one.
  // At most two demos a round. The demo is not an answer: nothing is added to the taps while it plays.
  const kinds = useSeenKinds(seenKinds, markSeen);
  const [demoKinds, setDemoKinds] = useState<string[]>([]);
  const thisKind = kindOfKey(round.hops[Math.min(at, round.hops.length - 1)]?.key ?? '');
  const demoFor =
    isDemoKind(thisKind) && !kinds.has(thisKind) && phase === 'ask' && !(guide && at === 0) && (demoKinds.includes(thisKind) || demoKinds.length < 2) ? thisKind : null;
  useEffect(() => {
    if (demoFor && !demoKinds.includes(demoFor)) setDemoKinds((d) => [...d, demoFor]);
  }, [demoFor, demoKinds]);
  const demo = useKindDemo({ kind: demoFor, seen: kinds, mark: kinds.mark, steps: demoFor ? DEMO_STEPS[demoFor] : [], say });
  const demoActive = demoFor !== null;
  // Each new hop is read aloud once (the shared pack's words: "Counting in tens: 20, 30, something, 50. What is missing?").
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    // The clock starts now (a tap during the voice is still timed) and again once the question has been heard.
    let live = true;
    tappedYet.current = false;
    since.current = Date.now();
    if (demoActive) return;
    say(hopLine(hops[at].spoken, guide && at === 0), () => {
      if (live && !tappedYet.current) since.current = Date.now();
    });
    return () => {
      live = false;
    };
    // Read again only when the hop changes, not when the guide ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, hops, say, demoActive]);

  const hop = hops[Math.min(at, hops.length - 1)];
  const pads = hop.parts.map((p) => p.replace(/,$/, '')).map((p) => (p === '?' ? null : Number(p)));
  const gap = pads.indexOf(null);
  const back = round.hops[at]?.key.includes(':back:');
  const sign = back ? '−' : '+';
  const helpAt = (i: number): Help => (labels ? round.hops[i]?.h ?? help : 'none');
  const shown: Help = boosted ? 'full' : helpAt(at);

  const worms = useMemo(() => (redoCount > 0 ? shuffled(hops[Math.min(at, hops.length - 1)].choices) : hops[Math.min(at, hops.length - 1)].choices), [hops, at, redoCount]);

  /** "Hear it again": the why-line if one is showing, otherwise the question (not the look-together step, and no first-go intro). */
  function hearAgain() {
    if (look) return;
    const line = why ? WORDS.why(why.kind, hop) : hopLine(hop.spoken, false);
    say(line, () => {
      if (!tappedYet.current) since.current = Date.now();
    });
  }

  /** The second wrong glow-worm of a hop: Hop hops the row from its first pad to the answer, saying each number. */
  function lookTogether() {
    const counted = hop.terms.slice(0, hop.gap + 1);
    setWhy(null);
    startLook({
      anchor: hop.gap,
      steps: counted.length,
      openingLine: WORDS.lookTogether,
      fillLine: WORDS.lookCount(hop, counted),
      onEnd: () => {
        go.current = stepGo(go.current, 'lookDone');
        setTried([]);
        setRedo(true);
        setRedoCount((c) => c + 1);
        since.current = Date.now();
        say(WORDS.nowTry);
      },
    });
  }

  function pick(n: number) {
    if (phase !== 'ask' || look || demoActive || tried.includes(n)) return;
    tappedYet.current = true;
    const now = Date.now();
    const next = [...taps, { pick: n, ms: now - since.current }];
    since.current = now;
    setTaps(next);
    if (n !== hop.answer) {
      setWobble(n);
      setTried([...tried, n]);
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => setWobble(null));
      go.current = stepGo(go.current, 'wrong');
      // Each hop is scored at its first glow-worm: three in a row wrong bring the labels back, and the line says so once.
      const struggling =
        labels && !boosted && wrongFirstRun(replay(round, next).answers) >= STRUGGLE_GOES && round.hops.some((_, i) => i >= at && helpAt(i) !== 'full');
      if (struggling) setBoosted(true);
      if (go.current.phase === 'look') {
        lookTogether();
        return;
      }
      const kind = hop.wrongs.find((w) => w.n === n)!.kind;
      setWhy({ n, kind });
      const line = WORDS.why(kind, hop);
      if (struggling) say(line, () => say(WORDS.labelsBack));
      else say(line);
      return;
    }
    go.current = stepGo(go.current, 'right');
    if (thisKind) kinds.mark([thisKind]);
    setWhy(null);
    setRedo(false);
    setPhase('jump');
    say(WORDS.yes(n));
    if (sound) playSound('hop');
    later(JUMP_MS + LAND_MS, () => {
      if (at + 1 >= hops.length) {
        setPhase('done');
        later(LAND_MS, () => onDone(next));
      } else {
        setAt(at + 1);
        setTried([]);
        setRedoCount(0);
        setPhase('ask');
      }
    });
  }

  // The guided first go: the hand points at the right glow-worm on the first hop, until it is picked.
  const pointAt = guide && at === 0 && phase === 'ask' && !look ? hop.answer : null;
  // In "Let's look together" Hop sits on the pad being counted, from the first pad to the answer.
  const counted = look ? Math.max(look.filled, 0) : null;
  const sitting = counted !== null ? Math.max(counted - 1, 0) : phase === 'ask' ? gap - 1 : gap;
  const made = at + (phase === 'ask' ? 0 : 1);

  return (
    <div className={`hp-play hp-pond--${scenery}`} style={backFor(scenery)}>
      <div className="hp-stars" aria-hidden="true" />
      <h2 className="hp-sr" tabIndex={-1} ref={heading}>{WORDS.pickWorm}</h2>
      <div className="hp-top">
        <div className="hp-progress" aria-label={WORDS.hopsMade(made, HOPS_PER_ROUND)}>
          {Array.from({ length: HOPS_PER_ROUND }, (_, i) => (
            <span key={i} className={i < made ? 'hp-pip hp-pip--done' : 'hp-pip'} />
          ))}
        </div>
        <HearAgain prefix="hp" label={WORDS.hearAgain} onHear={hearAgain} />
        <HundredsBoard high={hop.of === 200} counting={look && wideBoard() ? hop.terms.slice(0, look.filled) : null} />
      </div>
      <p className="hp-ask" aria-live="polite">{hop.prompt}</p>
      <div className="hp-stage">
      {why && (
        <ShowWhy
          prefix="hp"
          tapKey={taps.length}
          picture={<WhyPicture hop={hop} kind={why.kind} wrong={why.n} friend={friend} />}
          line={WORDS.why(why.kind, hop)}
        />
      )}
      {look && (
        <LookTogether
          prefix="hp"
          title={WORDS.lookTogether}
          picture={<p className="hp-counted">{hop.terms.slice(0, look.filled).join(', ') || '\u00a0'}</p>}
          line={WORDS.lookCount(hop, hop.terms.slice(0, hop.gap + 1))}
          skipLabel={WORDS.goOn}
          canSkip={look.canSkip}
          onSkip={skipLook}
        />
      )}
      {redo && !why && !look && <NowYouTry prefix="hp" line={WORDS.nowTry} />}
      {demoFor && (
        <>
          <DemoScene kind={demoFor} step={demo.step} padMetal={padMetal} friend={friend} />
          <DemoBar prefix="hp" skipLabel={WORDS.skipDemo} canSkip={demo.canSkip} onSkip={demo.skip} />
        </>
      )}
      <div hidden={demoActive} className="hp-row" key={at} style={{ ['--hp-n' as string]: pads.length }}>
        {pads.slice(0, -1).map((_, i) => (
          <span key={`arc${i}`} className={`hp-arc hp-arc--${shown}${i === gap - 1 ? ' hp-arc--next' : ''}`} style={{ ['--hp-i' as string]: i }}>
            {shown !== 'none' && <span className="hp-arc__label">{sign}{hop.size}</span>}
          </span>
        ))}
        {pads.map((n, i) => (
          <span key={i} className="hp-row__spot" style={{ ['--hp-i' as string]: i }}>
            <LilyPad
              metal={padMetal}
              value={i === gap ? (phase === 'ask' && !(counted !== null && counted > gap) ? null : hop.answer) : n}
              gap={i === gap && phase === 'ask' && !(counted !== null && counted > gap)}
              glow={(i === gap && phase !== 'ask') || (counted !== null && i < counted)}
            />
          </span>
        ))}
        <span className={`hp-row__frog${phase === 'jump' ? ' hp-row__frog--jump' : ''}`} style={{ ['--hp-i' as string]: sitting }}>
          <Friend friend={friend} pose={phase === 'done' ? 'cheer' : phase === 'jump' ? 'leap' : 'wait'} />
        </span>
      </div>
      </div>
      <div hidden={demoActive} className={`hp-worms${look ? ' hp-worms--off' : ''}`} role="group" aria-label={WORDS.pickWorm}>
        {worms.map((n, i) => (
          <button
            key={`${at}-${n}`}
            type="button"
            disabled={tried.includes(n) || look !== null || demoActive}
            className={`hp-worm${wobble === n ? ' hp-worm--wobble' : ''}${tried.includes(n) ? ' hp-worm--tried' : ''}${phase !== 'ask' && n === hop.answer ? ' hp-worm--gone' : ''}${n === pointAt ? ' hp-worm--pointed' : ''}`}
            style={{ ['--hp-i' as string]: i }}
            onClick={() => pick(n)}
            aria-label={n === pointAt ? `${n}, ${WORDS.guideHere}` : String(n)}
          >
            <GlowWorm value={n} />
            {n === pointAt && <span className="hp-hand" aria-hidden="true">👆</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
