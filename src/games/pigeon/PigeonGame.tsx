/**
 * Pigeon’s Number Line (docs/PIGEON-PLAN.md): each day, ten goes on the berry branch, placing, reading and comparing numbers on a
 * line. Each day's first finish turns one berry cluster (bronze, then silver, then gold); thirty days win the Golden Berry
 * Branch, and a new friend flies a new branch. The screens only show what the backend says. Copied from Tūī’s Ten Tree (a model, not a dependency).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { finishBand } from '../../../shared/kit/finishBand';
import { WhatsNext } from '../../kit/WhatsNext';
import { NextPartChip } from '../../components/NextPartChip';
import { BERRY_CLUSTERS } from '../../../shared/pigeon/config';
import type { Tap } from '../../../shared/pigeon/play';
import { DAYS_PER_BRANCH, FRIEND_NAMES, branchAfter, type Friend as FriendName, type Metal } from '../../../shared/pigeon/progress';
import type { Round } from '../../../shared/pigeon/round';
import { useSound } from '../../sound';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { playSound } from '../sounds';
import { Cluster, Friend, GoldenBranch, sceneStyle, type Pose, type Scenery } from './art';
import { PigeonError, type PigeonBackend, type PigeonFinish, type PigeonState } from './backend';
import { Goes } from './Goes';
import { finishLine, homeLine, VOICE_FOLDER } from './voiceLines';
import { WORDS } from './words';
import './pigeon.css';

/** This game talks unless it's turned off: many of its players read slowly. Remembered on this device. */
const VOICE_KEY = 'pigeon-voice';
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

type Screen = { kind: 'loading' } | { kind: 'home' } | { kind: 'play'; round: Round } | { kind: 'finish'; result: PigeonFinish };

export interface Helpers {
  reload: () => void;
}

interface Props {
  backend: PigeonBackend;
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
      el.classList.remove('pg-root--cover');
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      const cover = top > 0 && window.innerHeight - top - 12 < ROOM_UNDER_BAR;
      el.classList.toggle('pg-root--cover', cover);
      el.style.setProperty('--pg-room', top === 0 || cover ? '100dvh' : `calc(100dvh - ${top + 12}px)`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [root]);
}

export function PigeonGame({ backend, onExit, extra }: Props) {
  const [state, setState] = useState<PigeonState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [failed, setFailed] = useState<string | null>(null);
  const fail = useCallback((e: unknown) => setFailed(e instanceof PigeonError ? e.message : WORDS.wentWrong), []);
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
      setState((s) => s && { ...s, daysDone: result.daysDone, lastDay: result.lastDay, step: result.step, level: result.level, kindLevels: result.kindLevels });
      setScreen({ kind: 'finish', result });
      if (soundOn) playSound(result.goldenBranch ? 'win' : 'badge');
    }, fail);

  let body: ReactNode;
  if (failed) body = <p className="pg-message">{failed}</p>;
  else if (!state || screen.kind === 'loading') body = <p className="pg-message">…</p>;
  else if (screen.kind === 'play') {
    const branch = branchAfter(state.daysDone);
    body = <Goes guided={state.daysDone === 0} round={screen.round} scenery={branch.today} friend={branch.friend} sound={soundOn} say={voice.say}
      seenKinds={state.seen}
      saveSeen={(kinds) => {
        // Kept in the state too, so playing again in the same sitting remembers.
        setState((s) => s && { ...s, seen: [...new Set([...s.seen, ...kinds])] });
        return backend.markSeen(kinds);
      }}
      onDone={(taps) => done(screen.round.seed, taps)} />;
  } else if (screen.kind === 'finish') body = <Finish result={screen.result} say={voice.say} onNext={() => setScreen({ kind: 'home' })} />;
  else body = <Home state={state} say={voice.say} onPlay={play} />;

  return (
    <div className="pg-root" ref={root}>
      <div className="pg-bar">
        {onExit && (
          <button type="button" className="pg-button" onClick={onExit}>
            <span aria-hidden="true">🏠</span> {WORDS.home}
          </button>
        )}
        {voice.available && (
          <button type="button" className="pg-button" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)}>
            <span aria-hidden="true">{voice.on ? '🗣️' : '🤫'}</span> {voice.on ? WORDS.voiceOn : WORDS.voiceOff}
          </button>
        )}
      </div>
      {body}
      {extra?.({ reload })}
    </div>
  );
}

