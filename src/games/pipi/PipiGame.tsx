/**
 * Pipi's Hidden Shells (docs/PIPI-PLAN.md): each day, ten goes finding how many pipi are hiding in the sand. Each day's
 * first finish changes one magic shell along the high-tide line (bronze, then silver, then gold); thirty days win the
 * Golden Pearl, and a new friend's beach starts. The screens only show what the backend says.
 */
import { NextPartChip } from '../../components/NextPartChip';
import { fetchBeanstalkEnabled } from '../../data/beanstalk';
import { finishBand } from '../../../shared/kit/finishBand';
import { WhatsNext } from '../../kit/WhatsNext';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Tap } from '../../../shared/pipi/play';
import { beachAfter, DAYS_PER_PEARL, SHELLS } from '../../../shared/pipi/progress';
import type { Round } from '../../../shared/pipi/round';
import { useSound } from '../../sound';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { playSound } from '../sounds';
import { FRIEND_NAMES } from './art';
import { PipiError, type PipiBackend, type PipiFinish, type PipiState } from './backend';
import { Beach } from './Beach';
import { Goes } from './Goes';
import { Pearl } from './PipiArt';
import { finishLine, homeLine, PART_BREAK, VOICE_FOLDER } from './voiceLines';
import { WORDS } from './words';
import './pipi.css';

/** This game talks unless it's turned off: most of its players can't read yet. Remembered on this device. */
const VOICE_KEY = 'pipi-voice';
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
  // Bella's recorded clips (public/voice/pipi/), the same voice as Kiwi's Beanstalk.
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

type Screen = { kind: 'loading' } | { kind: 'home' } | { kind: 'play'; round: Round } | { kind: 'finish'; result: PipiFinish };

export interface Helpers {
  reload: () => void;
}

interface Props {
  backend: PipiBackend;
  /** Back to the hub's home page (the preview has none). */
  onExit?: () => void;
  /** Opens Kiwi's Beanstalk (the finish screen's "what's next" card); the preview has none. */
  onOpenBeanstalk?: () => void;
  /** Preview tools, shown over the game. */
  extra?: (h: Helpers) => ReactNode;
}

/** Below this much room under the hub's top bar, the game covers the whole screen, bar and all (as Beanstalk and Hop do). */
const ROOM_UNDER_BAR = 420;
function useFitBelow(root: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const fit = () => {
      el.classList.remove('pp-root--cover');
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      const cover = top > 0 && window.innerHeight - top - 12 < ROOM_UNDER_BAR;
      el.classList.toggle('pp-root--cover', cover);
      el.style.setProperty('--pp-room', top === 0 || cover ? '100dvh' : `calc(100dvh - ${top + 12}px)`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [root]);
}

export function PipiGame({ backend, onExit, onOpenBeanstalk, extra }: Props) {
  const [state, setState] = useState<PipiState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [failed, setFailed] = useState<string | null>(null);
  const fail = useCallback((e: unknown) => setFailed(e instanceof PipiError ? e.message : WORDS.wentWrong), []);
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
      setState((s) => s && { ...s, daysDone: result.daysDone, lastShellDay: result.lastShellDay, level: result.level, guided: false });
      setScreen({ kind: 'finish', result });
      if (soundOn) playSound(result.pearl ? 'win' : 'badge');
    }, fail);

  let body: ReactNode;
  if (failed) body = <p className="pp-message">{failed}</p>;
  else if (!state || screen.kind === 'loading') body = <p className="pp-message">…</p>;
  else if (screen.kind === 'play') {
    const beach = beachAfter(state.daysDone);
    body = (
      <Goes
        round={screen.round}
        help={beach.help}
        helpOn={state.help}
        scenery={beach.today}
        friend={beach.friend}
        guide={state.guided}
        seen={state.seen ?? []}
        onSeen={(kinds) => {
          setState((st) => st && { ...st, seen: [...new Set([...(st.seen ?? []), ...kinds])] });
          return backend.markSeen(kinds);
        }}
        sound={soundOn}
        say={voice.say}
        onDone={(taps) => done(screen.round.seed, taps)}
      />
    );
  } else if (screen.kind === 'finish') body = <Finish result={screen.result} say={voice.say} onOpenBeanstalk={onOpenBeanstalk} onNext={() => setScreen({ kind: 'home' })} />;
  else body = <Home state={state} say={voice.say} onPlay={play} />;

  return (
    <div className="pp-root" ref={root}>
      <div className="pp-bar">
        {onExit && (
          <button type="button" className="pp-button" onClick={onExit}>
            <span aria-hidden="true">🏠</span> {WORDS.home}
          </button>
        )}
        {voice.available && (
          <button type="button" className="pp-button" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)}>
            <span aria-hidden="true">{voice.on ? '🗣️' : '🤫'}</span> {voice.on ? WORDS.voiceOn : WORDS.voiceOff}
          </button>
        )}
      </div>
      {body}
      {extra?.({ reload })}
    </div>
  );
}

