/**
 * Today's challenge at Parrot’s See-saw: ten goes, each an equation with a missing number that keeps the see-saw level
 * (docs/plans/maths-review/new-games/N2-balance.md).
 *
 * Each go comes with its help level from the server: 5 stones with a live tilt (each stone placed tips the see-saw);
 * 4 stones, the tilt only on Check; 3 numbered weights; 2 the equation and a small see-saw; 1 the equation and a Peek;
 * 0 the equation only. A first wrong tap lifts that go's level by one, a second takes it to the top (levelFor), and three
 * goes in a row with a wrong first tap keep the top level for the round. The answer is never shown or said before a right tap.
 *
 * Stone goes (levels 5 and 4 on the missing-number, swap and both-sides goes): the child adds stones to the empty pan
 * from the heap, then presses Check; the pick sent is the stone count and the cards are not shown. Every other go
 * is four cards (true or false: tips left, level, tips right).
 *
 * Mistakes that teach: the first wrong tap says why, with a small see-saw tipping with the slip's number placed; the
 * second is "Let's look together" (Parrot counts both sides), then "Now you try one like it.": a sister go (same key, one number
 * moved by 1 or 2, no marked card) that is local only. A right tap on it moves on; a wrong one says why once and goes back to
 * the original go with its two cards, the right one marked. If no sister fits, the original go is asked again with two cards, the
 * right one marked. The original go's right pick is what is sent, so the server's replay stays valid.
 * Only a go's first tap is scored (play.ts), so a shown go is never a clean right. Only the picks are sent; the server replays them.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { STRUGGLE_GOES } from '../../../shared/kit/help';
import { NEW_GO, stepGo } from '../../../shared/kit/mistakes';
import type { Friend as FriendName } from '../../../shared/parrot/config';
import type { Tap } from '../../../shared/parrot/play';
import { balance, GOES_PER_ROUND, isStoneGo, levelFor, MAX_STONES, redoCards, showRound, sisterGo, slipOfPick, tiltOf, type Go, type ParrotKind, type Round } from '../../../shared/parrot/round';
import { DemoBar } from '../../kit/DemoBar';
import { HearAgain } from '../../kit/HearAgain';
import { PointingHand } from '../../kit/PointingHand';
import { LookTogether, NowYouTry, ShowWhy, useLookTogether } from '../../kit/ShowWhy';
import { useGuidedFirstGo } from '../../kit/useGuidedFirstGo';
import { useKindDemo } from '../../kit/useKindDemo';
import { useSeenKinds } from '../../kit/useSeenKinds';
import { playSound } from '../sounds';
import { Friend, PAN_ROOM, rowWidth, SeeSaw, StoneHeap, TipGlyph, sceneStyle, type Item, type Pose, type Tilt } from './art';
import { DEMOS, DEMO_KINDS, type DemoKind } from './demo';
import { askLine, eqLine, lookScript, modelLine, whyLine } from './voiceLines';
import { WORDS } from './words';

const RIGHT_MS = 3800;
const WOBBLE_MS = 600;
const LAUGH_MS = 1400;
/** "Let's look together": at least this long per step (a child's pace, like Robin's berries), and how long the opening may take. */
const COUNT_MS = 1500;
const LOOK_START_MS = 6000;
/** The guided first go: after this pause the hand points at the stone heap, then at Check. */
const GUIDE_MS = 3000;

type Phase = 'ask' | 'right' | 'done';

