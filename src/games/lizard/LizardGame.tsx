/**
 * Lizard’s Bundles (docs/LIZARD-PLAN.md): each day, ten goes tying sticks into bundles of ten (and bundles into rafts of a hundred),
 * building, reading, tying, untying and making ten more or less. Each day's first finish changes one bundle in the den (twine,
 * then bronze, silver and gold); thirty days win the Golden Raft, and a new friend has a new den. The screens only show what the
 * backend says. Copied from Pigeon's Number Line (a model, not a dependency).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { WhatsNext } from '../../kit/WhatsNext';
import { NextPartChip } from '../../components/NextPartChip';
import { DEN_BUNDLES } from '../../../shared/lizard/config';
import type { Tap } from '../../../shared/lizard/play';
import { DAYS_PER_RAFT, FRIEND_NAMES, denAfter, type Friend as FriendName, type Metal } from '../../../shared/lizard/progress';
import { GOES_PER_ROUND, type Round } from '../../../shared/lizard/round';
import { useSound } from '../../sound';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { playSound } from '../sounds';
import { Bundle, Friend, GoldenRaft, sceneStyle, type Pose, type Scenery } from './art';
import { LizardError, type LizardBackend, type LizardFinish, type LizardState } from './backend';
import { Goes } from './Goes';
import { finishLine, homeLine, VOICE_FOLDER } from './voiceLines';
import { WORDS } from './words';
import './lizard.css';

/** This game talks unless it's turned off: many of its players read slowly. Remembered on this device. */
const VOICE_KEY = 'lizard-voice';
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

type Screen = { kind: 'loading' } | { kind: 'home' } | { kind: 'play'; round: Round } | { kind: 'finish'; result: LizardFinish };

export interface Helpers {
  reload: () => void;
}

interface Props {
  backend: LizardBackend;
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
      el.classList.remove('lz-root--cover');
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      const cover = top > 0 && window.innerHeight - top - 12 < ROOM_UNDER_BAR;
      el.classList.toggle('lz-root--cover', cover);
      el.style.setProperty('--lz-room', top === 0 || cover ? '100dvh' : `calc(100dvh - ${top + 12}px)`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [root]);
}

export function LizardGame({ backend, onExit, extra }: Props) {
  const [state, setState] = useState<LizardState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [failed, setFailed] = useState<string | null>(null);
  const fail = useCallback((e: unknown) => setFailed(e instanceof LizardError ? e.message : WORDS.wentWrong), []);
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
      if (soundOn) playSound(result.goldenRaft ? 'win' : 'badge');
    }, fail);

  let body: ReactNode;
  if (failed) body = <p className="lz-message">{failed}</p>;
  else if (!state || screen.kind === 'loading') body = <p className="lz-message">…</p>;
  else if (screen.kind === 'play') {
    const den = denAfter(state.daysDone);
    body = <Goes guided={state.daysDone === 0} seen={state.seen ?? []} onMarkSeen={backend.markSeen} onSeen={(k) => setState((st) => st && { ...st, seen: [...new Set([...(st.seen ?? []), ...k])] })} round={screen.round} scenery={den.today} friend={den.friend} sound={soundOn} say={voice.say} onDone={(taps) => done(screen.round.seed, taps)} />;
  } else if (screen.kind === 'finish') body = <Finish result={screen.result} say={voice.say} onNext={() => setScreen({ kind: 'home' })} />;
  else body = <Home state={state} say={voice.say} onPlay={play} />;

  return (
    <div className="lz-root" ref={root}>
      <div className="lz-bar">
        {onExit && (
          <button type="button" className="lz-button" onClick={onExit}>
            <span aria-hidden="true">🏠</span> {WORDS.home}
          </button>
        )}
        {voice.available && (
          <button type="button" className="lz-button" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)}>
            <span aria-hidden="true">{voice.on ? '🗣️' : '🤫'}</span> {voice.on ? WORDS.voiceOn : WORDS.voiceOff}
          </button>
        )}
      </div>
      {body}
      {extra?.({ reload })}
    </div>
  );
}

