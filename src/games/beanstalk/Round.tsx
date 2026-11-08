/**
 * Today's challenge: tap two floating leaves that make the beanstalk's sum (10, 100 or 1000). A right pair flies up to the stalk and the stalk grows towards
 * the friend. Ten pairs reach the top.
 *
 * Mistakes that teach (maths review R5). A go runs until a right pair. The first wrong pair of a go wobbles, and the two
 * leaves' dots join in one frame with the extra dots out or the empty squares glowing, and the line says why ("4 and 8
 * make 12. That is too many."). A tried pair can't be tapped together again (except on a missing-leaf go, where the child is free to try it again: S22). The second wrong pair stops the free taps:
 * "Let's look together". The first leaf of that pair pulses and its frame fills with its partner's dots, counted, then
 * "Now you try: what goes with 7?" with the 7 still picked and the partner not marked. The pair then made counts for the
 * round, but only a go's first tap is scored (round.ts), so it is a shown pair, not a clean right.
 */
import { useEffect, useRef, useState } from 'react';
import type { Dots, Friend, Metal } from '../../../shared/beanstalk/progress';
import { isMissingGo, ON_SCREEN, PAIRS_PER_ROUND, pairId, replay, targetOf, unitOf, wrongFirstRun, type Round as StageRound, type Tap } from '../../../shared/beanstalk/round';
import { STRUGGLE_GOES } from '../../../shared/kit/help';
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
  /**
   * The round the server made for this child (shared/beanstalk/round.ts): ten pairs, most of them the child's own sum,
   * with a couple of older pairs last, as a short second tray with its own sum (S21). The tray shows one sum at a time.
   */
  round: StageRound;
  /** The dots this child sees to start: their own help, or none when the teacher has turned the dots off. */
  dots: Dots;
  /** False when the teacher has turned the dots off: then three wrong first taps in a row don't bring them back. */
  canBoost?: boolean;
  /** The magic leaves' colours now, bottom first: the stalk shows them as it grows. */
  stalkLeaves: Metal[];
  /** The floating leaves' colour: the colour every magic leaf has reached (green, bronze or silver). */
  trayMetal: Metal;
  friend: Friend;
  child: Child;
  /** The child's very first challenge, or the first on a new 100 or 1000 beanstalk: a hand shows them a right pair, until they have made one. */
  guide: boolean;
  /**
   * The first challenge on a new 100 or 1000 beanstalk: a line linking it to the bonds to 10 ("7 tens and 3 tens make 10
   * tens"), shown and read before the usual line (maths review R4).
   */
  bridge?: boolean;
  /** The child's very first challenge: the first missing-leaf go (the 3rd) comes with a tip and the hand pointing at the missing leaf (S22). */
  firstEver?: boolean;
  sound: boolean;
  say: (text: string, onEnd?: () => void) => void;
  onDone: (taps: Tap[]) => void;
}

