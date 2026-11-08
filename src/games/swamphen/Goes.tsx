/**
 * Today's challenge at Swamp Hen's Reed Rows: ten goes in the reed garden (docs/SWAMPHEN-PLAN.md).
 *
 *  - Plant: plant the rows one at a time, then how many shoots?
 *  - Under the mat: a garden with a mat over most of it; how many shoots?
 *  - Turn: the garden turned round; which garden is it now? (a picture card, picked before it turns)
 *  - Which garden: four pictures, tap the one that is R rows of C.
 *  - Share: the child deals shoots into equal rows by tapping lanes; once the shares are fair, how many in each row?
 *  - Cut: a big garden cut in two to work out; and one row short of ten.
 *
 * Each go comes with its help level from the server: 5 every row shaded and counted along, down to 0 the sum alone. A wrong tap
 * shows why (ShowWhy), a second one is "Let's look together", then "Now you try". The answer is never shown or said before the
 * child has found it. Only the taps are sent; the server replays them.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { HearAgain } from '../../kit/HearAgain';
import { PointingHand } from '../../kit/PointingHand';
import { useGuidedFirstGo } from '../../kit/useGuidedFirstGo';
import { DemoBar } from '../../kit/DemoBar';
import { useKindDemo } from '../../kit/useKindDemo';
import { useSeenKinds } from '../../kit/useSeenKinds';
import { LookTogether, NowYouTry, ShowWhy, useLookTogether } from '../../kit/ShowWhy';
import { stepGo, NEW_GO, type GoState } from '../../../shared/kit/mistakes';
import { STRUGGLE_GOES } from '../../../shared/kit/help';
import type { Tap } from '../../../shared/swamphen/play';
import type { Friend as FriendName } from '../../../shared/swamphen/progress';
import { GOES_PER_ROUND, fairShare, pictureFor, pictureOf, showRound, viewFor, type Go, type HelpLevel, type Round } from '../../../shared/swamphen/round';
import { playSound } from '../sounds';
import { DealLanes, Friend, Garden, Pile, sceneStyle, type Pose, type Scenery } from './art';
import { SLIP_LINES, askLine, lookLine } from './voiceLines';
import { WORDS } from './words';
import { DemoPicture, demoSteps, isDemoKind } from './Demo';

const RIGHT_MS = 1900;
const WOBBLE_MS = 500;
/** The very first go: after this long without a tap the hand points at the Plant button. */
const GUIDE_MS = 2600;

type Phase = 'ask' | 'right' | 'done';

interface Props {
  /** The child's very first challenge: the hand points at the first thing to do. */
  guided?: boolean;
  round: Round;
  /** The kinds of go this child has seen, and how to remember more. */
  seenKinds: readonly string[];
  markSeen: (kinds: string[]) => Promise<unknown>;
  scenery: Scenery;
  friend: FriendName;
  sound: boolean;
  say: (text: string, onEnd?: () => void) => void;
  onDone: (taps: Tap[]) => void;
}

