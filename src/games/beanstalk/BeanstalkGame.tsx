/**
 * Kiwi's Beanstalk (docs/BEANSTALK-PLAN.md): choose Jack or Jill, then each day make ten pairs that add to 10. Each day's
 * first finish changes one magic leaf (bronze, then silver, then gold); thirty days bring the friend down and win the
 * Golden Egg, and the next friend is stuck on a fresh beanstalk. The screens only show what the backend says.
 */
import { NextPartChip } from '../../components/NextPartChip';
import { WhatsNext } from '../../kit/WhatsNext';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { DAYS_PER_EGG, LEAVES_ON_STALK, METALS, shownDots, stalkAfter, type FinishResult } from '../../../shared/beanstalk/progress';
import type { Tap } from '../../../shared/beanstalk/round';
import { SIGNPOST_FROM, type Signpost } from './signpost';
import { useSound } from '../../sound';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { playSound } from '../sounds';
import { childArt, FRIEND_NAMES, paint } from './art';
import { BeanstalkError, type BeanstalkBackend, type BeanstalkState, type Child } from './backend';
import { Round } from './Round';
import { Scene } from './Scene';
import { homeLine, VOICE_FOLDER } from './voiceLines';
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
  const say = useCallback((text: string, onEnd?: () => void) => {
    if (on) speak(text, VOICE_FOLDER, onEnd);
    else onEnd?.();
  }, [on]);
  return { on, setOn, say, available: canReadAloud() };
}

/** The first challenge on a new 100 or 1000 beanstalk: the hand comes back, with a line bridging from bonds to 10 (maths review R4). */
function newBigStalk(daysDone: number): boolean {
  const stalk = stalkAfter(daysDone);
  return stalk.eggs > 0 && stalk.day === 0 && stalk.target > 10;
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
  /** Back to the hub's home page (the preview has none). */
  onExit?: () => void;
  /** The finish screen's card on to Weka (maths review R8). Without it (a preview with no Weka) there is no card. */
  signpost?: Signpost;
  /** Preview tools, shown under the game. */
  extra?: (h: Helpers) => ReactNode;
}

/** Below this much room under the hub's top bar, the game covers the whole screen, bar and all. */
const ROOM_UNDER_BAR = 420;

/**
 * In the hub the game sits under the top bar, so a full screen tall would push its bottom (the floating leaves) off the
 * screen. This sets --bs-room to the height left below where the game starts (the whole screen in the preview). On a short
 * screen (a phone on its side) that would leave too little, so the game covers the whole screen (the bar is fixed at the
 * top, so scrolling wouldn't move it); its own Home button takes the child back.
 */
