/**
 * Hop's Glow-worm Pond (docs/HOP-PLAN.md): each day, ten hops counting in tens, fives or twos. Each day's first finish
 * changes one magic lily pad (bronze, then silver, then gold); thirty days bring Hop to the Glow-worm Party and win the
 * Golden Glow Jar, and a new friend crosses a fresh pond. The screens only show what the backend says.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Tap } from '../../../shared/hop/play';
import { DAYS_PER_JAR, METALS, PADS, pondAfter } from '../../../shared/hop/progress';
import type { Round } from '../../../shared/hop/round';
import { useSound } from '../../sound';
import { canSpeak, speak, stopSpeaking } from '../../speech';
import { playSound } from '../sounds';
import { FRIEND_NAMES, paint } from './art';
import { HopError, type HopBackend, type HopFinish, type HopState } from './backend';
import { Hops } from './Hops';
import { Pond } from './Pond';
import { WORDS } from './words';
import './hop.css';

/** This game talks unless it's turned off: most of its players can't read yet. Remembered on this device. */
const VOICE_KEY = 'hop-voice';
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
  const say = useCallback((text: string) => on && speak(text), [on]);
  return { on, setOn, say, available: canSpeak() };
}

type Screen = { kind: 'loading' } | { kind: 'home' } | { kind: 'play'; round: Round } | { kind: 'finish'; result: HopFinish };

export interface Helpers {
  reload: () => void;
}

interface Props {
  backend: HopBackend;
  /** Back to the hub's home page (the preview has none). */
  onExit?: () => void;
  /** Preview tools, shown over the game. */
  extra?: (h: Helpers) => ReactNode;
}

/** Below this much room under the hub's top bar, the game covers the whole screen, bar and all (as Beanstalk does). */
const ROOM_UNDER_BAR = 420;
function useFitBelow(root: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const fit = () => {
      el.classList.remove('hp-root--cover');
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      const cover = top > 0 && window.innerHeight - top - 12 < ROOM_UNDER_BAR;
      el.classList.toggle('hp-root--cover', cover);
      el.style.setProperty('--hp-room', top === 0 || cover ? '100dvh' : `calc(100dvh - ${top + 12}px)`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [root]);
}

export function HopGame({ backend, onExit, extra }: Props) {
  const [state, setState] = useState<HopState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [failed, setFailed] = useState<string | null>(null);
  const fail = useCallback((e: unknown) => setFailed(e instanceof HopError ? e.message : WORDS.wentWrong), []);
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
      setState((s) => s && { ...s, daysDone: result.daysDone, lastPadDay: result.lastPadDay, step: result.step });
      setScreen({ kind: 'finish', result });
      if (soundOn) playSound(result.jar ? 'win' : 'badge');
    }, fail);

  let body: ReactNode;
  if (failed) body = <p className="hp-message">{failed}</p>;
  else if (!state || screen.kind === 'loading') body = <p className="hp-message">…</p>;
  else if (screen.kind === 'play') {
    const pond = pondAfter(state.daysDone);
    body = (
      <Hops
        round={screen.round}
        help={pond.help}
        padMetal={METALS[Math.floor(pond.day / PADS)]}
        scenery={pond.today}
        friend={pond.friend}
        sound={soundOn}
        say={voice.say}
        onDone={(taps) => done(screen.round.seed, taps)}
      />
    );
  } else if (screen.kind === 'finish') body = <Finish result={screen.result} say={voice.say} onNext={() => setScreen({ kind: 'home' })} />;
  else body = <Home state={state} say={voice.say} onPlay={play} />;

  return (
    <div className="hp-root" ref={root}>
      <div className="hp-bar">
        {onExit && (
          <button type="button" className="hp-button" onClick={onExit}>
            <span aria-hidden="true">🏠</span> {WORDS.home}
          </button>
        )}
        {voice.available && (
          <button type="button" className="hp-button" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)}>
            <span aria-hidden="true">{voice.on ? '🗣️' : '🤫'}</span> {voice.on ? WORDS.voiceOn : WORDS.voiceOff}
          </button>
        )}
      </div>
      {body}
      {extra?.({ reload })}
    </div>
  );
}

function Home({ state, say, onPlay }: { state: HopState; say: (t: string) => void; onPlay: () => void }) {
  const pond = pondAfter(state.daysDone);
  const name = FRIEND_NAMES[pond.friend];
  const doneToday = state.lastPadDay === state.today;
  const title = pond.day === 0 && pond.jars > 0 ? WORDS.nextFriend(name) : WORDS.wants(name);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(doneToday ? `${title} ${WORDS.doneToday}` : title);
  }, [say, doneToday, title]);
  const jar = paint('things/jar');
  return (
    <div className="hp-home">
      <Pond scenery={pond.today} pads={pond.pads.map((metal) => ({ metal }))} friend={pond.friend} pose="wave" />
      <div className="hp-panel">
        <h2 tabIndex={-1} ref={heading}>{title}</h2>
        <p className="hp-day">{WORDS.dayCount(Math.min(pond.day + 1, DAYS_PER_JAR))}</p>
        <p className="hp-chip">{WORDS.counting(state.step)}</p>
        {doneToday && <p>{WORDS.doneToday}</p>}
        <button type="button" className="button button--play hp-play-button" onClick={onPlay}>
          {doneToday ? WORDS.playAgain : WORDS.play}
        </button>
        {pond.jars > 0 && (
          <p className="hp-shelf" aria-label={WORDS.jars(pond.jars)}>
            {Array.from({ length: pond.jars }, (_, i) => (jar ? <img key={i} src={jar} alt="" /> : <span key={i} className="hp-jar" />))}
          </p>
        )}
      </div>
    </div>
  );
}

/** A pad changes colour, or, on the thirtieth day, Hop reaches the Glow-worm Party and the Golden Glow Jar is won. */
function Finish({ result, say, onNext }: { result: HopFinish; say: (t: string) => void; onNext: () => void }) {
  // On a jar day the new pond has already started, so show the one just finished: every pad gold.
  const pond = pondAfter(result.jar ? result.daysDone - 1 : result.daysDone);
  const pads = result.jar
    ? Array.from({ length: PADS }, () => ({ metal: 'gold' as const, glow: true }))
    : pond.pads.map((metal, i) => ({ metal, glow: i === result.padChanged }));
  const changed = result.padChanged === null ? null : pads[result.padChanged].metal;
  const name = FRIEND_NAMES[pond.friend];
  const main = result.jar ? WORDS.jar(name) : changed ? WORDS.padTurned(changed) : WORDS.doneToday;
  const stepUp = result.step !== result.stepBefore ? WORDS.stepUp(result.step) : null;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(stepUp ? `${main} ${stepUp}` : main);
  }, [say, main, stepUp]);
  const cushion = paint('things/jar-cushion');
  return (
    <div className={`hp-home${result.jar ? ' hp-home--jar' : ''}`}>
      <Pond
        scenery={result.jar ? 'gold' : pond.today}
        pads={pads}
        friend={pond.friend}
        pose="cheer"
        at={result.jar ? PADS : result.padChanged ?? -1}
      />
      <div className="hp-panel">
        <h2 tabIndex={-1} ref={heading}>{main}</h2>
        {stepUp && <p className="hp-chip">{stepUp}</p>}
        {result.jar && (cushion ? <img className="hp-prize" src={cushion} alt="The Golden Glow Jar" /> : <span className="hp-jar hp-jar--big" role="img" aria-label="The Golden Glow Jar" />)}
        <button type="button" className="button button--play hp-play-button" onClick={onNext}>
          OK
        </button>
      </div>
    </div>
  );
}