export function Goes({ guided = false, round, seenKinds, markSeen, scenery, friend, sound, say, onDone }: Props) {
  const goes = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [gs, setGs] = useState<GoState>(NEW_GO);
  const [tapped, setTapped] = useState<number[]>([]);
  const [lastSlip, setLastSlip] = useState<keyof typeof SLIP_LINES | null>(null);
  const [whyTap, setWhyTap] = useState(0);
  const [wobble, setWobble] = useState<number | null>(null);
  const [peek, setPeek] = useState(false);
  const [planted, setPlanted] = useState(0);
  const [turned, setTurned] = useState(false);
  const [lanes, setLanes] = useState<number[]>([]);
  const [dealt, setDealt] = useState<number[]>([]);
  const [byHand, setByHand] = useState(false);
  const [pose, setPose] = useState<Pose>('sit');
  // Three goes in a row with a wrong first tap bring the full picture back for the rest of the round (not saved).
  const [struggle, setStruggle] = useState(false);
  const run = useRef(0);
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
  const { look, start: startLook, skip } = useLookTogether(say);
  const guideHand = useGuidedFirstGo(guided && at === 0, GUIDE_MS);
  const kinds = useSeenKinds(seenKinds, markSeen);
  // Show me first: the first time a kind with a demo comes up, between goes. At most two demos a round.
  const [demoKinds, setDemoKinds] = useState<string[]>([]);

  const go: Go = goes[Math.min(at, goes.length - 1)];
  const demoFor = isDemoKind(go.kind) && !kinds.has(go.kind) && phase === 'ask' && !(guided && at === 0) && (demoKinds.includes(go.kind) || demoKinds.length < 2) ? go.kind : null;
  useEffect(() => {
    if (demoFor && !demoKinds.includes(demoFor)) setDemoKinds((d) => [...d, demoFor]);
  }, [demoFor, demoKinds]);
  const demo = useKindDemo({ kind: demoFor, seen: kinds, mark: kinds.mark, steps: demoFor ? demoSteps(demoFor) : [], say });
  const demoActive = demoFor !== null;
  const wrongs = gs.wrong;
  const pic = pictureFor(go, wrongs, tapped, struggle);
  const canPeek = go.l === 1 && round.help !== 'off' && pic.level <= 1;
  const level: HelpLevel = pic.level <= 1 && (pic.peekOpen || peek) ? 3 : pic.level;
  const seen: HelpLevel = gs.phase === 'look' || gs.phase === 'redo' ? 5 : level;
  const view = viewFor(seen);
  const plantFirst = go.kind === 'plant' && go.l >= 3;
  const needPlant = plantFirst && planted < go.rows;
  const solved = phase !== 'ask';
  const isShare = go.kind === 'share';
  const pictureCards = go.kind === 'which' || go.kind === 'turn';
  const laneCounts = lanes.length === go.rows ? lanes : Array.from({ length: go.rows }, () => 0);
  const left = go.total - laneCounts.reduce((x, y) => x + y, 0);
  const fair = isShare && left === 0 && fairShare(laneCounts);
  const needDeal = isShare && !fair;
  const lowest = Math.min(...laneCounts);
  const more = isShare && left === 0 && !fair ? laneCounts.flatMap((n, i) => (n > lowest ? [i] : [])) : [];
  const dealtCount = go.total - left;
  const aids = seen >= 4;

  // Each new go is read aloud once.
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    let live = true;
    tappedYet.current = false;
    since.current = Date.now();
    setPose('sit');
    setPeek(false);
    setPlanted(0);
    setTurned(false);
    setLanes(Array.from({ length: go.rows }, () => 0));
    setDealt([]);
    setByHand(false);
    guideHand.start();
    if (!demoActive) say(askLine(go), () => {
      if (live && !tappedYet.current) since.current = Date.now();
    });
    return () => {
      live = false;
    };
    // Read again only when the go changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, goes, demoActive]);

  // Sharing: say whether the shares are fair once the pile is out, and start each round of dealing with a hint at levels 5 and 4.
  useEffect(() => {
    if (!isShare || phase !== 'ask' || gs.phase === 'look') return;
    if (left === 0 && dealtCount > 0) say(fair ? WORDS.fair : WORDS.unfair);
    else if (aids && dealtCount > 0 && dealtCount % go.rows === 0) say(WORDS.oneEach);
    // Only when the dealing changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealtCount]);

  function deal(lane: number) {
    if (phase !== 'ask' || gs.phase === 'look' || left <= 0) return;
    tappedYet.current = true;
    const next = laneCounts.map((n, i) => (i === lane ? n + 1 : n));
    setLanes(next);
    setDealt((d) => [...d, lane]);
    if (next.every((n) => n > 0)) setByHand(true);
    if (sound) playSound('tap');
  }
  function dealRound() {
    if (left < go.rows) return;
    tappedYet.current = true;
    setLanes(laneCounts.map((n) => n + 1));
    setDealt((d) => [...d, ...Array.from({ length: go.rows }, (_, i) => i)]);
    if (sound) playSound('tap');
  }
  function takeBack() {
    const last = dealt[dealt.length - 1];
    if (last === undefined) return;
    setLanes(laneCounts.map((n, i) => (i === last ? n - 1 : n)));
    setDealt((d) => d.slice(0, -1));
  }
  function dealAgain() {
    setLanes(Array.from({ length: go.rows }, () => 0));
    setDealt([]);
    setByHand(false);
  }

  function nextGo(all: Tap[]) {
    clearTimers();
    if (at + 1 < goes.length) {
      setAt(at + 1);
      setPhase('ask');
      setGs(NEW_GO);
      setTapped([]);
      setLastSlip(null);
      return;
    }
    setPhase('done');
    later(400, () => onDone(all));
  }

  function plantRow() {
    guideHand.stop();
    tappedYet.current = true;
    setPlanted((n) => Math.min(go.rows, n + 1));
    if (sound) playSound('tap');
  }

  function pick(value: number) {
    if (phase !== 'ask' || gs.phase === 'look' || needPlant || needDeal || demoActive) return;
    tappedYet.current = true;
    guideHand.stop();
    const now = Date.now();
    const next = [...taps, { pick: value, ms: now - since.current }];
    since.current = now;
    setTaps(next);
    if (value !== go.answer) {
      const state = stepGo(gs, 'wrong');
      setGs(state);
      setTapped((t) => [...t, value]);
      setWobble(value);
      setWhyTap((n) => n + 1);
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => setWobble(null));
      const slip = go.wrongs.find((w) => w.n === value)?.kind ?? 'near';
      setLastSlip(slip);
      if (state.phase === 'look') {
        if (go.kind === 'turn') setTurned(true);
        startLook({ anchor: at, steps: isShare ? go.cols : 3, openingLine: WORDS.lookTitle, fillLine: lookLine(go.kind), onEnd: () => setGs((s) => stepGo(s, 'lookDone')) });
      } else say(SLIP_LINES[slip]);
      return;
    }
    clearTimers();
    kinds.mark([go.kind]);
    run.current = gs.wrong > 0 ? run.current + 1 : 0;
    if (run.current >= STRUGGLE_GOES) setStruggle(true);
    setGs(stepGo(gs, 'right'));
    setPhase('right');
    setPose('eat');
    if (go.kind === 'turn') setTurned(true);
    say(WORDS.right[at % WORDS.right.length]);
    if (sound) playSound('badge');
    later(RIGHT_MS, () => nextGo(next));
  }

  const made = at + (phase === 'ask' ? 0 : 1);
  const rows = turned ? go.cols : go.rows;
  const cols = turned ? go.rows : go.cols;
  const gardenLabel = WORDS.garden(rows, cols);
  
  function picture() {
    if (go.kind === 'which') return null;
    if (isShare) {
      return (
        <div className="sh-share">
          <DealLanes
            counts={laneCounts}
            glow={aids && left > 0 && phase === 'ask' ? dealtCount % go.rows : null}
            more={more}
            fair={fair}
            still={phase !== 'ask' || gs.phase === 'look'}
            onDeal={deal}
            laneLabel={WORDS.lane}
          />
          {left > 0 && <Pile n={left} label={WORDS.pile(left)} />}
        </div>
      );
    }
    return (
      <Garden
        rows={go.kind === 'short' ? go.rows : rows}
        cols={cols}
        view={view}
        planted={plantFirst ? planted : undefined}
        mat={go.kind === 'mat'}
        cutAt={go.kind === 'cut' ? 5 : undefined}
        short={go.kind === 'short'}
        label={gardenLabel}
      />
    );
  }

  function lookPicture() {
    if (isShare) {
      const each = look?.filled ?? 0;
      return (
        <div className="sh-share">
          <DealLanes counts={Array.from({ length: go.rows }, () => each)} still laneLabel={WORDS.lane} />
          {go.total - each * go.rows > 0 && <Pile n={go.total - each * go.rows} label="" />}
        </div>
      );
    }
    if (go.kind === 'turn') return <Garden rows={go.cols} cols={go.rows} view="rows" small label="" />;
    return <span className="sh-why__icon" aria-hidden="true">👀</span>;
  }

  const cards = phase === 'ask' ? pic.choices : go.choices;
  const heard = (n: number) => (pictureCards ? '' : String(n));

  return (
    <div className={`sh-play sh-scene--${scenery}`} style={sceneStyle(scenery)}>
      <h2 className="sh-sr" tabIndex={-1} ref={heading}>{go.kind === 'which' ? WORDS.pickGarden : go.kind === 'turn' ? WORDS.pickTurned : WORDS.pickCard}</h2>
      <div className="sh-top">
        <div className="sh-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
          {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
            <span key={i} className={i < made ? 'sh-pip sh-pip--done' : 'sh-pip'} />
          ))}
        </div>
        <HearAgain prefix="sh" label={WORDS.hearAgain} onHear={() => say(askLine(go))} />
      </div>

      <div className="sh-stage" key={at}>
        <span className="sh-stage__friend" aria-hidden="true"><Friend friend={friend} pose={pose} /></span>
        {demoFor ? (
          <>
            <p className="sh-ask" aria-live="polite">{WORDS.demo[demoFor][Math.min(demo.step, 2)]}</p>
            <div className="sh-field"><DemoPicture kind={demoFor} step={demo.step} /></div>
            <DemoBar prefix="sh" skipLabel={WORDS.skip} canSkip={demo.canSkip} onSkip={demo.skip} />
          </>
        ) : (<>
        <p className="sh-ask" aria-live="polite">{askLine(go)}</p>
        {isShare && needDeal && phase === 'ask' && <p className="sh-hint">{WORDS.dealIt}</p>}
        {go.kind !== 'which' && <div className={`sh-field${go.kind === 'turn' && turned ? ' sh-field--turned' : ''}`}>{picture()}</div>}
        <div className="sh-tools">
          {guideHand.pointing && plantFirst && planted === 0 && <PointingHand prefix="sh" />}
          {plantFirst && planted < go.rows && phase === 'ask' && (
            <button type="button" className="sh-button sh-tool" onClick={plantRow}>
              <span aria-hidden="true">🌱</span> {WORDS.plantRow}
            </button>
          )}
          {isShare && phase === 'ask' && gs.phase !== 'look' && (
            <>
              {dealt.length > 0 && (
                <button type="button" className="sh-button sh-tool" onClick={takeBack}>
                  <span aria-hidden="true">↩</span> {WORDS.takeBack}
                </button>
              )}
              {byHand && left >= go.rows && (
                <button type="button" className="sh-button sh-tool" onClick={dealRound}>
                  <span aria-hidden="true">🌱</span> {WORDS.dealRound}
                </button>
              )}
              {left === 0 && !fair && (
                <button type="button" className="sh-button sh-tool" onClick={dealAgain}>
                  <span aria-hidden="true">🔁</span> {WORDS.dealAgain}
                </button>
              )}
            </>
          )}
          {go.kind === 'turn' && phase === 'ask' && level >= 4 && (
            <button type="button" className="sh-button sh-tool" onClick={() => setTurned((t) => !t)}>
              <span aria-hidden="true">🔄</span> {turned ? WORDS.turnBack : WORDS.turnIt}
            </button>
          )}
          {canPeek && !peek && phase === 'ask' && (
            <button type="button" className="sh-button sh-tool" onClick={() => setPeek(true)}>
              <span aria-hidden="true">🍃</span> {WORDS.peek}
            </button>
          )}
        </div>
        </>)}
      </div>

      {gs.phase === 'why' && lastSlip && (
        <ShowWhy prefix="sh" tapKey={whyTap} picture={<span className="sh-why__icon" aria-hidden="true">🤔</span>} line={SLIP_LINES[lastSlip]} />
      )}
      {gs.phase === 'look' && look && (
        <LookTogether prefix="sh" title={WORDS.lookTitle} picture={lookPicture()} line={lookLine(go.kind)} skipLabel={WORDS.skip} canSkip={look.canSkip} onSkip={skip} />
      )}
      {gs.phase === 'redo' && <NowYouTry prefix="sh" line={WORDS.nowYouTry} />}

      <div hidden={demoActive} className={`sh-cards sh-cards--${go.kind}`} role="group" aria-label={go.kind === 'which' ? WORDS.pickGarden : go.kind === 'turn' ? WORDS.pickTurned : WORDS.pickCard}>
        {cards.map((n) => {
          const cls = `sh-choice${wobble === n ? ' sh-choice--wobble' : ''}${solved && n === go.answer ? ' sh-choice--right' : ''}${solved && n !== go.answer ? ' sh-choice--off' : ''}`;
          const p = pictureCards ? pictureOf(n) : null;
          return (
            <button
              key={`${at}-${n}`}
              type="button"
              disabled={gs.phase === 'look' || needPlant || needDeal || demoActive}
              className={cls}
              onClick={() => pick(n)}
              aria-label={p ? (p.rows ? WORDS.garden(p.rows, p.cols) : WORDS.pile(p.cols)) : heard(n)}
            >
              {p ? (p.rows ? <Garden rows={p.rows} cols={p.cols} view="rows" small label="" /> : <Pile n={p.cols} label="" />) : n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
