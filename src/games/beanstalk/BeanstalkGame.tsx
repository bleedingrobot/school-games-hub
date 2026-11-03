/**
 * Kiwi's Beanstalk (docs/BEANSTALK-PLAN.md): choose Jack or Jill, then each day make ten pairs that add to 10. Each day's
 * first finish changes one magic leaf (bronze, then silver, then gold); thirty days bring the friend down and win the
 * Golden Egg, and the next friend is stuck on a fresh beanstalk. The screens only show what the backend says.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { DAYS_PER_EGG, LEAVES_ON_STALK, stalkAfter, type FinishResult } from '../../../shared/beanstalk/progress';
import type { Tap } from '../../../shared/beanstalk/round';
import { useSound } from '../../sound';
import { canSpeak, speak, stopSpeaking } from '../../speech';
import { playSound } from '../sounds';
import { childArt, FRIEND_NAMES, paint } from './art';
import type { BeanstalkBackend, BeanstalkState, Child } from './backend';
import { Round } from './Round';
import { Scene } from './Scene';
import { WORDS } from './words';
import './beanstalk.css';

/** This game talks unless it's turned off (James, 4 Nov 2026): most of its players can't read yet. Remembered on this device. */
const VOICE_KEY = 'beanstalk-voice';
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

type Screen =
  | { kind: 'loading' }
  | { kind: 'choose' }
  | { kind: 'home' }
  | { kind: 'play'; seed: number }
  | { kind: 'finish'; result: FinishResult };

export interface Helpers {
  reload: () => void;
}

interface Props {
  backend: BeanstalkBackend;
  /** Preview tools, shown under the game. */
  extra?: (h: Helpers) => ReactNode;
}

export function BeanstalkGame({ backend, extra }: Props) {
  const [state, setState] = useState<BeanstalkState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [failed, setFailed] = useState(false);
  const voice = useVoice();
  const { soundOn } = useSound();

  const reload = useCallback(() => {
    backend
      .load()
      .then((s) => {
        setState(s);
        setScreen(s.child ? { kind: 'home' } : { kind: 'choose' });
      })
      .catch(() => setFailed(true));
  }, [backend]);
  useEffect(reload, [reload]);

  const choose = (child: Child) => backend.choose(child).then(reload, () => setFailed(true));
  const play = () => backend.start().then(({ seed }) => setScreen({ kind: 'play', seed }), () => setFailed(true));
  const done = (seed: number, taps: Tap[]) =>
    backend.finish(seed, taps).then(
      (result) => {
        setState((s) => s && { ...s, daysDone: result.daysDone, lastLeafDay: result.lastLeafDay });
        setScreen({ kind: 'finish', result });
        if (soundOn) playSound(result.egg ? 'win' : 'badge');
      },
      () => setFailed(true),
    );

  let body: ReactNode;
  if (failed) body = <p className="bs-message">Something went wrong. Please try again soon.</p>;
  else if (!state || screen.kind === 'loading') body = <p className="bs-message">…</p>;
  else if (screen.kind === 'choose') body = <Choose say={voice.say} onChoose={choose} />;
  else if (screen.kind === 'play' && state.child)
    body = (
      <Round
        seed={screen.seed}
        dots={stalkAfter(state.daysDone).dots}
        friend={stalkAfter(state.daysDone).friend}
        child={state.child}
        guide={state.daysDone === 0 && state.lastLeafDay === null}
        sound={soundOn}
        say={voice.say}
        onDone={(taps) => done(screen.seed, taps)}
      />
    );
  else if (screen.kind === 'finish' && state.child)
    body = <Finish result={screen.result} child={state.child} say={voice.say} onNext={() => setScreen({ kind: 'home' })} />;
  else body = <Home state={state} say={voice.say} onPlay={play} />;

  return (
    <div className="bs-root">
      <div className="bs-bar">
        {voice.available && (
          <button type="button" className="bs-voice" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)}>
            <span aria-hidden="true">{voice.on ? '🗣️' : '🤫'}</span> {voice.on ? WORDS.voiceOn : WORDS.voiceOff}
          </button>
        )}
      </div>
      {body}
      {extra?.({ reload })}
    </div>
  );
}

