/**
 * Weka’s Stepping Stones (docs/WEKA-PLAN.md): each day, ten goes of doubles and halves at Weka's mirror pool. Each day's
 * first finish changes one magic pebble (bronze, then silver, then gold); thirty days win the Golden Fish, and a new
 * friend comes to a fresh pool. The screens only show what the backend says. Copied from Hop's Glow-worm Pond.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Tap } from '../../../shared/weka/play';
import { DAYS_PER_BASKET, STONES, streamAfter, type Help } from '../../../shared/weka/progress';
import type { Round } from '../../../shared/weka/round';
import type { HelpSetting } from '../../../shared/weka/server';
import { useSound } from '../../sound';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { finishLine, homeLine, VOICE_FOLDER } from './voiceLines';
import { playSound } from '../sounds';
import { FRIEND_NAMES, paint } from './art';
import { WekaError, type WekaBackend, type WekaFinish, type WekaState } from './backend';
import { Goes } from './Goes';
import { Fish } from './WekaArt';
import { Pool } from './Pool';
import { WORDS } from './words';
import './weka.css';

/** This game talks unless it's turned off: most of its players can't read yet. Remembered on this device. */
const VOICE_KEY = 'weka-voice';
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
  const say = useCallback((text: string) => on && speak(text, VOICE_FOLDER), [on]);
  return { on, setOn, say, available: canReadAloud() };
}

type Screen = { kind: 'loading' } | { kind: 'home' } | { kind: 'play'; round: Round } | { kind: 'finish'; result: WekaFinish };

export interface Helpers {
  reload: () => void;
}

interface Props {
  backend: WekaBackend;
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
      el.classList.remove('wk-root--cover');
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      const cover = top > 0 && window.innerHeight - top - 12 < ROOM_UNDER_BAR;
      el.classList.toggle('wk-root--cover', cover);
      el.style.setProperty('--wk-room', top === 0 || cover ? '100dvh' : `calc(100dvh - ${top + 12}px)`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [root]);
}

export function WekaGame({ backend, onExit, extra }: Props) {
  const [state, setState] = useState<WekaState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [failed, setFailed] = useState<string | null>(null);
  const fail = useCallback((e: unknown) => setFailed(e instanceof WekaError ? e.message : WORDS.wentWrong), []);
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
      setState((s) => s && { ...s, daysDone: result.daysDone, lastStoneDay: result.lastStoneDay, level: result.level });
      setScreen({ kind: 'finish', result });
      if (soundOn) playSound(result.goldenBasket ? 'win' : 'badge');
    }, fail);

  let body: ReactNode;
  if (failed) body = <p className="wk-message">{failed}</p>;
  else if (!state || screen.kind === 'loading') body = <p className="wk-message">…</p>;
  else if (screen.kind === 'play') {
    const pool = streamAfter(state.daysDone);
    body = (
      <Goes
        round={screen.round}
        help={helpFor(pool.help, state.help)}
        scenery={pool.today}
        friend={pool.friend}
        guide={state.daysDone === 0 && state.lastStoneDay === null}
        sound={soundOn}
        say={voice.say}
        onDone={(taps) => done(screen.round.seed, taps)}
      />
    );
  } else if (screen.kind === 'finish') body = <Finish result={screen.result} say={voice.say} onNext={() => setScreen({ kind: 'home' })} />;
  else body = <Home state={state} say={voice.say} onPlay={play} />;

  return (
    <div className="wk-root" ref={root}>
      <div className="wk-bar">
        {onExit && (
          <button type="button" className="wk-button" onClick={onExit}>
            <span aria-hidden="true">🏠</span> {WORDS.home}
          </button>
        )}
        {voice.available && (
          <button type="button" className="wk-button" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)}>
            <span aria-hidden="true">{voice.on ? '🗣️' : '🤫'}</span> {voice.on ? WORDS.voiceOn : WORDS.voiceOff}
          </button>
        )}
      </div>
      {body}
      {extra?.({ reload })}
    </div>
  );
}

/** The teacher's help setting on top of the pebbles' fading help. */
const helpFor = (today: Help, setting: HelpSetting): Help => (setting === 'always' ? 'full' : setting === 'off' ? 'none' : today);

function Home({ state, say, onPlay }: { state: WekaState; say: (t: string) => void; onPlay: () => void }) {
  const pool = streamAfter(state.daysDone);
  const name = FRIEND_NAMES[pool.friend];
  const doneToday = state.lastStoneDay === state.today;
  const title = pool.day === 0 && pool.fish > 0 ? WORDS.nextFriend(name) : WORDS.wants(name);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(homeLine(title, doneToday));
  }, [say, doneToday, title]);
  return (
    <div className="wk-home">
      <Pool scenery={pool.today} pebbles={pool.pebbles.map((metal) => ({ metal }))} friend={pool.friend} pose="wait" />
      <div className="wk-panel">
        <h2 tabIndex={-1} ref={heading}>{title}</h2>
        <p className="wk-day">{WORDS.dayCount(Math.min(pool.day + 1, DAYS_PER_BASKET))}</p>
        <p className="wk-chip">{WORDS.level(state.level)}</p>
        {doneToday && <p>{WORDS.doneToday}</p>}
        <button type="button" className="button button--play wk-play-button" onClick={onPlay}>
          {doneToday ? WORDS.playAgain : WORDS.play}
        </button>
        {pool.fish > 0 && (
          <p className="wk-shelf" aria-label={WORDS.fishWon(pool.fish)}>
            {Array.from({ length: pool.fish }, (_, i) => <span key={i} className="wk-shelf__fish"><Fish golden /></span>)}
          </p>
        )}
      </div>
    </div>
  );
}

/** A pebble changes colour, or, on the thirtieth day, the Golden Fish is won. */
function Finish({ result, say, onNext }: { result: WekaFinish; say: (t: string) => void; onNext: () => void }) {
  // On a Golden Fish day the new pool has already started, so show the one just finished: every pebble gold.
  const pool = streamAfter(result.goldenBasket ? result.daysDone - 1 : result.daysDone);
  const pebbles = result.goldenBasket
    ? Array.from({ length: STONES }, () => ({ metal: 'gold' as const, glow: true }))
    : pool.pebbles.map((metal, i) => ({ metal, glow: i === result.stoneChanged }));
  const changed = result.stoneChanged === null ? null : pebbles[result.stoneChanged].metal;
  const name = FRIEND_NAMES[pool.friend];
  const main = result.goldenBasket ? WORDS.goldenBasket(name) : changed ? WORDS.pebbleTurned(changed) : WORDS.doneToday;
  const up = result.level !== result.levelBefore ? result.level : null;
  const line = finishLine(main, up);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(line);
  }, [say, line]);
  const cushion = paint('things/golden-fish-cushion');
  return (
    <div className={`wk-home${result.goldenBasket ? ' wk-home--prize' : ''}`}>
      <Pool scenery={result.goldenBasket ? 'gold' : pool.today} pebbles={pebbles} friend={pool.friend} pose="cheer" />
      <div className="wk-panel">
        <h2 tabIndex={-1} ref={heading}>{main}</h2>
        {up && <p className="wk-chip">{WORDS.levelUp(up)}</p>}
        {result.goldenBasket && (cushion ? <img className="wk-prize" src={cushion} alt="The Golden Fish" /> : <span className="wk-prize" role="img" aria-label="The Golden Fish"><Fish golden /></span>)}
        <button type="button" className="button button--play wk-play-button" onClick={onNext}>
          OK
        </button>
      </div>
    </div>
  );
}
