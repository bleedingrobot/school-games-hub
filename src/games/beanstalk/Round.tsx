/**
 * Today's challenge: tap two floating leaves that make 10. A right pair flies up to the stalk and the stalk grows towards
 * the friend; a wrong pair wobbles and stays (no penalty, nothing shown: the dots are the help). Ten pairs reach the top.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dots, Friend } from '../../../shared/beanstalk/progress';
import { makeRound, ON_SCREEN, PAIRS_PER_ROUND, replay, TARGET, type Tap } from '../../../shared/beanstalk/round';
import { playSound } from '../sounds';
import type { Child } from './backend';
import { Leaf, type LeafLook } from './Leaf';
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
  friend: Friend;
  child: Child;
  /** The child's very first challenge: a hand shows them a right pair, until they have made one. */
  guide: boolean;
  sound: boolean;
  say: (text: string) => void;
  onDone: (taps: Tap[]) => void;
}

export function Round({ seed, dots, friend, child, guide, sound, say, onDone }: Props) {
  const round = useMemo(() => makeRound(seed), [seed]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [slots, setSlots] = useState<(number | null)[]>(() => shuffled(replay(round, []).onScreen.slice(0, ON_SCREEN)));
  const [flying, setFlying] = useState<number[]>([]);
  const [wobble, setWobble] = useState<number[]>([]);
  const since = useRef(Date.now());
  const timers = useRef<number[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const { pairsMade } = replay(round, taps);

  useEffect(() => {
    heading.current?.focus();
    say(guide ? WORDS.guideStart : WORDS.tapTwo);
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, [seed]); // only when the round starts

  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));

  function tap(leaf: number) {
    if (flying.length) return;
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
    setPicked(null);
    const [x, y] = [round.leaves[picked], round.leaves[leaf]];
    if (x + y !== TARGET) {
      setWobble([picked, leaf]);
      say(WORDS.tryAgain);
      later(WOBBLE_MS, () => setWobble([]));
      return;
    }
    const pair = [picked, leaf];
    setFlying(pair);
    say(WORDS.right(x, y));
    if (sound) playSound('hop');
    later(FLY_MS, () => {
      const after = replay(round, next);
      const newcomers = after.onScreen.filter((i) => !slots.includes(i));
      setSlots(shuffled(slots.map((s) => (s !== null && pair.includes(s) ? (newcomers.shift() ?? null) : s))));
      setFlying([]);
      if (after.done) onDone(next);
    });
  }

  // The hand follows the child: it points at a leaf with a partner, and once one is picked, at that leaf's partner. Every
  // leaf floating has a partner (round.ts), so it always has somewhere to point. Gone after the first right pair.
  const onScreen = slots.filter((s): s is number => s !== null && !flying.includes(s));
  const partner = (leaf: number) => onScreen.find((j) => j !== leaf && round.leaves[j] + round.leaves[leaf] === TARGET);
  const pointAt = !guide || pairsMade > 0 || flying.length ? null : picked !== null ? (partner(picked) ?? null) : (onScreen.find((i) => partner(i) !== undefined) ?? null);

  const look = (leaf: number): LeafLook =>
    flying.includes(leaf) ? 'flying' : wobble.includes(leaf) ? 'wobble' : picked === leaf ? 'picked' : 'resting';

  return (
    <div className="bs-play">
      <h2 className="bs-sr" tabIndex={-1} ref={heading}>{WORDS.tapTwo}</h2>
      <Scene
        grow={0.08 + (0.92 * pairsMade) / PAIRS_PER_ROUND}
        leaves={Array.from({ length: pairsMade }, () => ({ metal: 'green' as const }))}
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
      <div className="bs-tray">
        {slots.map((leaf, slot) =>
          leaf === null ? (
            <span key={`empty${slot}`} className="bs-leaf bs-leaf--gone" />
          ) : (
            <Leaf
              key={leaf}
              value={round.leaves[leaf]}
              dots={dots}
              look={look(leaf)}
              slot={slot}
              pointed={leaf === pointAt}
              onTap={() => tap(leaf)}
            />
          ),
        )}
      </div>
    </div>
  );
}
