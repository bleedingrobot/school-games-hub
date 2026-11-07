/**
 * Swamp Hen’s Reed Rows (docs/SWAMPHEN-PLAN.md): each day, ten goes with equal rows of shoots, then the times tables. Each day's first
 * finish turns one reed row (mud, then bronze, silver, gold); thirty days win the Golden Reed Garden, and a new friend plants a
 * new garden. The screens only show what the backend says. Copied from Pigeon's Number Line (a model, not a dependency).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { FirstTimeTip } from '../../kit/FirstTimeTip';
import { WhatsNext } from '../../kit/WhatsNext';
import { NextPartChip } from '../../components/NextPartChip';
import { ROWS } from '../../../shared/swamphen/progress';
import type { Tap } from '../../../shared/swamphen/play';
import { DAYS_PER_GARDEN, FRIEND_NAMES, gardenAfter, type Friend as FriendName, type Metal } from '../../../shared/swamphen/progress';
import type { Round } from '../../../shared/swamphen/round';
import { useSound } from '../../sound';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { playSound } from '../sounds';
import { ReedRow, Friend, GoldenGarden, type Pose, type Scenery } from './art';
import { SwamphenError, type SwamphenBackend, type SwamphenFinish, type SwamphenState } from './backend';
import { Goes } from './Goes';
import { finishLine, homeLine, VOICE_FOLDER } from './voiceLines';
import { WORDS } from './words';
import './swamphen.css';

/** This game talks unless it's turned off: many of its players read slowly. Remembered on this device. */
const VOICE_KEY = 'swamphen-voice';
const TIP_KEY = 'swamphen-tip-seen';
function readTipSeen(): boolean {
  try {
    return localStorage.getItem(TIP_KEY) === 'yes';
  } catch {
    return false;
  }
}
function useVoice() {
  const [on, setOnState] = useState(() => {
    try {
      return localStorage.getItem(VOICE_KEY) !== 'off';
    } catch {
      return true;
    }
  });
  const setOn = (value: boolean) => {
    setOnState(value);
    if (!value) stopSpeaking();
    try {
      localStorage.setItem(VOICE_KEY, value ? 'on' : 'off');
    } catch {
      // Storage blocked: it just won't be remembered.
    }
  };
  const say = useCallback((text: string, onEnd?: () => void) => {
    if (on) speak(text, VOICE_FOLDER, onEnd);
    else onEnd?.();
  }, [on]);
  return { on, setOn, say, available: canReadAloud() };
}

type Screen = { kind: 'loading' } | { kind: 'home' } | { kind: 'play'; round: Round } | { kind: 'finish'; result: SwamphenFinish };

export interface Helpers {
  reload: () => void;
}

interface Props {
  backend: SwamphenBackend;
  /** Back to the hub's home page (the preview has none). */
  onExit?: () => void;
  /** Preview tools, shown over the game. */
  extra?: (h: Helpers) => ReactNode;
}

/** Below this much room under the hub's top bar, the game covers the whole screen, bar and all (as Weka does). */
const ROOM_UNDER_BAR = 420;
function useFitBelow(root: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const fit = () => {
      el.classList.remove('sh-root--cover');
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      const cover = top > 0 && window.innerHeight - top - 12 < ROOM_UNDER_BAR;
      el.classList.toggle('sh-root--cover', cover);
      el.style.setProperty('--sh-room', top === 0 || cover ? '100dvh' : `calc(100dvh - ${top + 12}px)`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [root]);
}

export function SwamphenGame({ backend, onExit, extra }: Props) {
  const [state, setState] = useState<SwamphenState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [failed, setFailed] = useState<string | null>(null);
  const fail = useCallback((e: unknown) => setFailed(e instanceof SwamphenError ? e.message : WORDS.wentWrong), []);
  const voice = useVoice();
  const { soundOn } = useSound();
  const root = useRef<HTMLDivElement>(null);
  useFitBelow(root);

  const reload = useCallback(() => {
    setFailed(null);
    backend.load().then((s) => {
      setState(s);
      setScreen({ kind: 'home' });
    }, fail);
  }, [backend, fail]);
  useEffect(reload, [reload]);

  const play = () => backend.start().then((round) => setScreen({ kind: 'play', round }), fail);
  const done = (seed: number, taps: Tap[]) =>
    backend.finish(seed, taps).then((result) => {
      setState((s) => s && { ...s, daysDone: result.daysDone, lastDay: result.lastDay, step: result.step, level: result.level });
      setScreen({ kind: 'finish', result });
      if (soundOn) playSound(result.goldenGarden ? 'win' : 'badge');
    }, fail);

  let body: ReactNode;
  if (failed) body = <p className="sh-message">{failed}</p>;
  else if (!state || screen.kind === 'loading') body = <p className="sh-message">…</p>;
  else if (screen.kind === 'play') {
    const branch = gardenAfter(state.daysDone);
    body = <Goes guided={state.daysDone === 0} round={screen.round} scenery={branch.today} friend={branch.friend} sound={soundOn} say={voice.say} onDone={(taps) => done(screen.round.seed, taps)} />;
  } else if (screen.kind === 'finish') body = <Finish result={screen.result} say={voice.say} onNext={() => setScreen({ kind: 'home' })} />;
  else body = <Home state={state} say={voice.say} onPlay={play} />;

  return (
    <div className="sh-root" ref={root}>
      <div className="sh-bar">
        {onExit && (
          <button type="button" className="sh-button" onClick={onExit}>
            <span aria-hidden="true">🏠</span> {WORDS.home}
          </button>
        )}
        {voice.available && (
          <button type="button" className="sh-button" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)}>
            <span aria-hidden="true">{voice.on ? '🗣️' : '🤫'}</span> {voice.on ? WORDS.voiceOn : WORDS.voiceOff}
          </button>
        )}
      </div>
      {body}
      {extra?.({ reload })}
    </div>
  );
}

