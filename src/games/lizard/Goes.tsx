/**
 * Today's challenge at Lizard's Bundles: ten goes with sticks tied into bundles of ten (docs/LIZARD-PLAN.md).
 *
 *  - Build: make a number on the mat with sticks, bundles (and rafts), then "That's it".
 *  - Bundle: tie loose sticks into bundles of ten, then "That's it".
 *  - Swap: untie one bundle into ten sticks, then "That's it".
 *  - Read and more: four number cards, the question said in tens and ones.
 *
 * Each go comes with its help level from the server: 5 is a labelled mat with a count under each place, down to 0 numbers only
 * (a Peek brings the bundles back). A wrong try shows why (ShowWhy), a second one is "Let's look together" (LookTogether, the
 * mat labelled with every count), then "Now you try". The answer is never shown or said before the child has found it. Only the
 * tries are sent; the server replays them.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { TenFrame } from '../../kit';
import { FirstTimeTip } from '../../kit/FirstTimeTip';
import { HearAgain } from '../../kit/HearAgain';
import { PointingHand } from '../../kit/PointingHand';
import { useGuidedFirstGo } from '../../kit/useGuidedFirstGo';
import { LookTogether, NowYouTry, ShowWhy, useLookTogether } from '../../kit/ShowWhy';
import { stepGo, NEW_GO, LOOK_AT, type GoState } from '../../../shared/kit/mistakes';
import { MAX_ONES } from '../../../shared/lizard/config';
import { tapRight, type Tap } from '../../../shared/lizard/play';
import type { Friend as FriendName } from '../../../shared/lizard/progress';
import { GOES_PER_ROUND, matOf, matValue, pictureFor, showRound, type Go, type Mat, type Round } from '../../../shared/lizard/round';
import { playSound } from '../sounds';
import { Bundle, Friend, Raft, Stick, sceneStyle, type Pose, type Scenery } from './art';
import { WHY_LINES, askLine, lookLine, placesWords, tryLine, type LineKey } from './voiceLines';
import { WORDS } from './words';

const RIGHT_MS = 1900;
const WOBBLE_MS = 500;
/** After a wrong try "That's it" waits this long unless the child changes the mat. */
const THINK_MS = 2000;
const GUIDE_MS = 2600;
const MAX_TENS = 19;
const MAX_HUNDREDS = 9;
const RAFT_TIP_KEY = 'lizard-raft-tip';

type Phase = 'ask' | 'right' | 'done';
type Place = 'h' | 't' | 'o';

interface Props {
  /** The child's very first challenge: the hand points at the stick button on the first go if nothing is tapped. */
  guided?: boolean;
  round: Round;
  scenery: Scenery;
  friend: FriendName;
  sound: boolean;
  say: (text: string, onEnd?: () => void) => void;
  onDone: (taps: Tap[]) => void;
}

const matsAlike = (a: Mat, b: Mat) => a.h === b.h && a.t === b.t && a.o === b.o;

/** What a build, tie or untie go sends: the number built, or bundles x 100 + sticks. */
const pickOf = (go: Go, mat: Mat): number => (go.kind === 'build' ? matValue(mat) : mat.t * 100 + mat.o);

/** The mat a "Let's look together" shows: what the answer is made of, or the picture the question is about. */
function targetMat(go: Go): Mat {
  if (go.kind === 'bundle' || go.kind === 'swap') return { h: 0, t: Math.floor(go.answer / 100), o: go.answer % 100 };
  return matOf(go.kind === 'more' ? go.n : go.answer);
}

const spoken = (mat: Mat, places: 2 | 3): string => placesWords(places === 3 ? matValue(mat) : mat.t * 10 + mat.o);

interface MatProps {
  mat: Mat;
  places: 2 | 3;
  labels: boolean;
  counts: boolean;
  colours: boolean;
  /** The ones as a ten-frame (the labelled levels). */
  frame: boolean;
  label: string;
  /** Plus and minus buttons per place (a build go). */
  /** The small picture in a wrong-try panel. */
  small?: boolean;
  edit?: { add: (p: Place) => void; take: (p: Place) => void; hand?: Place | null; withBundles: boolean; withRafts: boolean; addTen?: () => void; tenOff?: boolean };
}

