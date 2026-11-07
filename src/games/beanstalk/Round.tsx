/**
 * Today's challenge: tap two floating leaves that make the beanstalk's sum (10, 100 or 1000). A right pair flies up to the stalk and the stalk grows towards
 * the friend. Ten pairs reach the top.
 *
 * Mistakes that teach (maths review R5). A go runs until a right pair. The first wrong pair of a go wobbles, and the two
 * leaves' dots join in one frame with the extra dots out or the empty squares glowing, and the line says why ("4 and 8
 * make 12. That is too many."). A tried pair can't be tapped together again. The second wrong pair stops the free taps:
 * "Let's look together". The first leaf of that pair pulses and its frame fills with its partner's dots, counted, then
 * "Now you try: what goes with 7?" with the 7 still picked and the partner not marked. The pair then made counts for the
 * round, but only a go's first tap is scored (round.ts), so it is a shown pair, not a clean right.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dots, Friend, Metal } from '../../../shared/beanstalk/progress';
import { makeRound, ON_SCREEN, PAIRS_PER_ROUND, pairId, replay, type Target, type Tap } from '../../../shared/beanstalk/round';
import { NEW_GO, stepGo } from '../../../shared/kit/mistakes';
import { LookTogether, NowYouTry, ShowWhy, useLookTogether } from '../../kit/ShowWhy';
import { playSound } from '../sounds';
import type { Child } from './backend';
import { JoinedFrame, Leaf, type LeafLook } from './Leaf';
import { Scene } from './Scene';
import { WORDS } from './words';

const FLY_MS = 650;

/**
 * The tray's leaves (and gaps) in a new order. Leaves come in pair by pair, so without this a new pair would land side by
 * side in the gaps the last pair left: far too easy (James, 4 Nov 2026). Only where they sit changes; which leaf is which
 * (and so what the server replays) stays the same.
 */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const WOBBLE_MS = 500;

interface Props {
  seed: number;
  dots: Dots;
  /** The magic leaves' colours now, bottom first: the stalk shows them as it grows. */
  stalkLeaves: Metal[];
  /** The floating leaves' colour: the colour every magic leaf has reached (green, bronze or silver). */
  trayMetal: Metal;
  friend: Friend;
  /** What a pair adds up to on this beanstalk. */
  target: Target;
  child: Child;
  /** The child's very first challenge, or the first on a new 100 or 1000 beanstalk: a hand shows them a right pair, until they have made one. */
  guide: boolean;
  /**
   * The first challenge on a new 100 or 1000 beanstalk: a line linking it to the bonds to 10 ("7 tens and 3 tens make 10
   * tens"), shown and read before the usual line (maths review R4).
   */
  bridge?: boolean;
  sound: boolean;
  say: (text: string, onEnd?: () => void) => void;
  onDone: (taps: Tap[]) => void;
}