export function Round({ round, dots, canBoost = true, stalkLeaves, trayMetal, friend, child, guide, bridge = false, firstEver = false, sound, say, onDone }: Props) {
  const [taps, setTaps] = useState<Tap[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [slots, setSlots] = useState<(number | null)[]>(() => shuffled(replay(round, []).onScreen.slice(0, ON_SCREEN)));
  const [flying, setFlying] = useState<number[]>([]);
  // What the leaves in the tray add up to now: the sum of the pair they belong to. It changes when the short second tray of older pairs comes in.
  const trayLeaf = slots.find((s): s is number => s !== null);
  const target = trayLeaf === undefined ? round.target : targetOf(round, trayLeaf);
  /** Three goes in a row began with a wrong tap: full dots for the rest of this round (not saved; the child's own help is). */
  const [boosted, setBoosted] = useState(false);
  const [wobble, setWobble] = useState<number[]>([]);
  /** The last wrong pair, shown joined with its why-line until the next pair is tapped. */
  const [why, setWhy] = useState<{ a: number; b: number } | null>(null);
  const { look, start: startLook, skip: skipLook } = useLookTogether(say);
  /** The go's place in the two-tap flow (shared/kit/mistakes.ts): the second wrong pair is "Let's look together". */
  const go = useRef(NEW_GO);
  /** The missing leaf (R8): the leaf already picked on a "7 + ? = 10" go. It is also `redo`, so it stays picked and a tap on it does nothing. */
  const [missing, setMissing] = useState<number | null>(null);
  /** "So 10 take 7 is 3.": shown after a right missing-leaf go, until the next tap. */
  const [take, setTake] = useState<string | null>(null);
  /** The first missing-leaf go ever: its tip, and the hand at the missing leaf, until the child taps (once only). */
  const [tip, setTip] = useState<string | null>(null);
  const tipDone = useRef(false);
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
    if (first == null) return null;
    return target === 20 ? WORDS.bridge20(round.leaves[first], target - round.leaves[first]) : WORDS.bridge(target, round.leaves[first], target - round.leaves[first]);
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
  }, [round.seed]); // only when the round starts

  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));

  /** The second wrong pair of a go: show the first leaf's partner filling its frame, then ask the child to find it. */
  function lookTogether(anchor: number) {
    const n = round.leaves[anchor];
    setWhy(null);
    setPicked(null);
    startLook({
      anchor,
      steps: (target - n) / unitOf(target),
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

  /** Says the lines one after another (a tap cuts the rest off, as it does any line). */
  function sayAll(lines: (string | null)[]) {
    const [first, ...rest] = lines.filter((l): l is string => l !== null);
    if (first === undefined) return;
    say(first, rest.length ? () => sayAll(rest) : undefined);
  }

  function tap(leaf: number) {
    if (flying.length || look) return;
    tappedYet.current = true;
    setTake(null);
    setTip(null);
    // "Now you try": the leaf from "Let's look together" stays picked, so a tap on it does nothing.
    if (redo !== null && leaf === redo) return;
    // A pair tried already can't be tapped again, except on a missing-leaf go: the child is free to think it over (S22).
    if (missing === null && picked !== null && picked !== leaf && tried.includes(pairId(picked, leaf))) return;
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
    // The next go may be a missing-leaf go: its leaf is picked as the pair flies up (every leaf floating has a partner: round.ts).
    const after = replay(round, next);
    const nextGo = after.done || !isMissingGo(after.pairsMade) ? null : (() => {
      const options = after.onScreen.filter((i) => after.onScreen.some((j) => j !== i && round.leaves[i] + round.leaves[j] === targetOf(round, i)));
      return options.length ? options[Math.floor(Math.random() * options.length)] : null;
    })();
    // The line: the pair, then (after a missing-leaf go) the take-away, the dots coming back, and what the next go asks.
    const wasMissing = missing !== null ? WORDS.takeAway(round.leaves[missing], target) : null;
    setMissing(null);
    if (wasMissing) setTake(wasMissing);
    // Each go is scored at its first tap: three in a row wrong bring the full dots back, and the line says so once.
    const struggling = canBoost && !boosted && dots !== 'full' && wrongFirstRun(after.answers) >= STRUGGLE_GOES;
    if (struggling) setBoosted(true);
    // The short second tray of older pairs came in: say what these make now (the badge changes as they arrive).
    const trayNext = after.done || !after.onScreen.length ? target : targetOf(round, after.onScreen[0]);
    const firstTip = firstEver && !tipDone.current && nextGo !== null ? WORDS.missingTip(trayNext) : null;
    if (firstTip) {
      tipDone.current = true;
      setTip(firstTip);
    }
    sayAll([
      WORDS.right(x, y), wasMissing, struggling ? WORDS.dotsBack : null, trayNext !== target ? WORDS.nowThese(trayNext) : null,
      firstTip, nextGo !== null ? WORDS.missingAsk(round.leaves[nextGo], trayNext) : null,
    ]);
    if (sound) playSound('hop');
    later(FLY_MS, () => {
      const newcomers = after.onScreen.filter((i) => !slots.includes(i));
      // Newcomers take the pair's places and any gaps (a pair can wait while its numbers are floating: round.ts).
      setSlots(shuffled(slots.map((s) => (s === null || pair.includes(s) ? (newcomers.shift() ?? null) : s))));
      setFlying([]);
      if (nextGo !== null) {
        setMissing(nextGo);
        setPicked(nextGo);
        setRedo(nextGo);
        since.current = Date.now();
      }
      if (after.done) onDone(next);
    });
  }

  // The hand follows the child: it points at a leaf with a partner, and once one is picked, at that leaf's partner. Every
  // leaf floating has a partner (round.ts), so it always has somewhere to point. Gone after the first right pair.
  const onScreen = slots.filter((s): s is number => s !== null && !flying.includes(s));
  const partner = (leaf: number) => onScreen.find((j) => j !== leaf && round.leaves[j] + round.leaves[leaf] === target);
  const pointAt = tip !== null && missing !== null && !flying.length && !look ? (partner(missing) ?? null) : !guide || pairsMade > 0 || flying.length || look || redo !== null ? null : picked !== null ? (partner(picked) ?? null) : (onScreen.find((i) => partner(i) !== undefined) ?? null);

  const lookOf = (leaf: number): LeafLook =>
    flying.includes(leaf)
      ? 'flying'
      : missing === null && picked !== null && picked !== leaf && tried.includes(pairId(picked, leaf))
        ? 'tried'
        : wobble.includes(leaf)
          ? 'wobble'
          : picked === leaf
            ? 'picked'
            : 'resting';
  const step = unitOf(target);
  const cells = target === 20 ? 20 : 10;
  const missingLine = missing !== null ? WORDS.missingAsk(round.leaves[missing], targetOf(round, missing)) : null;

  return (
    <div className="bs-play">
      <h2 className="bs-sr" tabIndex={-1} ref={heading}>{missingLine ?? WORDS.tapTwo(target)}</h2>
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
          {missing !== null ? WORDS.missingSum(round.leaves[missing], target) : WORDS.makeTarget(target)}
        </p>
        <button
          type="button"
          className="bs-hear"
          disabled={look !== null}
          onClick={() => say(missingLine ?? (redo !== null ? WORDS.nowTry(round.leaves[redo]) : why ? WORDS.why(round.leaves[why.a], round.leaves[why.b], target) : WORDS.tapTwo(target)))}
        >
          <span aria-hidden="true">🔊</span> {WORDS.hearAgain}
        </button>
        {bridgeLine && <p className="bs-bridge">{bridgeLine}</p>}
        {tip && !why && <p className="bs-take">{tip}</p>}
        {take && !why && <p className="bs-take">{take}</p>}
        {why && (
          <ShowWhy
            prefix="bs"
            tapKey={`${why.a}-${why.b}-${taps.length}`}
            // Smaller number first, as the line says it.
            picture={<JoinedFrame cells={cells} a={Math.min(round.leaves[why.a], round.leaves[why.b])} b={Math.max(round.leaves[why.a], round.leaves[why.b])} step={step} />}
            line={WORDS.why(round.leaves[why.a], round.leaves[why.b], target)}
          />
        )}
        {look && (
          <LookTogether
            prefix="bs"
            title={WORDS.lookTogether}
            picture={<JoinedFrame cells={cells} a={round.leaves[look.anchor]} b={target - round.leaves[look.anchor]} step={step} more={look.filled} />}
            line={WORDS.fillUp(round.leaves[look.anchor], target)}
            skipLabel={WORDS.goOn}
            canSkip={look.canSkip}
            onSkip={skipLook}
          />
        )}
        {redo !== null && missing === null && !why && <NowYouTry prefix="bs" line={WORDS.nowTry(round.leaves[redo])} />}
      </div>
      <div className="bs-tray">
        {slots.map((leaf, slot) =>
          leaf === null ? (
            <span key={`empty${slot}`} className="bs-leaf bs-leaf--gone" />
          ) : (
            <Leaf
              key={leaf}
              value={round.leaves[leaf]}
              step={step}
              cells={cells}
              dots={boosted ? 'full' : dots}
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
