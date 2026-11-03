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
const WOBBLE_MS = 500;

interface Props {
  seed: number;
  dots: Dots;
  friend: Friend;
  child: Child;
  sound: boolean;
  say: (text: string) => void;
  onDone: (taps: Tap[]) => void;
}

export function Round({ seed, dots, friend, child, sound, say, onDone }: Props) {
  const round = useMemo(() => makeRound(seed), [seed]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [slots, setSlots] = useState<(number | null)[]>(() => replay(round, []).onScreen.slice(0, ON_SCREEN));
  const [flying, setFlying] = useState<number[]>([]);
  const [wobble, setWobble] = useState<number[]>([]);
  const since = useRef(Date.now());
  const timers = useRef<number[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const { pairsMade } = replay(round, taps);

  useEffect(() => {
    heading.current?.focus();
    say(WORDS.tapTwo);
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, [seed]); // only when the round starts

  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));

  function tap(leaf: number) {
    if (flying.length) return;
    if (picked === null || picked === leaf) {
      setPicked(picked === leaf ? null : leaf);
      if (sound) playSound('tap');
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
      setSlots(slots.map((s) => (s !== null && pair.includes(s) ? (newcomers.shift() ?? null) : s)));
      setFlying([]);
      if (after.done) onDone(next);
    });
  }

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
            <Leaf key={leaf} value={round.leaves[leaf]} dots={dots} look={look(leaf)} slot={slot} onTap={() => tap(leaf)} />
          ),
        )}
      </div>
    </div>
  );
}
