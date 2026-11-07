/**
 * Today's challenge at Swamp Hen's Reed Rows: ten goes in the reed garden (docs/SWAMPHEN-PLAN.md).
 *
 *  - Plant: plant the rows one at a time, then how many shoots?
 *  - Under the mat: a garden with a mat over most of it; how many shoots?
 *  - Turn: the garden turned round; how many shoots?
 *  - Which garden: four pictures, tap the one that is R rows of C.
 *  - Share: shoots dealt into equal rows; how many in each row?
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
import { LookTogether, NowYouTry, ShowWhy, useLookTogether } from '../../kit/ShowWhy';
import { stepGo, NEW_GO, type GoState } from '../../../shared/kit/mistakes';
import type { Tap } from '../../../shared/swamphen/play';
import type { Friend as FriendName } from '../../../shared/swamphen/progress';
import { GOES_PER_ROUND, pictureFor, pictureOf, showRound, viewFor, type Go, type HelpLevel, type Round } from '../../../shared/swamphen/round';
import { playSound } from '../sounds';
import { Friend, Garden, Lanes, Pile, sceneStyle, type Pose, type Scenery } from './art';
import { SLIP_LINES, askLine, lookLine } from './voiceLines';
import { WORDS } from './words';

const RIGHT_MS = 1900;
const WOBBLE_MS = 500;
/** The very first go: after this long without a tap the hand points at the Plant button. */
const GUIDE_MS = 2600;

type Phase = 'ask' | 'right' | 'done';

interface Props {
  /** The child's very first challenge: the hand points at the first thing to do. */
  guided?: boolean;
  round: Round;
  scenery: Scenery;
  friend: FriendName;
  sound: boolean;
  say: (text: string, onEnd?: () => void) => void;
  onDone: (taps: Tap[]) => void;
}

export function Goes({ guided = false, round, scenery, friend, sound, say, onDone }: Props) {
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
  const { look, start: startLook, skip } = useLookTogether(say);
  const guideHand = useGuidedFirstGo(guided && at === 0, GUIDE_MS);

  const go: Go = goes[Math.min(at, goes.length - 1)];
  const wrongs = gs.wrong;
  const pic = pictureFor(go, wrongs, tapped);
  const canPeek = go.l === 1 && round.help !== 'off' && pic.level <= 1;
  const level: HelpLevel = pic.level <= 1 && (pic.peekOpen || peek) ? 3 : pic.level;
  const seen: HelpLevel = gs.phase === 'look' || gs.phase === 'redo' ? 5 : level;
  const view = viewFor(seen);
  const plantFirst = go.kind === 'plant' && go.l >= 3;
  const needPlant = plantFirst && planted < go.rows;
  const solved = phase !== 'ask';

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
    guideHand.start();
    say(askLine(go), () => {
      if (live && !tappedYet.current) since.current = Date.now();
    });
    return () => {
      live = false;
    };
    // Read again only when the go changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, goes]);

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
    if (phase !== 'ask' || gs.phase === 'look' || needPlant) return;
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
        startLook({ anchor: at, steps: 3, openingLine: WORDS.lookTitle, fillLine: lookLine(go.kind), onEnd: () => setGs((s) => stepGo(s, 'lookDone')) });
      } else say(SLIP_LINES[slip]);
      return;
    }
    clearTimers();
    setGs(stepGo(gs, 'right'));
    setPhase('right');
    setPose('eat');
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
    if (go.kind === 'share') {
      const hidden = view === 'plain' || view === 'peek';
      return (
        <div className="sh-share">
          {!hidden && <Lanes rows={go.rows} label={`${go.rows} empty rows`} />}
          {view !== 'edges' && !hidden && <Pile n={go.total} label={WORDS.pile(go.total)} />}
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

  const cards = phase === 'ask' ? pic.choices : go.choices;
  const heard = (n: number) => (go.kind === 'which' ? '' : String(n));

  return (
    <div className={`sh-play sh-scene--${scenery}`} style={sceneStyle(scenery)}>
      <h2 className="sh-sr" tabIndex={-1} ref={heading}>{go.kind === 'which' ? WORDS.pickGarden : WORDS.pickCard}</h2>
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
        <p className="sh-ask" aria-live="polite">{askLine(go)}</p>
        {go.kind !== 'which' && <div className="sh-field">{picture()}</div>}
        <div className="sh-tools">
          {guideHand.pointing && plantFirst && planted === 0 && <PointingHand prefix="sh" />}
          {plantFirst && planted < go.rows && phase === 'ask' && (
            <button type="button" className="sh-button sh-tool" onClick={plantRow}>
              <span aria-hidden="true">🌱</span> {WORDS.plantRow}
            </button>
          )}
          {go.kind === 'turn' && phase === 'ask' && (
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
      </div>

      {gs.phase === 'why' && lastSlip && (
        <ShowWhy prefix="sh" tapKey={whyTap} picture={<span className="sh-why__icon" aria-hidden="true">🤔</span>} line={SLIP_LINES[lastSlip]} />
      )}
      {gs.phase === 'look' && look && (
        <LookTogether prefix="sh" title={WORDS.lookTitle} picture={<span className="sh-why__icon" aria-hidden="true">👀</span>} line={lookLine(go.kind)} skipLabel={WORDS.skip} canSkip={look.canSkip} onSkip={skip} />
      )}
      {gs.phase === 'redo' && <NowYouTry prefix="sh" line={WORDS.nowYouTry} />}

      <div className={`sh-cards sh-cards--${go.kind}`} role="group" aria-label={go.kind === 'which' ? WORDS.pickGarden : WORDS.pickCard}>
        {cards.map((n) => {
          const cls = `sh-choice${wobble === n ? ' sh-choice--wobble' : ''}${solved && n === go.answer ? ' sh-choice--right' : ''}${solved && n !== go.answer ? ' sh-choice--off' : ''}`;
          const p = go.kind === 'which' ? pictureOf(n) : null;
          return (
            <button
              key={`${at}-${n}`}
              type="button"
              disabled={gs.phase === 'look' || needPlant}
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