function useFitBelow(root: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const fit = () => {
      el.classList.remove('bs-root--cover');
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      const cover = top > 0 && window.innerHeight - top - 12 < ROOM_UNDER_BAR;
      el.classList.toggle('bs-root--cover', cover);
      el.style.setProperty('--bs-room', top === 0 || cover ? '100dvh' : `calc(100dvh - ${top + 12}px)`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [root]);
}

export function BeanstalkGame({ backend, onExit, signpost, extra }: Props) {
  const [state, setState] = useState<BeanstalkState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [failed, setFailed] = useState<string | null>(null);
  // The server's own words for a refusal (the game switched off, say); anything else is a plain "went wrong".
  const fail = useCallback((e: unknown) => setFailed(e instanceof BeanstalkError ? e.message : WORDS.wentWrong), []);
  const voice = useVoice();
  const { soundOn } = useSound();
  const root = useRef<HTMLDivElement>(null);
  useFitBelow(root);

  const reload = useCallback(() => {
    backend
      .load()
      .then((s) => {
        setState(s);
        setScreen(s.child ? { kind: 'home' } : { kind: 'choose' });
      })
      .catch(fail);
  }, [backend, fail]);
  useEffect(reload, [reload]);

  const choose = (child: Child) => backend.choose(child).then(reload, fail);
  const play = () => backend.start().then(({ seed }) => setScreen({ kind: 'play', seed }), fail);
  const done = (seed: number, taps: Tap[]) =>
    backend.finish(seed, taps).then(
      (result) => {
        setState((s) => s && { ...s, daysDone: result.daysDone, lastLeafDay: result.lastLeafDay, help: result.help });
        setScreen({ kind: 'finish', result });
        if (soundOn) playSound(result.egg ? 'win' : 'badge');
      },
      fail,
    );

  let body: ReactNode;
  if (failed) body = <p className="bs-message">{failed}</p>;
  else if (!state || screen.kind === 'loading') body = <p className="bs-message">…</p>;
  else if (screen.kind === 'choose') body = <Choose say={voice.say} onChoose={choose} />;
  else if (screen.kind === 'play' && state.child)
    body = (
      <Round
        seed={screen.seed}
        dots={shownDots(state.help, state.dots)}
        canBoost={state.dots}
        stalkLeaves={stalkAfter(state.daysDone).leaves}
        trayMetal={METALS[Math.floor(stalkAfter(state.daysDone).day / LEAVES_ON_STALK)]}
        friend={stalkAfter(state.daysDone).friend}
        target={stalkAfter(state.daysDone).target}
        child={state.child}
        guide={(state.daysDone === 0 && state.lastLeafDay === null) || newBigStalk(state.daysDone)}
        bridge={newBigStalk(state.daysDone)}
        sound={soundOn}
        say={voice.say}
        onDone={(taps) => done(screen.seed, taps)}
      />
    );
  else if (screen.kind === 'finish' && state.child)
    body = <Finish result={screen.result} child={state.child} say={voice.say} signpost={signpost} onNext={() => setScreen({ kind: 'home' })} />;
  else body = <Home state={state} say={voice.say} onPlay={play} />;

  return (
    <div className="bs-root" ref={root}>
      <div className="bs-bar">
        {onExit && (
          <button type="button" className="bs-voice" onClick={onExit}>
            <span aria-hidden="true">🏠</span> {WORDS.home}
          </button>
        )}
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
  const title = stalk.day === 0 && stalk.eggs > 0 ? WORDS.nextFriend(name, stalk.target) : WORDS.stuck(name, stalk.target);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(homeLine(title, doneToday));
  }, [say, doneToday, title]);
  return (
    <div className="bs-home">
      <Scene grow={1} leaves={stalk.leaves.map((metal) => ({ metal }))} friend={stalk.friend} friendPose="wait" child={state.child} childPose="wave" />
      <div className="bs-panel">
        <h2 tabIndex={-1} ref={heading}>{title}</h2>
        <p className="bs-day">{WORDS.dayCount(Math.min(stalk.day + 1, DAYS_PER_EGG))}</p>
        <NextPartChip noun={WORDS.part} done={doneToday} onHear={say} />
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
function Finish({ result, child, say, signpost, onNext }: { result: FinishResult; child: Child; say: (t: string, onEnd?: () => void) => void; signpost?: Signpost; onNext: () => void }) {
  // On an egg day the new beanstalk has already started, so show the one just finished: every leaf gold.
  const stalk = stalkAfter(result.egg ? result.daysDone - 1 : result.daysDone);
  const leaves = result.egg
    ? Array.from({ length: LEAVES_ON_STALK }, () => ({ metal: 'gold' as const, glow: true }))
    : stalk.leaves.map((metal, i) => ({ metal, glow: i === result.leafChanged }));
  const changed = result.leafChanged === null ? null : leaves[result.leafChanged].metal;
  const name = FRIEND_NAMES[stalk.friend];
  const text = result.egg ? WORDS.egg(name) : changed ? WORDS.leafTurned(changed) : WORDS.doneToday;
  const heading = useRef<HTMLHeadingElement>(null);
  // The card comes once today's line has been heard (it reads its own line aloud, so it would cut this one off).
  const [heard, setHeard] = useState(false);
  const [secure, setSecure] = useState(false);
  const wekaOn = signpost?.wekaOn === true;
  useEffect(() => {
    heading.current?.focus();
    say(text, () => setHeard(true));
  }, [say, text]);
  useEffect(() => {
    if (!signpost || !wekaOn || stalk.target < SIGNPOST_FROM) return;
    let current = true;
    signpost.secure(stalk.target).then((v) => current && setSecure(v), () => undefined);
    return () => {
      current = false;
    };
  }, [signpost, wekaOn, stalk.target]);
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
        {signpost && wekaOn && secure && heard && (
          <WhatsNext prefix="bs-next" title={WORDS.nextTitle} buttonLabel={WORDS.nextButton} say={say} onNext={signpost.open} />
        )}
      </div>
    </div>
  );
}
