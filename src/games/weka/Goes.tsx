/**
 * Today's challenge at Weka's Stepping Stones: ten goes across the stream (docs/WEKA-PLAN.md).
 *
 *  - Adding: "8 + 5". Weka is on stone 8 and hops 5 more. Where does Weka land? (8 and 2 make 10, then 3 more: 13.)
 *  - Smaller first (silver and gold days): "5 + 8". Start on the bigger number.
 *  - Hopping back (gold days): "13 − 5". Weka is on 13 and hops back 5 (3 back to the big rock, then 2 more: 8).
 *
 * The support, all in this screen (plan section 4):
 *  - each go's help comes with it from the server, from the child's record of that fact: 'full' (every stone numbered,
 *    the hops split into two colours, and two steps: first "how many hops to the big rock?", then "where will Weka
 *    land?"), 'faint' (every fifth stone numbered and the big rock, one tap) or 'none' (the sum only); the teacher can
 *    keep it always on or off;
 *  - stones come in fives, light and dark, with the big rock at 10, so the structure of ten shows on the number line;
 *  - hints build after wrong taps: a wobble, then the picture comes back and Bella says the make-ten sentence ("8 and 2
 *    make 10. Then 3 more.") or counts the hops to the big rock with the child, then the hand points;
 *  - after three goes in a row with a wrong first tap, full help comes back for the rest of the round;
 *  - "Hear it again" reads the question again;
 *  - 'split' goes (later in the game, James 6 Nov 2026): before answering, the child splits the number they add in a
 *    part-whole bond, first the part that gets to ten, then the rest, with Bella's prompts, counting help and the hand;
 *  - after a right answer on a full or split go (adding, not hopping back), the same question again with pebbles in
 *    two ten-frames: drag silver pebbles across to fill the first ten (Pebbles.tsx, James 6 Nov 2026);
 *  - after every right answer (unless the child split first) the child fills in the split they used as a part-whole
 *    bond (the smaller number on top, the hops to the big rock and the hops after it below), and Bella says it in full
 *    (James, 5 Nov 2026).
 *  - mistakes that teach (maths review R5): a wrong tap with a mistake behind it greys that number out and shows why (Weka on
 *    the rock, the split, the pebbles, the hops counted) with Bella's line; the second wrong tap is "Let's look together"
 *    (Weka hops the whole make-ten sentence while the pebbles fill the first ten-frame), then a sister question
 *    ("Now you try one like it": the neighbour fact on the same start number, asked the same way at the same help, local
 *    only and never sent; a right tap sends the first go's right pick instead, a wrong one shows why once and brings the
 *    first go back with its answer pointed at). Each question (hops to ten, where Weka lands) has its own two taps.
 * None of this changes what counts: only the final picks are sent, and the server replays them and records the first
 * pick of each fact. The first step is help only and is never sent.
 */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { helpWithSetting, STRUGGLE_GOES } from '../../../shared/kit/help';
import { NEW_GO, stepGo } from '../../../shared/kit/mistakes';
import { LookTogether, NowYouTry, ShowWhy, useLookTogether } from '../../kit/ShowWhy';
import { HearAgain } from '../../kit/HearAgain';
import { PointingHand, pointedLabel } from '../../kit/PointingHand';
import { DemoBar } from '../../kit/DemoBar';
import { useGuidedFirstGo } from '../../kit/useGuidedFirstGo';
import { useKindDemo } from '../../kit/useKindDemo';
import { useSeenKinds } from '../../kit/useSeenKinds';
import type { Tap } from '../../../shared/weka/play';
import type { Friend as FriendName } from '../../../shared/weka/progress';
import { askLine, BOND_MORE, bondAskLine, bondLine, fromTenLine, GOES_PER_ROUND, pebblesFor, showRound, sisterGo, skipPracticeFor, splitDoneLine, splitFirstLine, splitRestLine, stemLine, toTenChoicesFor, toTenLine, wrongKind, type Go, type Help, type Round } from '../../../shared/weka/round';
import type { HelpSetting } from '../../../shared/weka/server';
import { playSound } from '../sounds';
import { paint, type Pose } from './art';
import { backFor, type Scenery } from './Stream';
import { Frame, Pebbles } from './Pebbles';
import { Friend, Hop, StepStone, Stone } from './WekaArt';
import { DemoScene } from './DemoScene';
import { DEMOS, DEMO_KINDS, type DemoKind } from './demo';
import { rightLine, splitWhyLine, whyLine } from './voiceLines';
import { WORDS } from './words';

const RIGHT_MS = 1800;
const WOBBLE_MS = 500;
const HOP_MS = 260;
const COUNT_MS = 700;
const GUIDE_MS = 2600;
/**
 * The stones shown: 1 to 20. Every go starts, lands and passes within 5 to 20, so a wide screen shows 5 to 20 in one
 * line; a narrow one shows two rows of ten (1 to 10 ending at the big rock, then 11 to 20), like a twenty-frame.
 */
