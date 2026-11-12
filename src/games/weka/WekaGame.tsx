/**
 * Weka’s Stepping Stones (docs/WEKA-PLAN.md): each day, ten goes across the stream, adding by making ten. Each day's
 * first finish changes one magic stone on the far bank (bronze, then silver, then gold); thirty days win the Golden
 * Picnic Basket, and a new friend comes to a fresh stream. The screens only show what the backend says. Copied from
 * Penguin Pairs.
 */
import { NextPartChip } from '../../components/NextPartChip';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Tap } from '../../../shared/weka/play';
import { DAYS_PER_BASKET, STONES, streamAfter } from '../../../shared/weka/progress';
import type { Round } from '../../../shared/weka/round';
import { WhatsNext } from '../../kit/WhatsNext';
import { useSound } from '../../sound';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { finishBand } from '../../../shared/kit/finishBand';
import { finishLine, homeLine, PART_BREAK, VOICE_FOLDER } from './voiceLines';
import { playSound } from '../sounds';
import { FRIEND_NAMES, paint } from './art';
import { WekaError, type WekaBackend, type WekaFinish, type WekaState } from './backend';
import { Goes } from './Goes';
import { Basket } from './WekaArt';
import { Stream } from './Stream';
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
  /** Says a text; a text of several parts (joined by PART_BREAK) is said one part after another, each from its own clip. */
  const say = useCallback((text: string, onEnd?: () => void) => {
    if (!on) {
      onEnd?.();
      return;
    }
    const parts = text.split(PART_BREAK);
    const from = (i: number): void => speak(parts[i], VOICE_FOLDER, i === parts.length - 1 ? onEnd : () => from(i + 1));
    from(0);
  }, [on]);
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
    const stream = streamAfter(state.daysDone);
    body = (
      <Goes
        round={screen.round}
        setting={state.help}
        scenery={screen.round.day}
        friend={stream.friend}
        guide={state.daysDone === 0 && state.lastStoneDay === null}
        seen={state.seen}
        onSeen={(kinds) => {
          setState((s) => s && { ...s, seen: [...new Set([...s.seen, ...kinds])] });
          return backend.markSeen(kinds);
        }}
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

function Home({ state, say, onPlay }: { state: WekaState; say: (t: string) => void; onPlay: () => void }) {
  const stream = streamAfter(state.daysDone);
  const name = FRIEND_NAMES[stream.friend];
  const doneToday = state.lastStoneDay === state.today;
  const title = stream.day === 0 && stream.baskets > 0 ? WORDS.nextFriend(name) : WORDS.wants(name);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(homeLine(title, doneToday));
  }, [say, doneToday, title]);
  return (
    <div className="wk-home">
      <Stream scenery={stream.today} stones={stream.stones.map((metal) => ({ metal }))} friend={stream.friend} pose="wait" />
      <div className="wk-panel">
        <h2 tabIndex={-1} ref={heading}>{title}</h2>
        <p className="wk-day">{WORDS.dayCount(Math.min(stream.day + 1, DAYS_PER_BASKET))}</p>
        <NextPartChip noun={WORDS.part} done={doneToday} onHear={say} />
        <p className="wk-chip">{WORDS.level(state.level)}</p>
        {doneToday && <p>{WORDS.doneToday}</p>}
        <button type="button" className="button button--play wk-play-button" onClick={onPlay}>
          {doneToday ? WORDS.playAgain : WORDS.play}
        </button>
        {stream.baskets > 0 && (
          <p className="wk-shelf" aria-label={WORDS.basketsWon(stream.baskets)}>
            {Array.from({ length: stream.baskets }, (_, i) => <span key={i} className="wk-shelf__basket"><Basket /></span>)}
          </p>
        )}
      </div>
    </div>
  );
}

/** A stone changes colour, or, on the thirtieth day, the Golden Picnic Basket is won. */
function Finish({ result, say, onNext }: { result: WekaFinish; say: (t: string, onEnd?: () => void) => void; onNext: () => void }) {
  // On a Golden Picnic Basket day the new stream has already started, so show the one just finished: every stone gold.
  const stream = streamAfter(result.goldenBasket ? result.daysDone - 1 : result.daysDone);
  const stones = result.goldenBasket
    ? Array.from({ length: STONES }, () => ({ metal: 'gold' as const, glow: true }))
    : stream.stones.map((metal, i) => ({ metal, glow: i === result.stoneChanged }));
  const changed = result.stoneChanged === null ? null : stones[result.stoneChanged].metal;
  const name = FRIEND_NAMES[stream.friend];
  // How the day went (S33): the opening, then what turned. The day counts whatever the band, so the stone still turns; a golden day
  // keeps its prize title and the opening goes in the chip. A reply without the number reads as a middle day.
  const band = finishBand(result.firstRight ?? 5);
  const opening = WORDS.how[band];
  const tail = result.goldenBasket ? null : changed ? WORDS.stoneTurned(changed) : WORDS.doneToday;
  const main = tail === null ? WORDS.goldenBasket(name) : `${opening} ${tail}`;
  const up = result.level !== result.levelBefore ? result.level : null;
  const line = finishLine(tail === null ? [main, opening] : [opening, tail], band === 'tricky', up);
  const cushion = paint('things/golden-basket-cushion');
  return (
    <div className={`wk-home${result.goldenBasket ? ' wk-home--prize' : ''}`}>
      <Stream scenery={result.goldenBasket ? 'gold' : stream.today} stones={stones} friend={stream.friend} pose="cheer" />
      <WhatsNext prefix="wk" wearMe={result.goldenBasket} title={main} spoken={line} note={up ? WORDS.levelUp(up) : null} buttonLabel="OK" say={say} onNext={onNext}>
        {result.goldenBasket && <p className="wk-chip">{opening}</p>}
        {band === 'tricky' && <p className="wk-chip">{WORDS.trickyChip}</p>}
        {result.goldenBasket && (cushion ? <img className="wk-prize" src={cushion} alt="The Golden Picnic Basket" /> : <span className="wk-prize" role="img" aria-label="The Golden Picnic Basket"><Basket /></span>)}
      </WhatsNext>
    </div>
  );
}