/** The first go: be Jack or Jill. */
function Choose({ say, onChoose }: { say: (t: string) => void; onChoose: (c: Child) => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(WORDS.whoAreYou);
  }, [say]);
  return (
    <div className="bs-choose">
      <h2 tabIndex={-1} ref={heading}>{WORDS.whoAreYou}</h2>
      <div className="bs-choose__row">
        {(['jack', 'jill'] as const).map((c) => (
          <button key={c} type="button" className="bs-choose__child" onClick={() => onChoose(c)}>
            <img src={childArt(c, 'wave')} alt="" />
            <span>{WORDS[c]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Home({ state, say, onPlay }: { state: BeanstalkState; say: (t: string) => void; onPlay: () => void }) {
  const stalk = stalkAfter(state.daysDone);
  const name = FRIEND_NAMES[stalk.friend];
  const doneToday = state.lastLeafDay === state.today;
  // A fresh beanstalk after an egg says who is stuck now.
  const title = stalk.day === 0 && stalk.eggs > 0 ? WORDS.nextFriend(name) : WORDS.stuck(name);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(doneToday ? `${title} ${WORDS.doneToday}` : title);
  }, [say, doneToday, title]);
  return (
    <div className="bs-home">
      <Scene grow={1} leaves={stalk.leaves.map((metal) => ({ metal }))} friend={stalk.friend} friendPose="wait" child={state.child} childPose="wave" />
      <div className="bs-panel">
        <h2 tabIndex={-1} ref={heading}>{title}</h2>
        <p className="bs-day">{WORDS.dayCount(Math.min(stalk.day + 1, DAYS_PER_EGG))}</p>
        {doneToday && <p>{WORDS.doneToday}</p>}
        <button type="button" className="button button--play bs-play-button" onClick={onPlay}>
          {doneToday ? WORDS.playAgain : WORDS.play}
        </button>
        {stalk.eggs > 0 && (
          <p className="bs-shelf" aria-label={WORDS.eggs(stalk.eggs)}>
            {Array.from({ length: stalk.eggs }, (_, i) => <img key={i} src={paint('things/golden-egg')} alt="" />)}
          </p>
        )}
      </div>
    </div>
  );
}

/** A leaf changes colour, or, on the thirtieth day, the friend climbs down and the Golden Egg is won. */
function Finish({ result, child, say, onNext }: { result: FinishResult; child: Child; say: (t: string) => void; onNext: () => void }) {
  // On an egg day the new beanstalk has already started, so show the one just finished: every leaf gold.
  const stalk = stalkAfter(result.egg ? result.daysDone - 1 : result.daysDone);
  const leaves = result.egg
    ? Array.from({ length: LEAVES_ON_STALK }, () => ({ metal: 'gold' as const, glow: true }))
    : stalk.leaves.map((metal, i) => ({ metal, glow: i === result.leafChanged }));
  const changed = result.leafChanged === null ? null : leaves[result.leafChanged].metal;
  const name = FRIEND_NAMES[stalk.friend];
  const text = result.egg ? WORDS.egg(name) : changed ? WORDS.leafTurned(changed) : WORDS.doneToday;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(text);
  }, [say, text]);
  return (
    <div className={`bs-home${result.egg ? ' bs-home--egg' : ''}`}>
      {result.egg ? (
        <Scene grow={1} leaves={[]} friend={stalk.friend} friendPose="egg" child={child} childPose="hold" back="clouds" />
      ) : (
        <Scene grow={1} leaves={leaves} friend={stalk.friend} friendPose="cheer" child={child} childPose="cheer" />
      )}
      <div className="bs-panel">
        <h2 tabIndex={-1} ref={heading}>{text}</h2>
        {result.egg && <img className="bs-prize" src={paint('things/egg-cushion')} alt="The Golden Egg" />}
        <button type="button" className="button button--play bs-play-button" onClick={onNext}>
          OK
        </button>
      </div>
    </div>
  );
}