const STONES = Array.from({ length: 20 }, (_, i) => i + 1);

/** The teacher's setting on top of the go's own help. */
export const helpFor = (go: Help, setting: HelpSetting): Help => helpWithSetting(go, setting, { always: 'full', off: 'none' });

interface Props {
  round: Round;
  /** The class's help setting. */
  setting: HelpSetting;
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

type Phase = 'ask' | 'right' | 'pebbles' | 'bond' | 'done';
/** Full goes: hops to ten, then the answer. Split goes: split the number (two parts), then the answer. */
type Step = 'toTen' | 'split' | 'answer';

/** The stones between two numbers, not counting the first: 8 → 10 is [9, 10]; 13 → 10 is [12, 11, 10]. */
const between = (from: number, to: number) => {
  const out: number[] = [];
  for (let n = from; n !== to; ) {
    n += to > from ? 1 : -1;
    out.push(n);
  }
  return out;
};

export function Goes({ round, setting, scenery, friend, guide = false, seen, onSeen, sound, say, onDone }: Props) {
  const goes = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [step, setStep] = useState<Step>('answer');
  const [wobble, setWobble] = useState<number | null>(null);
  /** Wrong taps on this step: 1 wobble, 2 the picture and Bella's sentence, 3 the hand. */
  const [wrongs, setWrongs] = useState(0);
  const [firstWrong, setFirstWrong] = useState(false);
  /** Mistakes that teach: the wrong numbers greyed out, the mistake being shown, and the question's place in the two-tap flow. */
  const [gone, setGone] = useState<number[]>([]);
  const [why, setWhy] = useState<{ kind: string; tap: number; go?: Go } | null>(null);
  const [redo, setRedo] = useState(false);
  /** The sister go of "Now you try one like it": local only, never sent or saved, and nothing on it is marked. */
  const [sister, setSister] = useState<Go | null>(null);
  const flow = useRef(NEW_GO);
  const { look, start: startLook, skip: skipLook } = useLookTogether(say);
  /** Weka has hopped to the big rock (the first step, or a split) on this go. */
  const [rockDone, setRockDone] = useState(false);
  /** Stones lit as the hops after the big rock. */
  const [restLit, setRestLit] = useState<number[]>([]);
  /** Goes in a row with a wrong first tap, and whether full help has come back for the round. */
  const [streak, setStreak] = useState(0);
  const [boost, setBoost] = useState(false);
  /** Where Weka stands, and the stones lit by counting together. */
  const [pos, setPos] = useState(0);
  const [lit, setLit] = useState<number[]>([]);
  const [pose, setPose] = useState<Pose>('wait');
  /** The split after a right answer: how many parts are filled in (0, 1, 2), and wrong taps on the current part. */
  const [bond, setBond] = useState(0);
  const [bondWrongs, setBondWrongs] = useState(0);
  /** What Bella last said about a wrong number in the split ("Hear it again" says it), and the wrong numbers greyed out. */
  const [splitSaid, setSplitSaid] = useState('');
  const [splitGone, setSplitGone] = useState<number[]>([]);
  const since = useRef(Date.now());
  /** Goes up with each clock start (and when a go ends), so the end of an older line can't restart a newer clock. */
  const asking = useRef(0);
  /** Set by the first tap after a clock start, so the end of its read-aloud no longer restarts the clock. */
  const tappedYet = useRef(false);
  /** Starts the answer clock now (a tap during the voice is still timed) and again once `line` has been heard. */
  function askAloud(line: string) {
    const mine = ++asking.current;
    tappedYet.current = false;
    since.current = Date.now();
    say(line, () => {
      if (asking.current === mine && !tappedYet.current) since.current = Date.now();
    });
  }
  const timers = useRef<number[]>([]);
  const hopTimers = useRef<number[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const pathRef = useRef<HTMLDivElement>(null);
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
  const clearTimers = () => {
    guideHand.stop();
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    hopTimers.current.forEach((t) => window.clearTimeout(t));
    hopTimers.current = [];
  };
  useEffect(() => clearTimers, []);

  const base: Go = goes[Math.min(at, goes.length - 1)];
  const go: Go = sister ?? base;
  const kinds = useSeenKinds(seen, onSeen);
  /** A kind not yet seen (hopping back, starting on the bigger number) gets its demo before the first go of it, once. */
  const unseen = DEMO_KINDS.includes(go.kind) && !kinds.has(go.kind);
  const demoKind = unseen && phase === 'ask' ? (go.kind as DemoKind) : null;
  const demo = useKindDemo({ kind: demoKind, seen: kinds, mark: kinds.mark, steps: demoKind ? DEMOS[demoKind].steps : [], say });
  const demoWas = useRef(false);
  const guided = guide && at === 0 && !sister;
  /** The hand on the very first go: it starts pointing after GUIDE_MS and stops when the child moves on. */
  const guideHand = useGuidedFirstGo(guided, GUIDE_MS);
  const start: Help = boost || guided ? 'full' : helpFor(go.h, setting);
  const twoStep = start === 'full';
  const splitFirst = start === 'split';
  /** What the picture shows: a split go has every stone numbered, so the child can count to the big rock while splitting; a mistake being shown or looked at brings the whole picture. */
  const shown: Help = why !== null || look !== null || start === 'split' ? 'full' : start;

  /** Weka hops stone by stone to `to`. */
  function hopTo(from: number, to: number, then?: () => void) {
    const path = between(from, to);
    hopTimers.current.forEach((t) => window.clearTimeout(t));
    hopTimers.current = [];
    const hop = (ms: number, f: () => void) => hopTimers.current.push(window.setTimeout(f, ms));
    setPos(from);
    setPose('hop');
    path.forEach((n, i) => hop(i * HOP_MS, () => setPos(n)));
    hop(path.length * HOP_MS + 60, () => {
      setPose('land');
      then?.();
    });
  }

  // Each new go is read aloud once and Weka waits on the starting stone.
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    const s: Step = twoStep ? 'toTen' : splitFirst ? 'split' : 'answer';
    setStep(s);
    setBond(0);
    setBondWrongs(0);
    clearSplitWhy();
    setPos(go.from);
    setPose('wait');
    setLit([]);
    setRestLit([]);
    setRockDone(false);
    setGone([]);
    setWhy(null);
    setRedo(false);
    flow.current = NEW_GO;
    guideHand.stop();
    // A kind not yet seen is shown first; its question is read when the demo is over.
    if (!(DEMO_KINDS.includes(go.kind) && !kinds.has(go.kind))) {
      askAloud(s === 'toTen' ? toTenLine(go, guided) : s === 'split' ? splitFirstLine(go) : askLine(go, guided));
    }
    guideHand.start();
    return () => {
      asking.current++;
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
    askAloud(step === 'toTen' ? toTenLine(go, guided) : step === 'split' ? splitFirstLine(go) : askLine(go, guided));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.playing]);

  // "Let's look together": Weka hops the whole make-ten sentence, one hop for each step the pebbles fill.
  useEffect(() => {
    if (!look) return;
    const path = [...between(go.from, 10), ...between(10, go.answer)];
    setPose(look.filled ? 'hop' : 'wait');
    setPos(look.filled ? path[Math.min(look.filled, path.length) - 1] : go.from);
    // Only when a step fills.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look?.filled]);

  /** Bella counts the hops to the big rock with the child, lighting each stone. */
  function countTogether() {
    const path = between(go.from, 10);
    setLit([]);
    say(WORDS.countWithMe);
    path.forEach((n, i) =>
      later(1500 + i * COUNT_MS, () => {
        setLit((l) => [...l, n]);
        say(WORDS.yes(i + 1));
      }),
    );
  }

  /** Where a go starts: hops to the big rock first, the split first, or straight to the answer. */
  const firstStep = (): Step => (twoStep ? 'toTen' : splitFirst ? 'split' : 'answer');
  const lineFor = (g: Go, s: Step) => (s === 'toTen' ? toTenLine(g) : s === 'split' ? splitFirstLine(g) : askLine(g));

  /** "Now you try one like it": a sister go from its first step, in the same help. Nothing on it is marked, nothing is sent. */
  function startSister(sis: Go) {
    const s = firstStep();
    setSister(sis);
    setRedo(false);
    setStep(s);
    setBond(0);
    setBondWrongs(0);
    clearSplitWhy();
    setPos(sis.from);
    setPose('wait');
    setLit([]);
    setRestLit([]);
    setRockDone(false);
    setGone([]);
    setWhy(null);
    setWrongs(0);
    guideHand.stop();
    say(WORDS.nowTry, () => askAloud(lineFor(sis, s)));
  }

  /** A wrong tap on the sister: its why line once, then the original go comes back with its right answer pointed at, so nobody is stuck. Nothing is saved. */
  function sisterWrong(n: number) {
    const sis = sister!;
    const kind = step === 'toTen' ? wrongKind(sis.toTenWrongs, n) : wrongKind(sis.wrongs, n);
    clearTimers();
    setWobble(n);
    if (sound) playSound('tap');
    later(WOBBLE_MS, () => setWobble(null));
    const back: Step = step === 'toTen' ? 'toTen' : 'answer';
    const onRock = back === 'answer' && (twoStep || splitFirst);
    setSister(null);
    setRedo(true);
    setStep(back);
    setBond(2);
    setBondWrongs(0);
    clearSplitWhy();
    setRockDone(onRock);
    setPos(onRock ? 10 : base.from);
    setPose('wait');
    setLit([]);
    setRestLit([]);
    setGone([]);
    setWrongs(3);
    flow.current = { phase: 'redo', wrong: 2 };
    if (kind) {
      setWhy({ kind, tap: wrongs + 1, go: sis });
      say(whyLine(sis, kind), () => askAloud(back === 'toTen' ? toTenLine(base) : onRock ? fromTenLine(base) : askLine(base)));
    } else {
      setWhy(null);
      say(WORDS.tryAgain, () => askAloud(back === 'toTen' ? toTenLine(base) : onRock ? fromTenLine(base) : askLine(base)));
    }
  }

  /** The second wrong tap of a question: Weka hops the whole make-ten sentence while the pebbles fill the first ten-frame, then a sister question (or, if none, the same question again). */
  function lookTogether() {
    setWhy(null);
    setGone([]);
    setLit([]);
    setRestLit([]);
    setPos(go.from);
    setPose('wait');
    const wasStep = step;
    const onRock = rockDone;
    const sis = sisterGo(round, at, go, { hops: wasStep === 'toTen' });
    startLook({
      anchor: 0,
      steps: go.small,
      openingLine: WORDS.lookTogether,
      fillLine: stemLine(go),
      onEnd: () => {
        flow.current = stepGo(flow.current, 'lookDone');
        if (sis) return startSister(sis);
        setRedo(true);
        setPos(onRock ? 10 : go.from);
        setPose('wait');
        const again = wasStep === 'toTen' ? toTenLine(go) : onRock ? fromTenLine(go) : askLine(go);
        say(WORDS.nowTry, () => askAloud(again));
      },
    });
  }

  /** The picture of a mistake on the stones (the bond and the pebbles are drawn in the panel). */
  function showOnStones(kind: string, n: number) {
    setLit([]);
    setRestLit([]);
    setPos(go.from);
    setPose('wait');
    if (kind === 'rock') {
      hopTo(go.from, 10);
      setRestLit(between(10, go.answer));
    } else if (kind === 'off1') hopTo(go.from, n);
    else if (kind === 'other') setLit(between(go.from, 10));
    else if (kind === 'ten') setLit([10]);
    else if (kind === 'near' || kind === 'add') {
      setLit(between(go.from, 10));
      hopTo(go.from, 10);
    }
  }

  function wrong(n: number) {
    if (sister) return sisterWrong(n);
    const w = wrongs + 1;
    setWrongs(w);
    if (!firstWrong) {
      setFirstWrong(true);
      const s = streak + 1;
      setStreak(s);
      if (s >= STRUGGLE_GOES) setBoost(true);
    }
    setWobble(n);
    if (sound) playSound('tap');
    later(WOBBLE_MS, () => setWobble(null));
    flow.current = stepGo(flow.current, 'wrong');
    if (flow.current.phase === 'look') return lookTogether();
    const kind = step === 'toTen' ? wrongKind(go.toTenWrongs, n) : wrongKind(go.wrongs, n);
    if (!kind) return say(WORDS.tryAgain);
    setGone((g) => [...g, n]);
    setWhy({ kind, tap: w });
    showOnStones(kind, n);
    say(whyLine(go, kind));
  }

  function pick(n: number) {
    if (phase !== 'ask' || look || demo.playing || gone.includes(n)) return;
    tappedYet.current = true;
    if (step === 'toTen') {
      // Help only: never sent, never recorded.
      if (n !== go.toTen) return wrong(n);
      clearTimers();
      setWrongs(0);
      setLit([]);
      setRestLit([]);
      setGone([]);
      setWhy(null);
      setRedo(false);
      flow.current = NEW_GO;
      if (sound) playSound('tap');
      hopTo(go.from, 10, () => {
        setRockDone(true);
        setStep('answer');
        askAloud(fromTenLine(go));
        guideHand.start();
      });
      return;
    }
    if (sister && n !== go.answer) return sisterWrong(n);
    const now = Date.now();
    // A right tap on the sister sends the original go's right pick instead, so the saved taps end the go the usual way.
    const next = [...taps, { pick: sister ? base.answer : n, ms: now - since.current }];
    since.current = now;
    setTaps(next);
    if (n !== go.answer) return wrong(n);
    if (!firstWrong) setStreak(0);
    clearTimers();
    setWhy(null);
    kinds.mark([go.kind]);
    setPhase('right');
    say(rightLine(go, shown));
    if (sound) playSound('badge');
    // Show the whole journey: to the big rock (if not there yet), then on.
    const hopOn = () => hopTo(10, go.answer, () => setPose('cheer'));
    if (rockDone) {
      setPos(10);
      hopOn();
    } else hopTo(go.from, 10, hopOn);
    later(RIGHT_MS + (Math.abs(go.from - go.answer) * HOP_MS), () => {
      // After the sister the child goes on. A child who got it right first time skips the pebbles and the split (the pebbles stay one go in five).
      if (sister || skipPracticeFor(!firstWrong, guided, at)) nextGo(next);
      else if (pebblesFor(start) && go.kind !== 'back') setPhase('pebbles');
      else afterPebbles();
    });
  }

  /** A wrong first Check on the pebbles: this go was not right first time, so help comes back sooner (the saved record is not changed). */
  function pebblesFirstWrong() {
    if (firstWrong) return;
    setFirstWrong(true);
    const s = streak + 1;
    setStreak(s);
    if (s >= STRUGGLE_GOES) setBoost(true);
  }

  /** After the pebbles (or straight after a right answer): the split bond, unless the child split first. */
  function afterPebbles() {
    if (splitFirst) return nextGo();
    setPhase('bond');
    setBond(0);
    setBondWrongs(0);
    clearSplitWhy();
    say(bondAskLine(go));
  }

  /** A wrong number in the split: grey it out and say what it makes (never the answer). */
  function saySplitWhy(n: number) {
    const line = splitWhyLine(go, bond === 0 ? 0 : 1, n);
    setSplitGone((g) => [...g, n]);
    setSplitSaid(line);
    say(line);
  }
  const clearSplitWhy = () => {
    setSplitGone([]);
    setSplitSaid('');
  };

  /** Split-first goes: the part of the number that gets to ten, then the rest, then Weka hops to the big rock. Help only. */
  function pickSplit(n: number) {
    if (phase !== 'ask' || demo.playing || step !== 'split' || bond >= 2 || splitGone.includes(n)) return;
    tappedYet.current = true;
    if (n !== (bond === 0 ? go.toTen : go.rest)) {
      const w = bondWrongs + 1;
      setBondWrongs(w);
      if (!firstWrong) {
        setFirstWrong(true);
        const s = streak + 1;
        setStreak(s);
        if (s >= STRUGGLE_GOES) setBoost(true);
      }
      setWobble(n);
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => setWobble(null));
      // The second wrong tap: count the hops to the big rock together, or say the make-ten sentence for the rest.
      if (w === 2) {
        if (bond === 0) countTogether();
        else say(stemLine(go));
      } else saySplitWhy(n);
      return;
    }
    if (sound) playSound('tap');
    setBondWrongs(0);
    clearSplitWhy();
    if (bond === 0) {
      setBond(1);
      setLit(between(go.from, 10));
      say(splitRestLine(go));
      return;
    }
    setBond(2);
    clearTimers();
    setLit([]);
    hopTo(go.from, 10, () => {
      setRockDone(true);
      setStep('answer');
      askAloud(splitDoneLine(go));
    });
  }

  /** Filling in the split: first the hops to the big rock, then the hops after it. Help only: never sent. */
  function pickBond(n: number) {
    if (phase !== 'bond' || bond >= 2 || splitGone.includes(n)) return;
    if (n !== (bond === 0 ? go.toTen : go.rest)) {
      setBondWrongs((w) => w + 1);
      setWobble(n);
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => setWobble(null));
      saySplitWhy(n);
      return;
    }
    if (sound) playSound('tap');
    setBondWrongs(0);
    clearSplitWhy();
    setBond(bond + 1);
    say(bond === 0 ? BOND_MORE : bondLine(go, true));
  }

  function nextGo(all: Tap[] = taps) {
    clearTimers();
    setSister(null);
    if (at + 1 >= goes.length) {
      setPhase('done');
      later(600, () => onDone(all));
    } else {
      setAt(at + 1);
      setPhase('ask');
      setWrongs(0);
      setFirstWrong(false);
    }
  }

  const choices = step === 'toTen' ? go.toTenChoices : go.choices;
  const target = step === 'toTen' ? go.toTen : go.answer;
  const pointAt = phase === 'ask' && !look && (guideHand.pointing || wrongs >= 3) ? target : null;
  const lastGo = at + 1 >= goes.length;
  const made = at + (phase === 'ask' ? 0 : 1);
  const style = { ...backFor(scenery) } as CSSProperties;
  const sign = go.kind === 'back' ? '−' : '+';
  const onBigRock = rockDone && step === 'answer';
  const ask = step === 'toTen'
    ? `${go.parts.join(' ').replace(' = ?', '')}: how many hops to 10?`
    : step === 'split' ? `${go.parts.join(' ').replace(' = ?', '')}: ${WORDS.splitFirstLabel(go.small).toLowerCase()}`
    : go.parts.join(' ');
  const stem = phase !== 'bond' && phase !== 'pebbles' && (onBigRock || look !== null || phase !== 'ask') && shown !== 'none'
    ? go.kind === 'back' ? `${go.total} − ${go.toTen} = 10, then − ${go.rest}` : `${go.big} + ${go.toTen} = 10, then + ${go.rest}`
    : '';
  /** The stones on the way to the big rock, shown once Weka has hopped there or a hint lights them. */
  const showAll = phase !== 'ask' || look !== null;
  const toStones = new Set(onBigRock || showAll ? between(go.from, 10) : lit);
  const onStones = new Set(showAll ? between(10, go.answer) : restLit);

  if (demo.playing && demoKind) {
    return (
      <div className={`wk-play wk-stream--${scenery}`} style={style}>
        <h2 className="wk-sr" tabIndex={-1} ref={heading}>{WORDS.demoTitle}</h2>
        <div className="wk-top">
          <div className="wk-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
            {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
              <span key={i} className={i < made ? 'wk-pip wk-pip--done' : 'wk-pip'} />
            ))}
          </div>
        </div>
        <DemoScene kind={demoKind} step={demo.step} friend={friend} />
        <DemoBar prefix="wk" skipLabel={WORDS.skip} canSkip={demo.canSkip} onSkip={demo.skip} />
      </div>
    );
  }

  return (
    <div className={`wk-play wk-stream--${scenery}`} style={style}>
      <h2 className="wk-sr" tabIndex={-1} ref={heading}>{WORDS.pickNumber}</h2>
      <div className="wk-top">
        <div className="wk-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
          {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
            <span key={i} className={i < made ? 'wk-pip wk-pip--done' : 'wk-pip'} />
          ))}
        </div>
        <HearAgain prefix="wk" label={WORDS.hearAgain} onHear={() => look ? undefined : splitSaid ? say(splitSaid) : why ? say(whyLine(why.go ?? go, why.kind as never)) : say(step === 'toTen' ? toTenLine(go) : step === 'split' ? (bond === 0 ? splitFirstLine(go) : splitRestLine(go)) : onBigRock ? fromTenLine(go) : askLine(go))} />
      </div>
      {phase !== 'pebbles' && <p className="wk-ask" aria-live="polite">{ask}</p>}
      {/* The make-ten sentence, once Weka is on the big rock or a hint has said it. */}
      <p className={`wk-stem${stem ? '' : ' wk-stem--empty'}`} aria-live="polite">{stem}</p>
      {/* The hops Weka will make: one group, or split into to-the-rock and after on full help. */}
      {shown !== 'none' && phase !== 'bond' && phase !== 'pebbles' && step !== 'split' && (
        <div className="wk-hops" aria-hidden="true">
          <span className="wk-hops__label">{sign}{go.small}</span>
          {Array.from({ length: go.small }, (_, i) => (
            <Fragment key={i}>
              {shown === 'full' && i === go.toTen && <span className="wk-hops__gap" />}
              <Hop part={shown === 'full' && i >= go.toTen ? 'on' : 'to'} />
            </Fragment>
          ))}
        </div>
      )}
      {/* The pebbles take the stream's place, so both ten-frames fit. */}
      {phase !== 'pebbles' && <div className={`wk-scene wk-scene--${shown}${go.kind === 'back' ? ' wk-scene--back' : ''}`} key={at} aria-hidden="true">
        {shown === 'none' && phase === 'ask' ? (
          <div className="wk-water-only">
            <span className="wk-scene__friend wk-scene__friend--bank"><Friend friend={friend} pose={pose} /></span>
          </div>
        ) : (
          <div className="wk-path" ref={pathRef}>
            {STONES.map((n) => {
              const numbered = shown === 'full' || n % 5 === 0 || phase !== 'ask' || toStones.has(n);
              const mark = toStones.has(n) ? 'to' : onStones.has(n) ? 'on' : null;
              const point = n === go.from ? 'from' : n === 10 ? 'ten' : n === go.answer && phase !== 'ask' ? 'answer' : null;
              return (
                <span key={n} data-n={n} className={`wk-path__spot${n < 5 ? ' wk-path__spot--narrow' : ''}${n === 10 ? ' wk-path__spot--big' : ''}${lit.includes(n) ? ' wk-path__spot--lit' : ''}`}>
                  <StepStone n={n} big={n === 10} shade={(n - 1) % 10 < 5 ? 'light' : 'dark'} number={numbered} mark={mark} />
                  {point && <Pointer kind={point} />}
                  {n === pos && (
                    <span className="wk-scene__friend">
                      <Friend friend={friend} pose={pose} />
                    </span>
                  )}
                </span>
              );
            })}
            {phase === 'bond' && <Jumps path={pathRef} go={go} shown={2} />}
          </div>
        )}
      </div>}
      {phase === 'pebbles' ? (
        <Pebbles key={at} go={go} guided={guided} sound={sound} last={lastGo} say={say} onFirstWrong={pebblesFirstWrong} onNext={afterPebbles} />
      ) : phase === 'bond' ? (
        <Bond go={go} gone={splitGone} filled={bond} wrongs={bondWrongs} guided={guided} wobble={wobble} last={lastGo} onPick={pickBond} onNext={() => nextGo()} />
      ) : step === 'split' ? (
        <Bond go={go} gone={splitGone} filled={bond} wrongs={bondWrongs} guided={guided} wobble={wobble} last={lastGo} onPick={pickSplit} onNext={() => nextGo()} first />
      ) : (
      <div className="wk-answer">
        {why && phase === 'ask' && !look && (
          <ShowWhy
            prefix="wk"
            tapKey={`${at}-${step}-${why.tap}`}
            picture={why.kind === 'double' ? <BondDiagram go={why.go ?? go} filled={2} label={bondLine(why.go ?? go)} /> : why.kind === 'part' ? <PebblePicture go={why.go ?? go} moved={(why.go ?? go).toTen} /> : null}
            line={whyLine(why.go ?? go, why.kind as never)}
          />
        )}
        {look && (
          <LookTogether
            prefix="wk"
            title={WORDS.lookTogether}
            picture={<PebblePicture go={go} moved={Math.min(look.filled, go.toTen)} />}
            line={stemLine(go)}
            skipLabel={WORDS.goOn}
            canSkip={look.canSkip}
            onSkip={skipLook}
          />
        )}
        {(redo || sister) && !why && !look && phase === 'ask' && <NowYouTry prefix="wk" line={WORDS.nowTry} />}
      <div className="wk-choices" role="group" aria-label={WORDS.pickNumber}>
        {choices.map((n) => (
          <button
            key={`${at}-${step}-${n}`}
            type="button"
            disabled={gone.includes(n) || look !== null}
            className={`wk-choice${gone.includes(n) ? ' wk-choice--gone' : ''}${wobble === n ? ' wk-choice--wobble' : ''}${phase !== 'ask' && n === go.answer ? ' wk-choice--right' : ''}${n === pointAt ? ' wk-choice--pointed' : ''}`}
            onClick={() => pick(n)}
            aria-label={pointedLabel(n, n === pointAt, WORDS.guideHere)}
          >
            <Stone metal="grey" value={n} />
            {n === pointAt && <PointingHand prefix="wk" />}
          </button>
        ))}
      </div>
      </div>
      )}
    </div>
  );
}