/** Lizard's den on the home and finish screens: ten bundles in a row, and the friend beside them. */
function Den({ scenery, bundles, friend, pose }: { scenery: Scenery; bundles: { metal: Metal; glow?: boolean }[]; friend: FriendName; pose: Pose }) {
  return (
    <div className={`lz-tree lz-scene--${scenery}`} style={sceneStyle(scenery)}>
      <div className="lz-tree__bundles" role="img" aria-label={`${bundles.filter((c) => c.metal !== 'twine').length} of ${DEN_BUNDLES} bundles changed`}>
        {bundles.map((c, i) => (
          <span key={i} className="lz-tree__spot">
            <Bundle metal={c.metal} glow={c.glow} painted />
          </span>
        ))}
      </div>
      <span className="lz-tree__friend">
        <Friend friend={friend} pose={pose} />
      </span>
    </div>
  );
}

function Home({ state, say, onPlay }: { state: LizardState; say: (t: string) => void; onPlay: () => void }) {
  const den = denAfter(state.daysDone);
  const name = FRIEND_NAMES[den.friend];
  const doneToday = state.lastDay === state.today;
  const title = den.day === 0 && den.prizes > 0 ? WORDS.nextFriend(name) : WORDS.wants(name);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(homeLine(title, doneToday));
  }, [say, doneToday, title]);
  return (
    <div className="lz-home">
      <Den scenery={den.today} bundles={den.bundles.map((metal) => ({ metal }))} friend={den.friend} pose="sit" />
      <div className="lz-panel">
        <h2 tabIndex={-1} ref={heading}>{title}</h2>
        <p className="lz-day">{WORDS.dayCount(Math.min(den.day + 1, DAYS_PER_RAFT))}</p>
        <NextPartChip noun={WORDS.part} done={doneToday} onHear={say} />
        <p className="lz-chip">{WORDS.step(state.step)}</p>
        {doneToday && <p>{WORDS.doneToday}</p>}
        <button type="button" className="button button--play lz-play-button" onClick={onPlay}>
          {doneToday ? WORDS.playAgain : WORDS.play}
        </button>
        {den.prizes > 0 && (
          <p className="lz-shelf" aria-label={WORDS.prizesWon(den.prizes)}>
            {Array.from({ length: den.prizes }, (_, i) => <span key={i} className="lz-shelf__prize"><GoldenRaft /></span>)}
          </p>
        )}
      </div>
    </div>
  );
}

/** A bundle changes colour, or, on the thirtieth day, the Golden Raft is won. */
function Finish({ result, say, onNext }: { result: LizardFinish; say: (t: string) => void; onNext: () => void }) {
  // On a Golden Raft day the new den has already started, so show the one just finished: every bundle gold.
  const den = denAfter(result.goldenRaft ? result.daysDone - 1 : result.daysDone);
  const bundles = result.goldenRaft
    ? Array.from({ length: DEN_BUNDLES }, () => ({ metal: 'gold' as const, glow: true }))
    : den.bundles.map((metal, i) => ({ metal, glow: i === result.bundleChanged }));
  const changed = result.bundleChanged === null ? null : bundles[result.bundleChanged].metal;
  const name = FRIEND_NAMES[den.friend];
  const main = result.goldenRaft ? WORDS.goldenRaft(name) : changed ? WORDS.bundleTurned(changed) : WORDS.doneToday;
  const up = result.step !== result.stepBefore ? result.step : null;
  const line = finishLine(main, up);
  return (
    <div className={`lz-home${result.goldenRaft ? ' lz-home--prize' : ''}`}>
      <Den scenery={result.goldenRaft ? 'gold' : den.today} bundles={bundles} friend={den.friend} pose="cheer" />
      <WhatsNext prefix="lz" title={main} spoken={line} note={up ? WORDS.nextStep(up) : null} buttonLabel="OK" say={say} onNext={onNext}>
        <p className="lz-chip">{WORDS.firstTime(result.firstRight, GOES_PER_ROUND)}</p>
        {result.goldenRaft && <span className="lz-prize"><GoldenRaft /></span>}
      </WhatsNext>
    </div>
  );
}