/** Steps 1 to 3 make the child tie each bundle: no "+ bundle" until step 4 (and never on the guided first go). */
export const TIE_STEPS = 3;
export const showBundleButtons = (step: number, firstGuidedGo: boolean) => step > TIE_STEPS && !firstGuidedGo;

function Ones({ o, frame, colours }: { o: number; frame: boolean; colours: boolean }) {
  if (frame) {
    const first = Math.min(o, 10);
    const rest = Math.max(0, o - 10);
    return (
      <span className="lz-frames">
        <TenFrame squares={Array.from({ length: first }, () => 'filled' as const)} label={`${first} sticks in a ten-frame`} className="lz-frame" colors={{ counter: '#c8903a', frame: '#6b4a1a' }} />
        {rest > 0 && <TenFrame squares={Array.from({ length: rest }, () => 'extra' as const)} label={`${rest} more sticks`} className="lz-frame" colors={{ counter: '#c8903a', extra: '#d4572f', frame: '#6b4a1a' }} />}
      </span>
    );
  }
  return <>{Array.from({ length: o }, (_, i) => <Stick key={i} tone={colours ? 'plain' : 'gone'} />)}</>;
}

function MatView({ mat, places, labels, counts, colours, frame, label, edit, small }: MatProps) {
  const cols: { p: Place; name: string; n: number }[] = [
    ...(places === 3 ? [{ p: 'h' as const, name: WORDS.hundreds, n: mat.h }] : []),
    { p: 't', name: WORDS.tens, n: mat.t },
    { p: 'o', name: WORDS.ones, n: mat.o },
  ];
  const piece = (p: Place, i: number) => (p === 'h' ? <Raft key={i} tone={colours ? 'plain' : 'gone'} /> : <Bundle key={i} tone={colours ? 'plain' : 'gone'} />);
  return (
    <div className={`lz-mat lz-mat--${places}${small ? ' lz-mat--small' : ''}${colours ? '' : ' lz-mat--plain'}`} role="img" aria-label={label}>
      {cols.map(({ p, name, n }) => (
        <div key={p} className={`lz-place lz-place--${p}`}>
          {labels && <span className="lz-place__name">{name}</span>}
          <div className="lz-place__pieces">
            {p === 'o' ? <Ones o={n} frame={frame && labels} colours={colours} /> : Array.from({ length: n }, (_, i) => piece(p, i))}
          </div>
          {counts && <span className="lz-place__count">{n}</span>}
          {edit && (p === 'h' || p === 't' ? (p === 'h' ? edit.withRafts : edit.withBundles) : true) && (
            <span className="lz-place__btns">
              <button type="button" className="lz-step" onClick={() => edit.take(p)} aria-label={p === 'h' ? WORDS.takeRaft : p === 't' ? WORDS.takeBundle : WORDS.takeStick}>−</button>
              <button type="button" className="lz-step lz-step--add" onClick={() => edit.add(p)} aria-label={p === 'h' ? WORDS.addRaft : p === 't' ? WORDS.addBundle : WORDS.addStick}>
                +{edit.hand === p && <PointingHand prefix="lz" />}
              </button>
              {p === 'o' && edit.addTen && (
                <button type="button" className="lz-step lz-step--add lz-step--ten" disabled={edit.tenOff} onClick={edit.addTen} aria-label={WORDS.addTenSticksLabel}>{WORDS.addTenSticks}</button>
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** The child's own bundles and sticks (or the card they picked), small, with the number we need beside it. */
function TryPicture({ mat, places, need, picked }: { mat: Mat; places: 2 | 3; need: number | null; picked?: number }) {
  const label = picked !== undefined ? `You picked ${picked}: ${spoken(mat, places)}.` : `${WORDS.yourMat}: ${spoken(mat, places)}.`;
  return (
    <div className="lz-try">
      <MatView mat={mat} places={places} labels counts colours frame={false} label={label} small />
      {need !== null && (
        <span className="lz-need">
          {WORDS.weNeed}
          <b>{need}</b>
        </span>
      )}
    </div>
  );
}

/** Does this go have a raft in it? A Bundle or Swap go's answer is bundles x 100 + sticks, so only its starting number counts. */
export const hasRaft = (go: Pick<Go, 'kind' | 'n' | 'answer'>): boolean =>
  go.kind === 'bundle' || go.kind === 'swap' ? go.n >= 100 : go.n >= 100 || go.answer >= 100;

export function Goes({ guided = false, round, scenery, friend, sound, say, onDone }: Props) {
  const goes = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [gs, setGs] = useState<GoState>(NEW_GO);
  const [tapped, setTapped] = useState<number[]>([]);
  const [whyTap, setWhyTap] = useState(0);
  const [wobble, setWobble] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [peek, setPeek] = useState(false);
  const [pose, setPose] = useState<Pose>('sit');
  const [mat, setMat] = useState<Mat>(goes[0].from);
  const [tip, setTip] = useState(false);
  /** The mat last sent wrong (it cannot be sent twice), and what the panel shows about the last wrong try. */
  const [lastTried, setLastTried] = useState<Mat | null>(null);
  const [shown, setShown] = useState<{ mat: Mat; line: string; picked?: number } | null>(null);
  const [held, setHeld] = useState(false);
  const since = useRef(Date.now());
  /** Set by the first move on this question, so the end of its read-aloud no longer restarts the clock. */
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
  const cardGo = go.choices.length > 0;
  const wrongs = gs.wrong;
  const pic = pictureFor(go, wrongs, tapped);
  const canPeek = cardGo && go.l === 1 && round.help !== 'off' && pic.level <= 1;
  const seeing = gs.phase === 'look' || gs.phase === 'redo';
  const pictured = cardGo ? pic.pictured || peek || seeing : true;
  const labels = seeing || (cardGo ? pic.labels : pic.level >= 2);
  const counts = seeing || pic.counts;
  const colours = seeing || pic.colours || (!cardGo && pic.level >= 2);
  const places: 2 | 3 = Math.max(go.n, go.answer >= 100 && go.kind !== 'bundle' && go.kind !== 'swap' ? go.answer : 0) >= 100 ? 3 : 2;
  const solved = phase !== 'ask';

  // Each new go is read aloud once.
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    let live = true;
    tappedYet.current = false;
    since.current = Date.now();
    setPose('sit');
    setPeek(false);
    setMat(go.from);
    guideHand.start();
    say(askLine(go), () => {
      if (live && !tappedYet.current) since.current = Date.now();
    });
    // The first go with a raft in it brings Lizard's tip, once on this device.
    if (hasRaft(go)) {
      let seen = false;
      try {
        seen = localStorage.getItem(RAFT_TIP_KEY) === 'seen';
      } catch {
        // Storage blocked: the tip just shows once a visit.
      }
      if (!seen) setTip(true);
    }
    return () => {
      live = false;
    };
    // Read again only when the go changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, goes]);

  function closeTip() {
    setTip(false);
    try {
      localStorage.setItem(RAFT_TIP_KEY, 'seen');
    } catch {
      // Not remembered.
    }
  }
  useEffect(() => {
    if (tip) say(WORDS.raftTip);
  }, [tip, say]);

  function nextGo(all: Tap[]) {
    clearTimers();
    if (at + 1 < goes.length) {
      setAt(at + 1);
      setPhase('ask');
      setGs(NEW_GO);
      setTapped([]);
      setLastTried(null);
      setShown(null);
      setHeld(false);
      return;
    }
    setPhase('done');
    later(400, () => onDone(all));
  }

  function pick(value: number, line: (value: number) => LineKey) {
    if (phase !== 'ask' || gs.phase === 'look') return;
    tappedYet.current = true;
    guideHand.stop();
    const now = Date.now();
    const next = [...taps, { pick: value, ms: now - since.current }];
    since.current = now;
    setTaps(next);
    if (!tapRight(go, value)) {
      const state = stepGo(gs, 'wrong');
      setGs(state);
      setTapped((t) => [...t, value]);
      setWobble(value);
      setShake(true);
      setWhyTap((n) => n + 1);
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => {
        setWobble(null);
        setShake(false);
      });
      const key = line(value);
      setShown({ mat: cardGo ? matOf(value) : mat, line: tryLine(go, mat, key, value), picked: cardGo ? value : undefined });
      if (!cardGo) {
        setLastTried(mat);
        setHeld(true);
        later(THINK_MS, () => setHeld(false));
      }
      if (state.phase === 'look') {
        startLook({ anchor: at, steps: 3, openingLine: WORDS.lookTitle, fillLine: lookLine(go), onEnd: () => {
            setGs((s) => stepGo(s, 'lookDone'));
            if (!cardGo) setMat(go.from);
            setLastTried(null);
            setShown(null);
          },
        });
      } else say(cardGo || key === 'tie' ? WHY_LINES[key] : WORDS.lookAtYours);
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

  const pickCard = (n: number) => pick(n, (v) => go.wrongs.find((w) => w.n === v)?.kind ?? 'near');
  const submitMat = () => pick(pickOf(go, mat), () => (go.kind === 'build' && mat.o >= 10 ? 'tie' : (go.kind as 'build' | 'bundle' | 'swap')));

  // ----- the mat's buttons
  const changeMat = (f: (m: Mat) => Mat) => {
    if (solved || gs.phase === 'look') return;
    tappedYet.current = true;
    guideHand.stop();
    setHeld(false);
    setMat(f);
  };
  const add = (p: Place) => changeMat((m) => (p === 'o' ? { ...m, o: Math.min(MAX_ONES, m.o + 1) } : p === 't' ? { ...m, t: Math.min(MAX_TENS, m.t + 1) } : { ...m, h: Math.min(MAX_HUNDREDS, m.h + 1) }));
  const take = (p: Place) => changeMat((m) => (p === 'o' ? { ...m, o: Math.max(0, m.o - 1) } : p === 't' ? { ...m, t: Math.max(0, m.t - 1) } : { ...m, h: Math.max(0, m.h - 1) }));
  const addTen = () => changeMat((m) => (m.o > MAX_ONES - 10 ? m : { ...m, o: m.o + 10 }));
  const tieTen = () => changeMat((m) => (m.o >= 10 ? { ...m, o: m.o - 10, t: m.t + 1 } : m));
  const tieRaft = () => changeMat((m) => (m.t >= 10 ? { ...m, t: m.t - 10, h: m.h + 1 } : m));
  const untieOne = () => changeMat((m) => (m.t >= 1 ? { ...m, t: m.t - 1, o: m.o + 10 } : m));

  const made = at + (phase === 'ask' ? 0 : 1);
  const target = targetMat(go);
  const showMat = cardGo ? pictured : true;
  const editing = go.kind === 'build';
  const inRedoTry = gs.phase === 'redo' && gs.wrong > LOOK_AT;
  const wrongPlace: Place | null = !editing || !inRedoTry || !shown ? null : places === 3 && mat.h !== targetMat(go).h ? 'h' : mat.t !== targetMat(go).t ? 't' : 'o';
  const handAt: Place | null = guideHand.pointing && editing ? 'o' : wrongPlace;
  const withRafts = places === 3;
  const matLabel = cardGo ? `The bundles and sticks: ${spoken(matOf(go.n), places)}.` : `Your mat: ${spoken(mat, places)}.`;
  const canTieTen = mat.o >= 10;
  const firstGuided = guided && at === 0;
  const tying = editing && !showBundleButtons(round.step, firstGuided);
  const nudged = useRef(false);
  useEffect(() => {
    nudged.current = false;
  }, [at, goes]);
  // On the tying steps, say once per go that ten sticks can be tied.
  useEffect(() => {
    if (tying && !solved && tappedYet.current && mat.o >= 10 && !nudged.current) {
      nudged.current = true;
      say(WORDS.tieNudge);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mat.o]);
  const sendable = !solved && gs.phase !== 'look' && !held && !matsAlike(mat, go.from) && !(lastTried && matsAlike(mat, lastTried));

  return (
    <div className={`lz-play lz-scene--${scenery}`} style={sceneStyle(scenery)}>
      <h2 className="lz-sr" tabIndex={-1} ref={heading}>{cardGo ? WORDS.pickCard : WORDS.makeMat}</h2>
      <div className="lz-top">
        <div className="lz-progress" aria-label={WORDS.goesDone(made, GOES_PER_ROUND)}>
          {Array.from({ length: GOES_PER_ROUND }, (_, i) => (
            <span key={i} className={i < made ? 'lz-pip lz-pip--done' : 'lz-pip'} />
          ))}
        </div>
        <HearAgain prefix="lz" label={WORDS.hearAgain} onHear={() => say(askLine(go))} />
      </div>

      {tip && (
        <FirstTimeTip
          prefix="lz"
          who={WORDS.tipWho}
          face={<span className="lz-tip__face"><Friend friend={friend} pose="sit" /></span>}
          say={WORDS.raftTip}
          n={0}
          of={1}
          inline
          nextLabel="Next"
          lastLabel={WORDS.gotIt}
          closeLabel={WORDS.closeTip}
          onNext={closeTip}
          onClose={closeTip}
        />
      )}

      <div className="lz-stage" key={at}>
        <span className="lz-stage__friend" aria-hidden="true"><Friend friend={friend} pose={pose} /></span>
        <p className="lz-ask" aria-live="polite">{askLine(go)}</p>
        <div className={`lz-board${shake ? ' lz-board--shake' : ''}`}>
          {showMat && (
            <MatView
              mat={cardGo ? matOf(go.n) : mat}
              places={places}
              labels={labels}
              counts={counts && (!cardGo || go.kind === 'more' || pic.counts || seeing)}
              colours={colours}
              frame={labels && !cardGo}
              label={matLabel}
              edit={editing && !solved ? { add, take, hand: handAt, withBundles: showBundleButtons(round.step, firstGuided), withRafts, addTen: tying && !firstGuided ? addTen : undefined, tenOff: mat.o > MAX_ONES - 10 } : undefined}
            />
          )}
          {!showMat && <p className="lz-nopic">{WORDS.peek}?</p>}
          {!cardGo && !solved && (
            <div className="lz-actions">
              {editing && (
                <>
                  <button type="button" className={`lz-btn lz-btn--tie${canTieTen ? ' lz-btn--lit' : ''}`} disabled={!canTieTen} onClick={tieTen}>{WORDS.tieTen}</button>
                  {withRafts && <button type="button" className={`lz-btn lz-btn--tie${mat.t >= 10 ? ' lz-btn--lit' : ''}`} disabled={mat.t < 10} onClick={tieRaft}>{WORDS.tieRaft}</button>}
                </>
              )}
              {go.kind === 'bundle' && <button type="button" className={`lz-btn lz-btn--tie${canTieTen ? ' lz-btn--lit' : ''}`} disabled={!canTieTen} onClick={tieTen}>{WORDS.tieTen}</button>}
              {go.kind === 'swap' && <button type="button" className="lz-btn lz-btn--tie lz-btn--lit" disabled={mat.t < 1} onClick={untieOne}>{WORDS.untieOne}</button>}
              <button type="button" className="lz-btn lz-btn--go" disabled={!sendable} onClick={submitMat}>{WORDS.thatsIt}</button>
            </div>
          )}
        </div>
        {canPeek && !peek && phase === 'ask' && (
          <button type="button" className="lz-button lz-peek" onClick={() => setPeek(true)}>
            <span aria-hidden="true">🪵</span> {WORDS.peek}
          </button>
        )}
      </div>

      {(gs.phase === 'why' || inRedoTry) && shown && (
        <ShowWhy
          prefix="lz"
          tapKey={whyTap}
          picture={<TryPicture mat={shown.mat} places={places} need={go.kind === 'build' ? go.n : null} picked={shown.picked} />}
          line={shown.line}
        />
      )}
      {gs.phase === 'look' && look && (
        <LookTogether
          prefix="lz"
          title={WORDS.lookTitle}
          picture={<MatView mat={target} places={places} labels counts colours frame={false} label={`The model: ${spoken(target, places)}.`} />}
          line={lookLine(go)}
          skipLabel={WORDS.skip}
          canSkip={look.canSkip}
          onSkip={skip}
        />
      )}
      {gs.phase === 'redo' && !inRedoTry && <NowYouTry prefix="lz" line={WORDS.nowYouTry} />}

      {cardGo && (
        <div className="lz-cards" role="group" aria-label={WORDS.pickCard}>
          {(phase === 'ask' ? pic.choices : go.choices).map((n) => (
            <button
              key={`${at}-${n}`}
              type="button"
              disabled={gs.phase === 'look'}
              className={`lz-choice${wobble === n ? ' lz-choice--wobble' : ''}${solved && n === go.answer ? ' lz-choice--right' : ''}${solved && n !== go.answer ? ' lz-choice--off' : ''}`}
              onClick={() => pickCard(n)}
              aria-label={String(n)}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
