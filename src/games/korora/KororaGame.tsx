/**
 * Penguin Pairs (docs/KORORA-PLAN.md): each day, ten goes of doubles and halves with Two-Shoes the penguin. Each day's
 * first finish changes one magic stepping stone across the water (bronze, then silver, then gold); each crossing wins a
 * pair of dancing shoes (bronze, silver, then dazzling gold after thirty days), and then a new friend comes to a fresh
 * pool. The screens only show what the backend says. Copied from Hop's Glow-worm Pond.
 */
import { NextPartChip } from '../../components/NextPartChip';
import { fetchWekaEnabled } from '../../data/weka';
import { WhatsNext } from '../../kit/WhatsNext';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Tap } from '../../../shared/korora/play';
import { DAYS_PER_FISH, PEBBLES, poolAfter } from '../../../shared/korora/progress';
import type { Round } from '../../../shared/korora/round';
import { useSound } from '../../sound';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { finishBand } from '../../../shared/kit/finishBand';
import { finishLine, homeLine, PART_BREAK, VOICE_FOLDER } from './voiceLines';
import { playSound } from '../sounds';
import { FRIEND_NAMES } from './art';
import { KororaError, type KororaBackend, type KororaFinish, type KororaState } from './backend';
import { Goes } from './Goes';
import { DancingShoes } from './KororaArt';
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

type Screen = { kind: 'loading' } | { kind: 'home' } | { kind: 'play'; round: Round } | { kind: 'finish'; result: KororaFinish };

export interface Helpers {
  reload: () => void;
}

interface Props {
  backend: KororaBackend;
  /** Back to the hub's home page (the preview has none). */
  onExit?: () => void;
  /** Opens Weka's Stepping Stones from the "what's next" card (the hub's game page). */
  onOpenWeka?: () => void;
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

export function KororaGame({ backend, onExit, onOpenWeka, extra }: Props) {
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
        help={pool.help}
        setting={state.help}
        scenery={pool.today}
        friend={pool.friend}
        guide={state.daysDone === 0 && state.lastPebbleDay === null}
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
  } else if (screen.kind === 'finish') body = <Finish result={screen.result} say={voice.say} onOpenWeka={onOpenWeka} onNext={() => setScreen({ kind: 'home' })} />;
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
      <Pool
        scenery={pool.today}
        pebbles={pool.pebbles.map((metal) => ({ metal }))}
        friend={pool.friend}
        pose="wait"
        at={(pool.day % PEBBLES) - 1}
        shoes={pool.today}
      />
      <div className="kr-panel">
        <h2 tabIndex={-1} ref={heading}>{title}</h2>
        <p className="kr-day">{WORDS.dayCount(Math.min(pool.day + 1, DAYS_PER_FISH))}</p>
        <NextPartChip noun={WORDS.part} done={doneToday} onHear={say} />
        <p className="kr-chip">{WORDS.level(state.level)}</p>
        {doneToday && <p>{WORDS.doneToday}</p>}
        <button type="button" className="button button--play kr-play-button" onClick={onPlay}>
          {doneToday ? WORDS.playAgain : WORDS.play}
        </button>
        <Shelf gold={pool.fish} best={pool.shoes} />
      </div>
    </div>
  );
}

/** The dancing shoes won so far: every pair of gold ones, and the best pair at this pool. */
function Shelf({ gold, best }: { gold: number; best: 'bronze' | 'silver' | null }) {
  if (!gold && !best) return null;
  const label = [gold ? WORDS.goldShoesWon(gold) : null, best ? WORDS.shoesName(best) : null].filter(Boolean).join(', ');
  return (
    <p className="kr-shelf" aria-label={label}>
      {Array.from({ length: gold }, (_, i) => <span key={i} className="kr-shelf__shoes"><DancingShoes metal="gold" /></span>)}
      {best && <span className="kr-shelf__shoes"><DancingShoes metal={best} /></span>}
    </p>
  );
}

/**
 * A stepping stone changes colour, or, at the end of a crossing, a pair of dancing shoes is won. With near doubles secure
 * and Weka on for the class, the "what's next" card (R8) follows: its line is read after the finish line, and its button
 * opens Weka.
 */
export function Finish({ result, say, onOpenWeka, onNext }: { result: KororaFinish; say: (t: string, onEnd?: () => void) => void; onOpenWeka?: () => void; onNext: () => void }) {
  // On a gold shoes day the new pool has already started, so show the one just finished: every stone gold.
  const pool = poolAfter(result.goldenFish ? result.daysDone - 1 : result.daysDone);
  const pebbles = result.goldenFish
    ? Array.from({ length: PEBBLES }, () => ({ metal: 'gold' as const, glow: true }))
    : pool.pebbles.map((metal, i) => ({ metal, glow: i === result.pebbleChanged }));
  const changed = result.pebbleChanged === null ? null : pebbles[result.pebbleChanged].metal;
  const name = FRIEND_NAMES[pool.friend];
  const won = result.shoesWon;
  // How the day went (S33): the opening, then what turned. The day counts whatever the band, so the stone still turns; a shoes day
  // keeps its prize title and the opening goes in the chip. A reply without the number reads as a middle day.
  const band = finishBand(result.firstRight ?? 5);
  const opening = WORDS.how[band];
  const tail = won ? null : changed ? WORDS.pebbleTurned(changed) : WORDS.doneToday;
  const main = tail === null ? WORDS.shoesWon(won!, name) : `${opening} ${tail}`;
  const up = result.level !== result.levelBefore ? result.level : null;
  const line = finishLine(tail === null ? [main, opening] : [opening, tail], band === 'tricky', up);
  // Weka's switch is read once the card could show; until then the panel waits, so the line is not said twice.
  const [wekaOn, setWekaOn] = useState<boolean | null>(result.topSecure && onOpenWeka ? null : false);
  useEffect(() => {
    if (wekaOn !== null) return;
    let current = true;
    fetchWekaEnabled().then((v) => current && setWekaOn(v), () => current && setWekaOn(false));
    return () => {
      current = false;
    };
  }, [wekaOn]);
  const card = wekaOn === true;
  const sayThen = useCallback((text: string) => say(text, card ? () => say(WORDS.whatsNext) : undefined), [say, card]);
  // Before the walk: on the stone that just changed (or where they were). After a crossing: on the far bank.
  const at = won ? PEBBLES : result.pebbleChanged ?? (pool.day % PEBBLES) - 1;
  const scenery = result.goldenFish ? 'gold' : won ? (won as 'bronze' | 'silver') : pool.today;
  return (
    <div className={`kr-home${won ? ' kr-home--prize' : ''}`}>
      <Pool scenery={scenery} pebbles={pebbles} friend={pool.friend} pose="cheer" at={at} shoes={won ? null : pool.today} />
      {wekaOn !== null && (
        <WhatsNext prefix="kr" title={main} spoken={line} note={up ? WORDS.levelUp(up) : null} buttonLabel="OK" say={sayThen} onNext={onNext}>
          {won && <p className="kr-chip">{opening}</p>}
          {band === 'tricky' && <p className="kr-chip">{WORDS.trickyChip}</p>}
          {won && (
            <span className={`kr-prize kr-prize--${won}`} role="img" aria-label={WORDS.shoesName(won)}>
              <DancingShoes metal={won} />
            </span>
          )}
          {card && (
            <div className="kr-next-game">
              <p>{WORDS.whatsNext}</p>
              <button type="button" className="button button--play" onClick={onOpenWeka}>
                {WORDS.tryWeka}
              </button>
            </div>
          )}
        </WhatsNext>
      )}
    </div>
  );
}