/** The reed garden on the home and finish screens: ten reed rows, and the friend perched on it. */
function Branch({ scenery, rows, friend, pose }: { scenery: Scenery; rows: { metal: Metal; glow?: boolean }[]; friend: FriendName; pose: Pose }) {
  return (
    <div className={`sh-tree sh-scene--${scenery}`}>
      <div className="sh-tree__clusters" role="img" aria-label={`${rows.filter((c) => c.metal !== 'mud').length} of ${ROWS} reed rows changed`}>
        {rows.map((c, i) => (
          <span key={i} className="sh-tree__spot">
            <ReedRow metal={c.metal} glow={c.glow} />
          </span>
        ))}
      </div>
      <span className="sh-tree__friend">
        <Friend friend={friend} pose={pose} />
      </span>
    </div>
  );
}

function Home({ state, say, onPlay }: { state: SwamphenState; say: (t: string) => void; onPlay: () => void }) {
  const branch = gardenAfter(state.daysDone);
  const name = FRIEND_NAMES[branch.friend];
  const doneToday = state.lastDay === state.today;
  const title = branch.day === 0 && branch.prizes > 0 ? WORDS.nextFriend(name) : WORDS.wants(name);
  const heading = useRef<HTMLHeadingElement>(null);
  // A child's very first day: Swamp Hen says hello first, in two short tips.
  const [tipAt, setTipAt] = useState<number | null>(() => (state.daysDone === 0 && !readTipSeen() ? 0 : null));
  const closeTip = () => {
    setTipAt(null);
    try {
      localStorage.setItem(TIP_KEY, 'yes');
    } catch {
      // Storage blocked: the tip may show again.
    }
  };
  useEffect(() => {
    heading.current?.focus();
    say(tipAt !== null ? WORDS.tip[tipAt] : homeLine(title, doneToday));
  }, [say, doneToday, title, tipAt]);
  return (
    <div className="sh-home">
      <Branch scenery={branch.today} rows={branch.rows.map((metal) => ({ metal }))} friend={branch.friend} pose="sit" />
      <div className="sh-panel">
        {tipAt !== null && (
          <FirstTimeTip
            prefix="sh"
            who={WORDS.tipName}
            face={<span className="sh-tip__face"><Friend friend="swamphen" pose="sit" /></span>}
            say={WORDS.tip[tipAt]}
            n={tipAt}
            of={WORDS.tip.length}
            inline
            nextLabel={WORDS.tipNext}
            lastLabel={WORDS.tipLast}
            closeLabel={WORDS.tipClose}
            onNext={() => setTipAt(tipAt + 1)}
            onClose={closeTip}
          />
        )}
        <h2 tabIndex={-1} ref={heading}>{title}</h2>
        <p className="sh-day">{WORDS.dayCount(Math.min(branch.day + 1, DAYS_PER_GARDEN))}</p>
        <NextPartChip noun={WORDS.part} done={doneToday} onHear={say} />
        <p className="sh-chip">{WORDS.step(state.step)}</p>
        {doneToday && <p>{WORDS.doneToday}</p>}
        <button type="button" className="button button--play sh-play-button" onClick={onPlay}>
          {doneToday ? WORDS.playAgain : WORDS.play}
        </button>
        <button type="button" className="sh-button sh-hear-home" onClick={() => say(homeLine(title, doneToday))}>
          <span aria-hidden="true">👂</span> {WORDS.hearAgain}
        </button>
        {branch.prizes > 0 && (
          <p className="sh-shelf" aria-label={WORDS.prizesWon(branch.prizes)}>
            {Array.from({ length: branch.prizes }, (_, i) => <span key={i} className="sh-shelf__prize"><GoldenGarden /></span>)}
          </p>
        )}
      </div>
    </div>
  );
}

/** A cluster changes colour, or, on the thirtieth day, the Golden Berry Branch is won. */
function Finish({ result, say, onNext }: { result: SwamphenFinish; say: (t: string) => void; onNext: () => void }) {
  // On a Golden Berry Branch day the new branch has already started, so show the one just finished: every cluster gold.
  const branch = gardenAfter(result.goldenGarden ? result.daysDone - 1 : result.daysDone);
  const rowList = result.goldenGarden
    ? Array.from({ length: ROWS }, () => ({ metal: 'gold' as const, glow: true }))
    : branch.rows.map((metal, i) => ({ metal, glow: i === result.rowChanged }));
  const changed = result.rowChanged === null ? null : rowList[result.rowChanged].metal;
  const name = FRIEND_NAMES[branch.friend];
  const main = result.goldenGarden ? WORDS.goldenGarden(name) : changed ? WORDS.rowTurned(changed as 'bronze') : WORDS.doneToday;
  const up = result.step !== result.stepBefore ? result.step : null;
  const line = finishLine(main, up);
  return (
    <div className={`sh-home${result.goldenGarden ? ' sh-home--prize' : ''}`}>
      <Branch scenery={result.goldenGarden ? 'gold' : branch.today} rows={rowList} friend={branch.friend} pose="cheer" />
      <WhatsNext prefix="sh" title={main} spoken={line} note={up ? WORDS.nextStep(up) : null} buttonLabel="OK" say={say} onNext={onNext}>
        {result.goldenGarden && <span className="sh-prize"><GoldenGarden /></span>}
      </WhatsNext>
    </div>
  );
}