/**
 * A small coloured arrow under a stone pointing up at it (James, 12 Nov 2026): orange at the start number, gold at the
 * big rock (10), blue at the answer. The answer's arrow only comes once the child has answered, so it never gives it away.
 */
function Pointer({ kind }: { kind: 'from' | 'ten' | 'answer' }) {
  return (
    <svg className={`wk-point wk-point--${kind}`} viewBox="0 0 20 28" aria-hidden="true">
      <path d="M10 2 L18 13 H13 V26 H7 V13 H2 Z" />
    </svg>
  );
}

/**
 * The two jumps of the split drawn under the stones as arrows (James, 5 Nov 2026): orange from the start to the big rock
 * ("+1"), then blue from the big rock to where Weka landed ("+4"), both shown as soon as the bond's circles appear (James).
 * Measured from the stones, so it works on one line or two rows of ten; a jump across the rows leaves one row and
 * comes in at the start of the next.
 */
function Jumps({ path, go, shown }: { path: React.RefObject<HTMLDivElement | null>; go: Go; shown: number }) {
  const [box, setBox] = useState<{ w: number; h: number; spots: Record<number, { x: number; y: number; w: number; h: number }> } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = path.current;
      if (!el) return;
      const base = el.getBoundingClientRect();
      const spots: Record<number, { x: number; y: number; w: number; h: number }> = {};
      el.querySelectorAll<HTMLElement>('[data-n]').forEach((s) => {
        const step = s.querySelector('.wk-step') ?? s;
        const r = step.getBoundingClientRect();
        // A stone with a pointer under it: the jump starts and lands at the pointer's foot, so the two don't cross.
        const foot = s.querySelector('.wk-point')?.getBoundingClientRect().bottom ?? r.bottom;
        if (r.width) spots[Number(s.dataset.n)] = { x: r.left - base.left + r.width / 2, y: foot - base.top, w: r.width, h: r.height };
      });
      setBox({ w: base.width, h: base.height, spots });
    };
    measure();
    // When the stones come back with the jumps (after the pebbles), the row's ref is only set after this runs: measure again.
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [path]);
  if (!box) return null;
  const sign = go.kind === 'back' ? '−' : '+';
  const jumps: { from: number; to: number; size: number; part: 'to' | 'on' }[] = [
    { from: go.from, to: 10, size: go.toTen, part: 'to' },
    { from: 10, to: go.answer, size: go.rest, part: 'on' },
  ].slice(0, shown) as never;
  const arc = (x1: number, x2: number, y: number, depth: number) => `M ${x1} ${y} Q ${(x1 + x2) / 2} ${y + depth * 2} ${x2} ${y}`;
  return (
    <svg className="wk-jumps" width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true">
      <defs>
        {(['to', 'on'] as const).map((p) => (
          <marker key={p} id={`wk-head-${p}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className={`wk-jumps__head--${p}`} />
          </marker>
        ))}
      </defs>
      {jumps.map((j) => {
        const a = box.spots[j.from];
        const b = box.spots[j.to];
        if (!a || !b) return null;
        const depth = Math.max(14, a.h * 0.55);
        const pieces: string[] = [];
        let label = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + depth + 4 };
        if (Math.abs(a.y - b.y) < 4) {
          const y = Math.max(a.y, b.y) - 2;
          pieces.push(arc(a.x, b.x, y, depth));
          label = { x: (a.x + b.x) / 2, y: y + depth + 4 };
        } else {
          // Across the two rows: out past the end of one row, in from the start of the other.
          const forward = j.to > j.from;
          const edgeA = forward ? box.w : 0;
          const edgeB = forward ? 0 : box.w;
          pieces.push(arc(a.x, edgeA, a.y - 2, depth * 0.6));
          pieces.push(arc(edgeB, b.x, b.y - 2, depth));
          label = { x: (edgeB + b.x) / 2, y: b.y - 2 + depth + 4 };
        }
        return (
          <g key={j.part} className={`wk-jumps__jump wk-jumps__jump--${j.part}`}>
            {pieces.map((d, i) => (
              <path key={i} d={d} markerEnd={i === pieces.length - 1 ? `url(#wk-head-${j.part})` : undefined} />
            ))}
            <text x={label.x} y={label.y} dominantBaseline="hanging" textAnchor="middle">{sign}{j.size}</text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The split as a part-whole bond: the smaller number on top, the hops to the big rock (orange, like those stones) and
 * the hops after it (blue) below. The child taps a number for each empty part; after two wrong taps the hand points.
 */
function Bond({ go, gone, filled, wrongs, guided, wobble, last, onPick, onNext, first = false }: {
  go: Go; gone: number[]; filled: number; wrongs: number; guided: boolean; wobble: number | null; last: boolean;
  onPick: (n: number) => void; onNext: () => void;
  /** Split-first: the child splits before answering, so there is no Next button; the go moves on by itself. */
  first?: boolean;
}) {
  const target = filled === 0 ? go.toTen : go.rest;
  const pointAt = filled < 2 && (guided || wrongs >= 2) ? target : null;
  return (
    <div className="wk-bond-area">
      <BondDiagram go={go} filled={filled} label={filled >= 2 && !first ? bondLine(go) : first ? WORDS.splitFirstLabel(go.small) : WORDS.splitLabel(go.small)} />
      {filled < 2 ? (
        <div className="wk-choices wk-choices--bond" role="group" aria-label={WORDS.pickNumber}>
          {toTenChoicesFor(target).map((n) => (
            <button
              key={`${filled}-${n}`}
              type="button"
              className={`wk-choice${gone.includes(n) ? ' wk-choice--gone' : ''}${wobble === n ? ' wk-choice--wobble' : ''}${n === pointAt ? ' wk-choice--pointed' : ''}`}
              onClick={() => onPick(n)}
              aria-label={pointedLabel(n, n === pointAt, WORDS.guideHere)}
            >
              <Stone metal="grey" value={n} />
              {n === pointAt && <PointingHand prefix="wk" />}
            </button>
          ))}
        </div>
      ) : first ? null : (
        <div className="wk-bond__done">
          <p className="wk-bond__said" aria-live="polite">{bondLine(go)}</p>
          <button type="button" className="wk-button wk-next" onClick={onNext}>{last ? WORDS.finish : WORDS.next} <span aria-hidden="true">➜</span></button>
        </div>
      )}
    </div>
  );
}

/** The part-whole bond: the smaller number on top, the hops to the big rock and the hops after it below, `filled` of them showing. */
function BondDiagram({ go, filled, label }: { go: Go; filled: number; label: string }) {
  const part = (n: number, which: 'to' | 'on', i: number) => (
    <span className={`wk-bond__part wk-bond__part--${which}${filled === i ? ' wk-bond__part--now' : ''}`}>{filled > i ? n : ''}</span>
  );
  return (
    <div className="wk-bond" role="img" aria-label={label}>
      <svg className="wk-bond__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line x1="50" y1="30" x2="22" y2="72" />
        <line x1="50" y1="30" x2="78" y2="72" />
      </svg>
      <span className="wk-bond__whole">{go.small}</span>
      {part(go.toTen, 'to', 0)}
      {part(go.rest, 'on', 1)}
    </div>
  );
}

/** Two ten-frames, still: the bigger number in gold, `moved` silver pebbles filling the first, the rest of the smaller number in the second. */
function PebblePicture({ go, moved }: { go: Go; moved: number }) {
  const src = paint('frames/ten-frame');
  const full = go.big + moved >= 10;
  return (
    <div className="wk-still">
      <Frame label={full ? WORDS.tenFull : WORDS.pebblesIn(go.big + moved)} src={src} full={full}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="wk-frame__cell">
            {i < go.big ? <span className="wk-pebble"><Stone metal="gold" /></span> : i < go.big + moved ? <span className="wk-pebble wk-pebble--arrived"><Stone metal="silver" /></span> : null}
          </span>
        ))}
      </Frame>
      <Frame label={WORDS.pebblesIn(go.small - moved)} src={src}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="wk-frame__cell">{i < go.small - moved && <span className="wk-pebble"><Stone metal="silver" /></span>}</span>
        ))}
      </Frame>
    </div>
  );
}
