/**
 * Penguin Pairs (docs/KORORA-PLAN.md): each day, ten goes of doubles and halves at Kororā's mirror pool. Each day's
 * first finish changes one magic pebble (bronze, then silver, then gold); thirty days win the Golden Fish, and a new
 * friend comes to a fresh pool. The screens only show what the backend says. Copied from Hop's Glow-worm Pond.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Tap } from '../../../shared/korora/play';
import { DAYS_PER_FISH, PEBBLES, poolAfter, type Help } from '../../../shared/korora/progress';
import type { Round } from '../../../shared/korora/round';
import type { HelpSetting } from '../../../shared/korora/server';
import { useSound } from '../../sound';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { finishLine, homeLine, VOICE_FOLDER } from './voiceLines';
import { playSound } from '../sounds';
import { FRIEND_NAMES, paint } from './art';
import { KororaError, type KororaBackend, type KororaFinish, type KororaState } from './backend';
import { Goes } from './Goes';
import { Fish } from './KororaArt';
import { Pool } from './Pool';
import { WORDS } from './words';
import './korora.css';

/** This game talks unless it's turned off: most of its players can't read yet. Remembered on this device. */
const VOICE_KEY = 'korora-voice';
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

type Screen = { kind: 'loading' } | { kind: 'home' } | { kind: 'play'; round: Round } | { kind: 'finish'; result: KororaFinish };

export interface Helpers {
  reload: () => void;
}

interface Props {
  backend: KororaBackend;
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
      el.classList.remove('kr-root--cover');
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      const cover = top > 0 && window.innerHeight - top - 12 < ROOM_UNDER_BAR;
      el.classList.toggle('kr-root--cover', cover);
      el.style.setProperty('--kr-room', top === 0 || cover ? '100dvh' : `calc(100dvh - ${top + 12}px)`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [root]);
}

export function KororaGame({ backend, onExit, extra }: Props) {
  const [state, setState] = useState<KororaState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [failed, setFailed] = useState<string | null>(null);
  const fail = useCallback((e: unknown) => setFailed(e instanceof KororaError ? e.message : WORDS.wentWrong), []);
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
      setState((s) => s && { ...s, daysDone: result.daysDone, lastPebbleDay: result.lastPebbleDay, level: result.level });
      setScreen({ kind: 'finish', result });
      if (soundOn) playSound(result.goldenFish ? 'win' : 'badge');
    }, fail);

  let body: ReactNode;
  if (failed) body = <p className="kr-message">{failed}</p>;
  else if (!state || screen.kind === 'loading') body = <p className="kr-message">…</p>;
  else if (screen.kind === 'play') {
    const pool = poolAfter(state.daysDone);
    body = (
      <Goes
        round={screen.round}
        help={helpFor(pool.help, state.help)}
        scenery={pool.today}
        friend={pool.friend}
        guide={state.daysDone === 0 && state.lastPebbleDay === null}
        sound={soundOn}
        say={voice.say}
        onDone={(taps) => done(screen.round.seed, taps)}
      />
    );
  } else if (screen.kind === 'finish') body = <Finish result={screen.result} say={voice.say} onNext={() => setScreen({ kind: 'home' })} />;
  else body = <Home state={state} say={voice.say} onPlay={play} />;

  return (
    <div className="kr-root" ref={root}>
      <div className="kr-bar">
        {onExit && (
          <button type="button" className="kr-button" onClick={onExit}>
            <span aria-hidden="true">🏠</span> {WORDS.home}
          </button>
        )}
        {voice.available && (
          <button type="button" className="kr-button" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)}>
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

function Home({ state, say, onPlay }: { state: KororaState; say: (t: string) => void; onPlay: () => void }) {
  const pool = poolAfter(state.daysDone);
  const name = FRIEND_NAMES[pool.friend];
  const doneToday = state.lastPebbleDay === state.today;
  const title = pool.day === 0 && pool.fish > 0 ? WORDS.nextFriend(name) : WORDS.wants(name);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(homeLine(title, doneToday));
  }, [say, doneToday, title]);
  return (
    <div className="kr-home">
      <Pool scenery={pool.today} pebbles={pool.pebbles.map((metal) => ({ metal }))} friend={pool.friend} pose="wait" />
      <div className="kr-panel">
        <h2 tabIndex={-1} ref={heading}>{title}</h2>
        <p className="kr-day">{WORDS.dayCount(Math.min(pool.day + 1, DAYS_PER_FISH))}</p>
        <p className="kr-chip">{WORDS.level(state.level)}</p>
        {doneToday && <p>{WORDS.doneToday}</p>}
        <button type="button" className="button button--play kr-play-button" onClick={onPlay}>
          {doneToday ? WORDS.playAgain : WORDS.play}
        </button>
        {pool.fish > 0 && (
          <p className="kr-shelf" aria-label={WORDS.fishWon(pool.fish)}>
            {Array.from({ length: pool.fish }, (_, i) => <span key={i} className="kr-shelf__fish"><Fish golden /></span>)}
          </p>
        )}
      </div>
    </div>
  );
}

/** A pebble changes colour, or, on the thirtieth day, the Golden Fish is won. */
function Finish({ result, say, onNext }: { result: KororaFinish; say: (t: string) => void; onNext: () => void }) {
  // On a Golden Fish day the new pool has already started, so show the one just finished: every pebble gold.
  const pool = poolAfter(result.goldenFish ? result.daysDone - 1 : result.daysDone);
  const pebbles = result.goldenFish
    ? Array.from({ length: PEBBLES }, () => ({ metal: 'gold' as const, glow: true }))
    : pool.pebbles.map((metal, i) => ({ metal, glow: i === result.pebbleChanged }));
  const changed = result.pebbleChanged === null ? null : pebbles[result.pebbleChanged].metal;
  const name = FRIEND_NAMES[pool.friend];
  const main = result.goldenFish ? WORDS.goldenFish(name) : changed ? WORDS.pebbleTurned(changed) : WORDS.doneToday;
  const up = result.level !== result.levelBefore ? result.level : null;
  const line = finishLine(main, up);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(line);
  }, [say, line]);
  const cushion = paint('things/golden-fish-cushion');
  return (
    <div className={`kr-home${result.goldenFish ? ' kr-home--prize' : ''}`}>
      <Pool scenery={result.goldenFish ? 'gold' : pool.today} pebbles={pebbles} friend={pool.friend} pose="cheer" />
      <div className="kr-panel">
        <h2 tabIndex={-1} ref={heading}>{main}</h2>
        {up && <p className="kr-chip">{WORDS.levelUp(up)}</p>}
        {result.goldenFish && (cushion ? <img className="kr-prize" src={cushion} alt="The Golden Fish" /> : <span className="kr-prize" role="img" aria-label="The Golden Fish"><Fish golden /></span>)}
        <button type="button" className="button button--play kr-play-button" onClick={onNext}>
          OK
        </button>
      </div>
    </div>
  );
}