export function Round({ seed, dots, stalkLeaves, trayMetal, friend, target, child, guide, bridge = false, sound, say, onDone }: Props) {
  const round = useMemo(() => makeRound(seed, target), [seed, target]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [slots, setSlots] = useState<(number | null)[]>(() => shuffled(replay(round, []).onScreen.slice(0, ON_SCREEN)));
  const [flying, setFlying] = useState<number[]>([]);
  const [wobble, setWobble] = useState<number[]>([]);
  /** The last wrong pair, shown joined with its why-line until the next pair is tapped. */
  const [why, setWhy] = useState<{ a: number; b: number } | null>(null);
  const { look, start: startLook, skip: skipLook } = useLookTogether(say);
  /** The go's place in the two-tap flow (shared/kit/mistakes.ts): the second wrong pair is "Let's look together". */
  const go = useRef(NEW_GO);
  /** After "Let's look together": the leaf the child now finds the partner of. It stays picked. */
  const [redo, setRedo] = useState<number | null>(null);
  const since = useRef(Date.now());
  /** Set by the first tap, so the end of the opening line no longer restarts the clock. */
  const tappedYet = useRef(false);
  const timers = useRef<number[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const { pairsMade, tried } = replay(round, taps);
  // The bridge uses the numbers of the pair the hand first points at (the first leaf in the tray with a partner).
  const [bridgeLine] = useState(() => {
    if (!bridge || target === 10) return null;
    const first = slots.find((i) => i !== null && slots.some((j) => j !== null && j !== i && round.leaves[i] + round.leaves[j] === target));
    return first == null ? null : WORDS.bridge(target, round.leaves[first], target - round.leaves[first]);
  });

  useEffect(() => {
    heading.current?.focus();
    // The first pair's clock starts now (a tap during the voice is still timed) and again once the opening line has been heard.
    let live = true;
    tappedYet.current = false;
    since.current = Date.now();
    const opening = guide ? WORDS.guideStart(target) : WORDS.tapTwo(target);
    const heard = () => {
      if (live && !tappedYet.current) since.current = Date.now();
    };
    // A tap during the bridge cuts it off, and a line cut off never calls back, so the opening line isn't said over it.
    if (bridgeLine)
      say(bridgeLine, () => {
        if (live) say(opening, heard);
      });
    else say(opening, heard);
    const pending = timers.current;
    return () => {
      live = false;
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, [seed]); // only when the round starts

  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));

  /** The second wrong pair of a go: show the first leaf's partner filling its frame, then ask the child to find it. */
  function lookTogether(anchor: number) {
    const n = round.leaves[anchor];
    setWhy(null);
    setPicked(null);
    startLook({
      anchor,
      steps: (target - n) / (target / 10),
      openingLine: WORDS.lookTogether,
      fillLine: WORDS.fillUp(n, target),
      onEnd: () => {
        go.current = stepGo(go.current, 'lookDone');
        setRedo(anchor);
        setPicked(anchor);
        since.current = Date.now();
        say(WORDS.nowTry(n));
      },
    });
  }

  function tap(leaf: number) {
    if (flying.length || look) return;
    tappedYet.current = true;
    // "Now you try": the leaf from "Let's look together" stays picked, so a tap on it does nothing.
    if (redo !== null && leaf === redo) return;
    if (picked !== null && picked !== leaf && tried.includes(pairId(picked, leaf))) return; // a pair tried already
    if (picked === null || picked === leaf) {
      setPicked(picked === leaf ? null : leaf);
      if (sound) playSound('tap');
      if (guide && pairsMade === 0 && picked === null) say(WORDS.guideNext);
      return;
    }
    const now = Date.now();
    const next = [...taps, { a: picked, b: leaf, ms: now - since.current }];
    since.current = now;
    setTaps(next);
    setPicked(redo);
    const [x, y] = [round.leaves[picked], round.leaves[leaf]];
    if (x + y !== target) {
      const first = picked;
      setWobble([picked, leaf]);
      later(WOBBLE_MS, () => setWobble([]));
      // The second wrong pair of a go (not counting those after "Let's look together"): look together at the first leaf.
      go.current = stepGo(go.current, 'wrong');
      if (go.current.phase === 'look') {
        lookTogether(first);
        return;
      }
      setWhy({ a: picked, b: leaf });
      say(WORDS.why(x, y, target));
      return;
    }
    go.current = stepGo(go.current, 'right');
    setWhy(null);
    setRedo(null);
    setPicked(null);
    const pair = [picked, leaf];
    setFlying(pair);
    say(WORDS.right(x, y));
    if (sound) playSound('hop');
    later(FLY_MS, () => {
      const after = replay(round, next);
      const newcomers = after.onScreen.filter((i) => !slots.includes(i));
      // Newcomers take the pair's places and any gaps (a pair can wait while its numbers are floating: round.ts).
      setSlots(shuffled(slots.map((s) => (s === null || pair.includes(s) ? (newcomers.shift() ?? null) : s))));
      setFlying([]);
      if (after.done) onDone(next);
    });
  }

  // The hand follows the child: it points at a leaf with a partner, and once one is picked, at that leaf's partner. Every
  // leaf floating has a partner (round.ts), so it always has somewhere to point. Gone after the first right pair.
  const onScreen = slots.filter((s): s is number => s !== null && !flying.includes(s));
  const partner = (leaf: number) => onScreen.find((j) => j !== leaf && round.leaves[j] + round.leaves[leaf] === target);
  const pointAt = !guide || pairsMade > 0 || flying.length || look || redo !== null ? null : picked !== null ? (partner(picked) ?? null) : (onScreen.find((i) => partner(i) !== undefined) ?? null);

  const lookOf = (leaf: number): LeafLook =>
    flying.includes(leaf)
      ? 'flying'
      : picked !== null && picked !== leaf && tried.includes(pairId(picked, leaf))
        ? 'tried'
        : wobble.includes(leaf)
          ? 'wobble'
          : picked === leaf
            ? 'picked'
            : 'resting';
  const step = target / 10;

  return (
    <div className="bs-play">
      <h2 className="bs-sr" tabIndex={-1} ref={heading}>{WORDS.tapTwo(target)}</h2>
      <Scene
        grow={0.08 + (0.92 * pairsMade) / PAIRS_PER_ROUND}
        leaves={stalkLeaves.slice(0, pairsMade).map((metal) => ({ metal }))}
        friend={friend}
        friendPose={pairsMade >= PAIRS_PER_ROUND ? 'cheer' : 'wait'}
        child={child}
        childPose={pairsMade >= PAIRS_PER_ROUND ? 'cheer' : 'point'}
      />
      <div className="bs-progress" aria-label={`${pairsMade} of ${PAIRS_PER_ROUND} pairs`}>
        {Array.from({ length: PAIRS_PER_ROUND }, (_, i) => (
          <span key={i} className={i < pairsMade ? 'bs-pip bs-pip--done' : 'bs-pip'} />
        ))}
      </div>
      <div className="bs-target">
        <p className="bs-target__badge" aria-hidden="true">
          {WORDS.makeTarget(target)}
        </p>
        <button
          type="button"
          className="bs-hear"
          disabled={look !== null}
          onClick={() => say(redo !== null ? WORDS.nowTry(round.leaves[redo]) : why ? WORDS.why(round.leaves[why.a], round.leaves[why.b], target) : WORDS.tapTwo(target))}
        >
          <span aria-hidden="true">🔊</span> {WORDS.hearAgain}
        </button>
        {bridgeLine && <p className="bs-bridge">{bridgeLine}</p>}
        {why && (
          <ShowWhy
            prefix="bs"
            tapKey={`${why.a}-${why.b}-${taps.length}`}
            // Smaller number first, as the line says it.
            picture={<JoinedFrame a={Math.min(round.leaves[why.a], round.leaves[why.b])} b={Math.max(round.leaves[why.a], round.leaves[why.b])} step={step} />}
            line={WORDS.why(round.leaves[why.a], round.leaves[why.b], target)}
          />
        )}
        {look && (
          <LookTogether
            prefix="bs"
            title={WORDS.lookTogether}
            picture={<JoinedFrame a={round.leaves[look.anchor]} b={target - round.leaves[look.anchor]} step={step} more={look.filled} />}
            line={WORDS.fillUp(round.leaves[look.anchor], target)}
            skipLabel={WORDS.goOn}
            canSkip={look.canSkip}
            onSkip={skipLook}
          />
        )}
        {redo !== null && !why && <NowYouTry prefix="bs" line={WORDS.nowTry(round.leaves[redo])} />}
      </div>
      <div className="bs-tray">
        {slots.map((leaf, slot) =>
          leaf === null ? (
            <span key={`empty${slot}`} className="bs-leaf bs-leaf--gone" />
          ) : (
            <Leaf
              key={leaf}
              value={round.leaves[leaf]}
              step={target / 10}
              dots={dots}
              metal={trayMetal}
              look={lookOf(leaf)}
              slot={slot}
              pointed={leaf === pointAt}
              pulse={look?.anchor === leaf || redo === leaf}
              onTap={() => tap(leaf)}
            />
          ),
        )}
      </div>
    </div>
  );
}