interface Props {
  round: Round;
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

// ---------------------------------------------------------------- the pictures

/** The equation's sides as weights: numbers are numbered blocks, a number after a take-away is a take-away block, "?" is the gap. */
function weightsOf(go: Pick<Go, 'parts'>, fill: number | null): { left: Item[]; right: Item[]; value: [number, number] } {
  const [lt, rt] = [go.parts.slice(0, go.parts.indexOf('=')), go.parts.slice(go.parts.indexOf('=') + 1)];
  const side = (tokens: string[]): { items: Item[]; value: number } => {
    const items: Item[] = [];
    let value = 0;
    tokens.forEach((t, i) => {
      if (t === '?') {
        items.push({ t: 'gap', fill });
        value += tokens[i - 1] === '−' ? -(fill ?? 0) : fill ?? 0;
      } else if (/^\d+$/.test(t)) {
        const n = Number(t);
        if (tokens[i - 1] === '−') {
          items.push({ t: 'minus', n });
          value -= n;
        } else {
          items.push({ t: 'weight', n });
          value += n;
        }
      }
    });
    return { items, value };
  };
  const [l, r] = [side(lt), side(rt)];
  return { left: l.items, right: r.items, value: [l.value, r.value] };
}

/** Which way the numbered see-saw leans with `n` in the gap. A true or false go has no gap: the lean is its own answer. */
function leanWith(go: Go, n: number): Tilt {
  if (go.kind === 'tf') return go.answer === 0 ? 'left' : go.answer === 1 ? 'level' : 'right';
  const { value } = weightsOf(go, n);
  return value[0] === value[1] ? 'level' : value[0] > value[1] ? 'left' : 'right';
}

/** The numbered see-saw for a go, with `fill` in the gap (null for empty). */
function Weights({ go, fill, tilt, className = '' }: { go: Go; fill: number | null; tilt: Tilt; className?: string }) {
  const { left, right } = weightsOf(go, fill);
  return <SeeSaw left={left} right={right} tilt={tilt} className={className} />;
}

/** The equation as written: "8 = 5 + ?", the gap filled once the go is right. */
function Equation({ go, fill, big }: { go: Go; fill: number | null; big: boolean }) {
  const tf = go.kind === 'tf';
  const eq = (
    <p className={`pr-eq${big ? ' pr-eq--big' : ''}`} aria-live="polite">
      {go.parts.map((t, i) =>
        tf && t === '=' ? (
          <span key={i} className={`pr-eq__op pr-eq__ask${fill === null ? '' : ' pr-eq__glyph'}`}>
            <span className="pr-sr">{WORDS.sameAs}</span>
            {fill === null ? <span aria-hidden="true">?</span> : <TipGlyph dir={fill === 0 ? 'left' : fill === 1 ? 'level' : 'right'} />}
          </span>
        ) : t === '?' ? (
          <span key={i} className={`pr-eq__gap${fill === null ? '' : ' pr-eq__gap--filled'}`}>{fill === null ? '?' : fill}</span>
        ) : (
          <span key={i} className={/^\d+$/.test(t) ? 'pr-eq__num' : 'pr-eq__op'}>{t}</span>
        ),
      )}
    </p>
  );
  if (!tf) return eq;
  return (
    <>
      <p className="pr-sameq">{WORDS.sameQ}</p>
      {eq}
    </>
  );
}

/** The weight of each pan written under it. */
function Totals({ go }: { go: Go }) {
  const [l, r] = weightsOf(go, null).value;
  return (
    <p className="pr-totals" aria-label={`${l} and ${r}`}>
      <span>{l}</span>
      <span>{r}</span>
    </p>
  );
}

/** The stones on the pans: the left side, and on the right what is there already, then the child's own stones. */
function StoneSaw({ go, placed, tilt, wobble }: { go: Go; placed: number; tilt: Tilt; wobble: boolean }) {
  const left: Item[] = go.lg.map((n) => ({ t: 'stones', n }));
  const right: Item[] = go.rg.map((n) => ({ t: 'stones', n }));
  right.push(placed > 0 ? { t: 'stones', n: placed, tint: 'b' } : { t: 'gap' });
  return <SeeSaw left={left} right={right} tilt={tilt} wobble={wobble} label={WORDS.sawLabel} />;
}

/**
 * "Let's look together", big and slow (lookScript): step 1 points at the left side and writes its stones, step 2 the right side,
 * step 3 lets the see-saw tip, then (after the "add stones" line) one stone goes on, or comes off, the right side per step,
 * the right side's sum written as it grows ("5 + 3"), until it is level. A true or false go tips at step 3 and stops there.
 */
function CountingSaw({ go, filled, before }: { go: Go; filled: number; before: number }) {
  const left: Item[] = go.lg.map((n) => ({ t: 'stones', n }));
  const right: Item[] = go.rg.map((n) => ({ t: 'stones', n }));
  const tf = go.kind === 'tf';
  const added = tf ? 0 : Math.min(Math.max(0, filled - before), go.answer);
  if (go.gs === -1) right[0] = { t: 'stones', n: go.rg[0] - added };
  else if (added > 0) right.push({ t: 'stones', n: added, tint: 'b' });
  const tilt: Tilt = filled < 3 ? 'rest' : tf ? leanWith(go, 0) : tiltOf(go, added);
  const focus = filled === 1 ? 'left' : filled === 2 ? 'right' : null;
  const [l, r] = [go.lg.reduce((s, n) => s + n, 0), go.rg.reduce((s, n) => s + n, 0)];
  // The stones as big as the widest side allows once the count is done, the same size on both sides and through the count.
  const widest = Math.max(rowWidth(left), rowWidth(tf || go.gs === -1 ? go.rg.map((n) => ({ t: 'stones', n })) : [...go.rg.map((n): Item => ({ t: 'stones', n })), { t: 'stones', n: go.answer }]));
  const zoom = Math.min(1.6, PAN_ROOM / widest);
  return (
    <div className="pr-lookpic">
      <SeeSaw left={left} right={right} tilt={tilt} focus={focus} close zoom={zoom} className="pr-saw--look" />
      <p className="pr-looktotals" aria-hidden="true">
        <span className={focus === 'left' ? 'pr-looktotals--on' : ''}>{filled >= 1 ? l : ''}</span>
        <span className={focus === 'right' ? 'pr-looktotals--on' : ''}>
          {filled >= 2 ? r : ''}
          {added > 0 && <b className="pr-looktotals__added">{go.gs === -1 ? ' − ' : ' + '}{added}</b>}
        </span>
      </p>
    </div>
  );
}

/** The words under the big see-saw: the step's own line (the count shows as the sum, so it keeps the "add stones" line). */
function lookCaption(go: Go, filled: number, before: number): string {
  const { lines, fill } = lookScript(go);
  if (filled < 1) return fill;
  if (go.kind !== 'tf' && filled > before && filled >= lines.length) return WORDS.nowLevel;
  return lines[Math.min(filled, before) - 1];
}

/** After a wrong tap: a small see-saw with the slip's number placed, tipping. A true or false go tips its own way, with the pan totals. */
function WhyPicture({ go, pick, kind }: { go: Go; pick: number; kind: ParrotKind }) {
  const tf = go.kind === 'tf';
  return (
    <div className={`pr-whypic pr-whypic--${kind}`}>
      <Weights go={go} fill={tf ? null : pick} tilt={leanWith(go, tf ? 0 : pick)} className="pr-saw--small" />
      {tf && <Totals go={go} />}
    </div>
  );
}

/** The made-up go of a "Show me first" demo: the same pictures and cards as a real go, nothing to tap. */
function DemoScene({ kind, step, friend }: { kind: DemoKind; step: number; friend: FriendName }) {
  const { go, steps } = DEMOS[kind];
  const target = steps[step]?.target;
  const tf = kind === 'tf';
  const tilt: Tilt = tf ? (step >= 1 ? leanWith(go, 0) : 'rest') : step >= 1 ? 'level' : 'rest';
  const fill = tf ? (step >= 2 ? go.answer : null) : step >= 1 ? go.answer : null;
  return (
    <>
      <div className="pr-stage">
        <span className="pr-stage__friend" aria-hidden="true"><Friend friend={friend} pose="sit" /></span>
        <Weights go={go} fill={!tf && step >= 1 ? go.answer : null} tilt={tilt} />
        {tf && step >= 1 && <Totals go={go} />}
        <Equation go={go} fill={fill} big={false} />
      </div>
      <div className={`pr-cards${tf ? ' pr-cards--tf' : ''}`} role="group" aria-label={tf ? WORDS.pickTilt : WORDS.pickCard}>
        {go.choices.map((n) => {
          const pointed = target === 'card' && n === go.answer;
          const label = tf ? [WORDS.tipsLeft, WORDS.level, WORDS.tipsRight][n] : String(n);
          return (
            <button key={n} type="button" disabled className={`pr-choice${pointed ? ' pr-choice--hint' : ''}`} aria-label={label}>
              {tf ? (
                <>
                  <TipGlyph dir={n === 0 ? 'left' : n === 1 ? 'level' : 'right'} />
                  <span className="pr-choice__word">{label}</span>
                </>
              ) : (
                <span className="pr-choice__value">{n}</span>
              )}
              {pointed && <PointingHand prefix="pr" />}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- the goes

export function Goes({ round, friend, guide = false, seen, onSeen, sound, say, onDone }: Props) {
  const goes = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  /** The go's place in the two-tap flow (shared/kit/mistakes.ts). */
  const [flow, setFlow] = useState(NEW_GO);
  /** The last wrong pick's mistake, shown with its line until the next tap. */
  const [why, setWhy] = useState<{ pick: number; kind: ParrotKind; go?: Go } | null>(null);
  const { look, start: startLook, skip: skipLook } = useLookTogether(say);
  const [lookBefore, setLookBefore] = useState(4);
  const [tapped, setTapped] = useState<number[]>([]);
  /** The two cards of "Now you try" when there is no sister (and after a wrong tap on the sister), the right one among them. */
  const [redo, setRedo] = useState<number[] | null>(null);
  /** The sister go of "Now you try one like it.": local only, never tapped into `taps`. */
  const [sis, setSis] = useState<Go | null>(null);
  const [placed, setPlaced] = useState(0);
  const [wobble, setWobble] = useState<number | null>(null);
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

  const base: Go = goes[Math.min(at, goes.length - 1)];
  const go: Go = sis ?? base;
  const kinds = useSeenKinds(seen, onSeen);
  /** A kind that has not been seen yet gets its demo before the first go of it (never in a redo, never more than two a round). */
  const demoKind = DEMO_KINDS.includes(go.kind) && !kinds.has(go.kind) && phase === 'ask' ? (go.kind as DemoKind) : null;
  const demo = useKindDemo({ kind: demoKind, seen: kinds, mark: kinds.mark, steps: demoKind ? DEMOS[demoKind].steps : [], say });
  const demoWas = useRef(false);
  const guided = guide && at === 0;
  const guideHand = useGuidedFirstGo(guided, GUIDE_MS);
  const inRedo = flow.phase === 'redo';
  const stones = isStoneGo(go) && !inRedo;
  const { level, peek: canPeekHere } = levelFor(go.l, flow.wrong, struggle, round.help);
  // On the cards, level 3 and up draws the numbered weights; Peek (opened by the child, or by a wrong tap at level 0) brings them back.
  const peekOpen = peek || (flow.wrong >= 1 && level <= 1);
  const cardLevel = inRedo ? 3 : level >= 3 ? 3 : level === 2 ? 2 : peekOpen ? 3 : level;
  const live = level >= 5;
  const asking = phase === 'ask';
  const tilt = isStoneGo(go) ? tiltOf(go, placed) : 'rest';

  // Each new go is read aloud once.
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    // The clock starts now (a tap during the voice is still timed) and again once the question has been heard.
    let live_ = true;
    tappedYet.current = false;
    since.current = Date.now();
    setPose('sit');
    setPeek(false);
    // A kind not yet seen is shown first; its question is read when the demo is over.
    if (!(DEMO_KINDS.includes(go.kind) && !kinds.has(go.kind))) {
      say(askLine(go), () => {
        if (live_ && !tappedYet.current) since.current = Date.now();
      });
    }
    guideHand.stop();
    guideHand.start();
    return () => {
      live_ = false;
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
    since.current = Date.now();
    say(askLine(go), () => {
      if (!tappedYet.current) since.current = Date.now();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.playing]);

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
      setSis(null);
      setPlaced(0);
      return;
    }
    setPhase('done');
    later(400, () => onDone(all));
  }

  /** A tap on the sister go: never recorded. Right sends the original go's right pick and moves on; wrong says why once and marks the original's right card. */
  function pickSister(s: Go, n: number, now: number) {
    if (n === s.answer) {
      const next = [...taps, { pick: base.answer, ms: now - since.current }];
      since.current = now;
      setTaps(next);
      clearTimers();
      kinds.mark([base.kind]);
      setWhy(null);
      setPhase('right');
      setPose('cheer');
      run.current = flow.wrong > 0 ? run.current + 1 : 0;
      if (run.current >= STRUGGLE_GOES) setStruggle(true);
      say(modelLine(s));
      if (sound) playSound('badge');
      later(RIGHT_MS, () => nextGo(next));
      return;
    }
    const kind = slipOfPick(s, n) ?? 'near';
    setPose('laugh');
    if (sound) playSound('tap');
    later(LAUGH_MS, () => setPose('sit'));
    setWhy({ pick: n, kind, go: s });
    setSis(null);
    setTapped([]);
    since.current = now;
    say(whyLine(kind));
  }

  function pick(n: number) {
    if (phase !== 'ask' || look || demo.playing || tapped.includes(n)) return;
    tappedYet.current = true;
    guideHand.stop();
    const now = Date.now();
    if (sis) {
      pickSister(sis, n, now);
      return;
    }
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
        // The second wrong tap: Parrot counts both sides, then a sister go is asked (or, with none, the same go with two cards).
        setWhy(null);
        const two = redoCards(go, nowTapped);
        const sister = sisterGo(round, at, go);
        const script = lookScript(go);
        setLookBefore(script.before);
        startLook({
          anchor: 0,
          steps: script.lines.length,
          openingLine: WORDS.lookTogether,
          fillLine: script.fill,
          stepLine: (k) => script.lines[k - 1],
          stepMs: COUNT_MS,
          waitForVoice: true,
          countStartMs: LOOK_START_MS,
          endLine: script.end,
          onEnd: () => {
            setFlow((f) => stepGo(f, 'lookDone'));
            setTapped([]);
            setRedo(two);
            setSis(sister);
            since.current = Date.now();
            say(WORDS.nowTry);
          },
        });
        return;
      }
      const kind = slipOfPick(go, n) ?? 'near';
      setWhy({ pick: n, kind });
      say(whyLine(kind));
      return;
    }
    clearTimers();
    kinds.mark([go.kind]);
    setWhy(null);
    setPhase('right');
    setPose('cheer');
    if (stones) setPlaced(n);
    // Three goes in a row wrong at the first tap keep the top level for the round.
    run.current = flow.wrong > 0 ? run.current + 1 : 0;
    if (run.current >= STRUGGLE_GOES) setStruggle(true);
    say(modelLine(go));
    if (sound) playSound('badge');
    later(RIGHT_MS, () => nextGo(next));
  }

  const addStone = () => {
    if (!asking || look || placed >= MAX_STONES) return;
    setWhy(null);
    setPlaced(placed + 1);
  };
  const takeBack = () => {
    if (!asking || look || placed <= 0) return;
    setWhy(null);
    setPlaced(placed - 1);
  };
  const checkDisabled = !asking || look !== null || placed === 0 || tapped.includes(placed) || (guided && balance(go, placed) !== 0);
  const target = balance(go, placed) === 0 ? 'check' : 'heap';
  const pointing = guideHand.pointing && asking && stones;

  const made = at + (phase === 'ask' ? 0 : 1);
  const cards = inRedo && sis ? sis.choices : inRedo && redo ? redo : go.choices;
  const filled = phase === 'right' ? go.answer : null;
  const rightTilt: Tilt = go.kind === 'tf' ? leanWith(go, 0) : 'level';

  if (demo.playing && demoKind) {
    return (
      <div className="pr-play pr-scene" style={sceneStyle()}>
        <h2 className="pr-sr" tabIndex={-1} ref={heading}>{WORDS.demoTitle}</h2>
        <div className="pr-top">
          <div className="pr-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
            {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
              <span key={i} className={i < made ? 'pr-pip pr-pip--done' : 'pr-pip'} />
            ))}
          </div>
        </div>
        <DemoScene kind={demoKind} step={demo.step} friend={friend} />
        <DemoBar prefix="pr" skipLabel={WORDS.skip} canSkip={demo.canSkip} onSkip={demo.skip} />
      </div>
    );
  }

  return (
    <div className="pr-play pr-scene" style={sceneStyle()}>
      <h2 className="pr-sr" tabIndex={-1} ref={heading}>{go.kind === 'tf' ? WORDS.pickTilt : stones ? WORDS.stoneCheck : WORDS.pickCard}</h2>
      <div className="pr-top">
        <div className="pr-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
          {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
            <span key={i} className={i < made ? 'pr-pip pr-pip--done' : 'pr-pip'} />
          ))}
        </div>
        <HearAgain prefix="pr" label={WORDS.hearAgain} onHear={() => say(eqLine(go))} />
      </div>

      <div className="pr-stage" key={at}>
        <span className="pr-stage__friend" aria-hidden="true"><Friend friend={friend} pose={pose} /></span>
        {look ? null : phase === 'right' ? (
          stones ? (
            <StoneSaw go={go} placed={go.answer} tilt="level" wobble={false} />
          ) : (
            <Weights go={go} fill={filled} tilt={rightTilt} />
          )
        ) : stones ? (
          <StoneSaw go={go} placed={placed} tilt={live || why ? tilt : 'rest'} wobble={wobble !== null} />
        ) : (
          <>
            {cardLevel >= 3 && <Weights go={go} fill={null} tilt="rest" className={wobble !== null ? 'pr-saw--wobble' : ''} />}
            {cardLevel === 2 && <Weights go={go} fill={null} tilt="rest" className="pr-saw--small" />}
          </>
        )}
        {!stones && <Equation go={go} fill={filled} big={cardLevel <= 2} />}
        {phase === 'right' && stones && <Equation go={go} fill={go.answer} big={false} />}
        {!stones && asking && canPeekHere && cardLevel <= 1 && !peekOpen && (
          <button type="button" className="pr-button pr-peek" onClick={() => setPeek(true)}>
            <span aria-hidden="true">👀</span> {WORDS.peek}
          </button>
        )}
      </div>

      {why && asking && <ShowWhy prefix="pr" tapKey={taps.length} picture={<WhyPicture go={why.go ?? go} pick={why.pick} kind={why.kind} />} line={WORDS.why(why.kind)} />}
      {look && (
        <LookTogether prefix="pr" title={WORDS.lookTogether} picture={<CountingSaw go={go} filled={look.filled} before={lookBefore} />} line={lookCaption(go, look.filled, lookBefore)} skipLabel={WORDS.goOn} canSkip={look.canSkip} onSkip={skipLook} />
      )}
      {inRedo && !why && asking && <NowYouTry prefix="pr" line={WORDS.nowTry} />}

      {look ? null : stones ? (
        <div className="pr-stones" role="group" aria-label={WORDS.stonePan}>
          <button type="button" className="pr-heapbtn" onClick={addStone} disabled={!asking || look !== null || placed >= MAX_STONES} aria-label={WORDS.addStone}>
            <StoneHeap />
            <span className="pr-heapbtn__plus" aria-hidden="true">+1</span>
            {pointing && target === 'heap' && <PointingHand prefix="pr" />}
          </button>
          <button type="button" className="pr-button pr-takeback" onClick={takeBack} disabled={!asking || look !== null || placed === 0}>
            <span aria-hidden="true">↩</span> {WORDS.takeBack}
          </button>
          <button
            type="button"
            className="button button--play pr-check"
            onClick={() => pick(placed)}
            disabled={checkDisabled}
            aria-label={pointing && target === 'check' ? `${WORDS.check}, ${WORDS.guideHere}` : WORDS.check}
          >
            <span aria-hidden="true">✓</span> {WORDS.check}
            {pointing && target === 'check' && <PointingHand prefix="pr" />}
          </button>
        </div>
      ) : (
        <div className={`pr-cards${go.kind === 'tf' ? ' pr-cards--tf' : ''}`} role="group" aria-label={go.kind === 'tf' ? WORDS.pickTilt : WORDS.pickCard}>
          {cards.map((n) => {
            const off = (asking && tapped.includes(n)) || (!asking && n !== go.answer);
            const hint = inRedo && asking && !sis && n === go.answer;
            const label = go.kind === 'tf' ? [WORDS.tipsLeft, WORDS.level, WORDS.tipsRight][n] : String(n);
            return (
              <button
                key={`${at}-${n}`}
                type="button"
                disabled={asking && (look !== null || tapped.includes(n))}
                className={`pr-choice${off ? ' pr-choice--off' : ''}${wobble === n ? ' pr-choice--wobble' : ''}${hint ? ' pr-choice--hint' : ''}${!asking && n === go.answer ? ' pr-choice--right' : ''}`}
                onClick={() => pick(n)}
                aria-label={hint ? `${label}, ${WORDS.guideHere}` : label}
              >
                {go.kind === 'tf' ? (
                  <>
                    <TipGlyph dir={n === 0 ? 'left' : n === 1 ? 'level' : 'right'} />
                    <span className="pr-choice__word">{label}</span>
                  </>
                ) : (
                  <span className="pr-choice__value">{n}</span>
                )}
                {hint && <PointingHand prefix="pr" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