/** The berry branch on the home and finish screens: ten clusters along the branch, and the friend perched on it. */
function Branch({ scenery, clusters, friend, pose }: { scenery: Scenery; clusters: { metal: Metal; glow?: boolean }[]; friend: FriendName; pose: Pose }) {
  return (
    <div className={`pg-tree pg-scene--${scenery}`} style={sceneStyle(scenery)}>
      <div className="pg-tree__clusters" role="img" aria-label={`${clusters.filter((c) => c.metal !== 'green').length} of ${BERRY_CLUSTERS} clusters changed`}>
        {clusters.map((c, i) => (
          <span key={i} className="pg-tree__spot">
            <Cluster metal={c.metal} glow={c.glow} />
          </span>
        ))}
      </div>
      <span className="pg-tree__friend">
        <Friend friend={friend} pose={pose} />
      </span>
    </div>
  );
}

function Home({ state, say, onPlay }: { state: PigeonState; say: (t: string) => void; onPlay: () => void }) {
  const branch = branchAfter(state.daysDone);
  const name = FRIEND_NAMES[branch.friend];
  const doneToday = state.lastDay === state.today;
  const title = branch.day === 0 && branch.prizes > 0 ? WORDS.nextFriend(name) : WORDS.wants(name);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(homeLine(title, doneToday));
  }, [say, doneToday, title]);
  return (
    <div className="pg-home">
      <Branch scenery={branch.today} clusters={branch.clusters.map((metal) => ({ metal }))} friend={branch.friend} pose="sit" />
      <div className="pg-panel">
        <h2 tabIndex={-1} ref={heading}>{title}</h2>
        <p className="pg-day">{WORDS.dayCount(Math.min(branch.day + 1, DAYS_PER_BRANCH))}</p>
        <NextPartChip noun={WORDS.part} done={doneToday} onHear={say} />
        <p className="pg-chip">{WORDS.step(state.step)}</p>
        {doneToday && <p>{WORDS.doneToday}</p>}
        <button type="button" className="button button--play pg-play-button" onClick={onPlay}>
          {doneToday ? WORDS.playAgain : WORDS.play}
        </button>
        {branch.prizes > 0 && (
          <p className="pg-shelf" aria-label={WORDS.prizesWon(branch.prizes)}>
            {Array.from({ length: branch.prizes }, (_, i) => <span key={i} className="pg-shelf__prize"><GoldenBranch /></span>)}
          </p>
        )}
      </div>
    </div>
  );
}

/** A cluster changes colour, or, on the thirtieth day, the Golden Berry Branch is won. */
function Finish({ result, say, onNext }: { result: PigeonFinish; say: (t: string) => void; onNext: () => void }) {
  // On a Golden Berry Branch day the new branch has already started, so show the one just finished: every cluster gold.
  const branch = branchAfter(result.goldenBranch ? result.daysDone - 1 : result.daysDone);
  const clusters = result.goldenBranch
    ? Array.from({ length: BERRY_CLUSTERS }, () => ({ metal: 'gold' as const, glow: true }))
    : branch.clusters.map((metal, i) => ({ metal, glow: i === result.clusterChanged }));
  const changed = result.clusterChanged === null ? null : clusters[result.clusterChanged].metal;
  const name = FRIEND_NAMES[branch.friend];
  const main = result.goldenBranch ? WORDS.goldenBranch(name) : changed ? WORDS.clusterTurned(changed) : WORDS.doneToday;
  const up = result.step !== result.stepBefore ? result.step : null;
  const how = WORDS.how[finishBand(result.firstRight)];
  const line = finishLine(main, how, up);
  return (
    <div className={`pg-home${result.goldenBranch ? ' pg-home--prize' : ''}`}>
      <Branch scenery={result.goldenBranch ? 'gold' : branch.today} clusters={clusters} friend={branch.friend} pose="cheer" />
      <WhatsNext prefix="pg" title={main} spoken={line} buttonLabel="OK" say={say} onNext={onNext}>
        <p className="pg-chip">{how}</p>
        {up && <p className="pg-chip">{WORDS.nextStep(up)}</p>}
        {result.goldenBranch && <span className="pg-prize"><GoldenBranch /></span>}
      </WhatsNext>
    </div>
  );
}