function Home({ state, say, onPlay }: { state: PipiState; say: (t: string) => void; onPlay: () => void }) {
  const beach = beachAfter(state.daysDone);
  const name = FRIEND_NAMES[beach.friend];
  const doneToday = state.lastShellDay === state.today;
  const title = beach.day === 0 && beach.pearls > 0 ? WORDS.nextFriend(name) : WORDS.wants(name);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(homeLine(title, doneToday));
  }, [say, doneToday, title]);
  return (
    <div className="pp-home">
      <Beach scenery={beach.today} shells={beach.shells.map((metal) => ({ metal }))} friend={beach.friend} pose="wave" />
      <div className="pp-panel">
        <p className="pp-title">{WORDS.title}</p>
        <h2 tabIndex={-1} ref={heading}>{title}</h2>
        <p className="pp-day">{WORDS.dayCount(Math.min(beach.day + 1, DAYS_PER_PEARL))}</p>
        <NextPartChip noun={WORDS.part} done={doneToday} onHear={say} />
        <p className="pp-chip">{WORDS.level(state.level)}</p>
        {doneToday && <p>{WORDS.doneToday}</p>}
        <button type="button" className="button button--play pp-play-button" onClick={onPlay}>
          {doneToday ? WORDS.playAgain : WORDS.play}
        </button>
        {beach.pearls > 0 && (
          <p className="pp-shelf" aria-label={WORDS.pearls(beach.pearls)}>
            {Array.from({ length: beach.pearls }, (_, i) => <Pearl key={i} />)}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A magic shell changes colour, or, on the thirtieth day, the Golden Pearl is won. With the top level secure and Kiwi's
 * Beanstalk on for the class, the "what's next" card follows: its line is read after the finish line, and its button opens
 * Kiwi's Beanstalk.
 */
export function Finish({ result, say, onOpenBeanstalk, onNext }: { result: PipiFinish; say: (t: string, onEnd?: () => void) => void; onOpenBeanstalk?: () => void; onNext: () => void }) {
  // On a pearl day the new beach has already started, so show the one just finished: every shell gold.
  const beach = beachAfter(result.pearl ? result.daysDone - 1 : result.daysDone);
  const shells = result.pearl
    ? Array.from({ length: SHELLS }, () => ({ metal: 'gold' as const, glow: true }))
    : beach.shells.map((metal, i) => ({ metal, glow: i === result.shellChanged }));
  const changed = result.shellChanged === null ? null : shells[result.shellChanged].metal;
  const name = FRIEND_NAMES[beach.friend];
  // How the day went (S33): the opening, then what turned. The day counts whatever the band, so the shell still turns; a pearl day
  // keeps its prize title and the opening goes in the chip. A reply without the number reads as a middle day.
  const band = finishBand(result.firstRight ?? 5);
  const opening = WORDS.how[band];
  const tail = result.pearl ? null : changed ? WORDS.shellTurned(changed) : WORDS.doneToday;
  const main = tail === null ? WORDS.pearl(name) : `${opening} ${tail}`;
  const moved = result.level !== result.levelBefore;
  const levelUp = moved ? WORDS.levelUp(result.level) : null;
  const line = finishLine(tail === null ? [main, opening] : [opening, tail], band === 'tricky', moved ? result.level : null);
  // Kiwi's Beanstalk's switch is read once the card could show (top level secure, not a level-up day); until then the panel waits,
  // so the line is not said twice.
  const [beanstalkOn, setBeanstalkOn] = useState<boolean | null>(result.topSecure && !moved && onOpenBeanstalk ? null : false);
  useEffect(() => {
    if (beanstalkOn !== null) return;
    let current = true;
    fetchBeanstalkEnabled().then((v) => current && setBeanstalkOn(v), () => current && setBeanstalkOn(false));
    return () => {
      current = false;
    };
  }, [beanstalkOn]);
  const card = beanstalkOn === true;
  const sayThen = useCallback((text: string) => say(text, card ? () => say(WORDS.whatsNext) : undefined), [say, card]);
  return (
    <div className={`pp-home${result.pearl ? ' pp-home--pearl' : ''}`}>
      <Beach scenery={result.pearl ? 'gold' : beach.today} shells={shells} friend={beach.friend} pose="cheer" />
      {beanstalkOn !== null && (
        <WhatsNext prefix="pp" title={main} spoken={line} note={levelUp} buttonLabel="OK" say={sayThen} onNext={onNext}>
          {result.pearl && <p className="pp-chip">{opening}</p>}
          {band === 'tricky' && <p className="pp-chip">{WORDS.trickyChip}</p>}
          {result.pearl && (
            <span className="pp-prize" role="img" aria-label="The Golden Pearl">
              <Pearl cushion />
            </span>
          )}
          {card && (
            <div className="pp-next-game">
              <p>{WORDS.whatsNext}</p>
              <button type="button" className="button button--play" onClick={onOpenBeanstalk}>
                {WORDS.tryBeanstalk}
              </button>
            </div>
          )}
        </WhatsNext>
      )}
    </div>
  );
}
