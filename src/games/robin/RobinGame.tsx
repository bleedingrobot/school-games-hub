/**
 * Robin’s Berry Basket (docs/ROBIN-PLAN.md): each day, ten goes at counting out a set for Robin: giving exactly N berries,
 * saying how many there are, and one more. Each day's first finish turns one of ten baskets on the log (plain, then bronze,
 * silver and gold); thirty days win the Golden Berry Feast, and a friend comes for berries. The screens only show what the
 * backend says. Built on the shape of Parrot's See-saw.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { NextPartChip } from '../../components/NextPartChip';
import { FRIEND_NAMES, type Friend as FriendName } from '../../../shared/robin/config';
import type { Tap } from '../../../shared/robin/play';
import { DAYS_PER_FEAST, basketsAfter, type Metal } from '../../../shared/robin/progress';
import type { Round } from '../../../shared/robin/round';
import { FirstTimeTip } from '../../kit/FirstTimeTip';
import { WhatsNext } from '../../kit/WhatsNext';
import { useSound } from '../../sound';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { playSound } from '../sounds';
import { BasketLog, Bird, Friend, GoldenFeast, sceneStyle } from './art';
import { RobinError, type RobinBackend, type RobinFinish, type RobinState } from './backend';
import { Goes } from './Goes';
import { finishLine, homeLine, PART_BREAK, VOICE_FOLDER } from './voiceLines';
import { WORDS } from './words';
import './robin.css';

/** This game talks unless it's turned off: most of its players can't read yet. Remembered on this device. */
const VOICE_KEY = 'robin-voice';
const TIP_KEY = 'robin-tip-seen';

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

type Screen = { kind: 'loading' } | { kind: 'home' } | { kind: 'play'; round: Round } | { kind: 'finish'; result: RobinFinish };

export interface Helpers {
  reload: () => void;
}

interface Props {
  backend: RobinBackend;
  /** Back to the hub's home page (the preview has none). */
  onExit?: () => void;
  /** Preview tools, shown over the game. */
  extra?: (h: Helpers) => ReactNode;
}

/** Below this much room under the hub's top bar, the game covers the whole screen, bar and all (as Tūī does). */
const ROOM_UNDER_BAR = 420;
function useFitBelow(root: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const fit = () => {
      el.classList.remove('rb-root--cover');
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      const cover = top > 0 && window.innerHeight - top - 12 < ROOM_UNDER_BAR;
      el.classList.toggle('rb-root--cover', cover);
      el.style.setProperty('--rb-room', top === 0 || cover ? '100dvh' : `calc(100dvh - ${top + 12}px)`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [root]);
}

export function RobinGame({ backend, onExit, extra }: Props) {
  const [state, setState] = useState<RobinState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [failed, setFailed] = useState<string | null>(null);
  const fail = useCallback((e: unknown) => setFailed(e instanceof RobinError ? e.message : WORDS.wentWrong), []);
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
      if (soundOn) playSound(result.feast ? 'win' : 'badge');
    }, fail);

  let body: ReactNode;
  if (failed) body = <p className="rb-message">{failed}</p>;
  else if (!state || screen.kind === 'loading') body = <p className="rb-message">…</p>;
  else if (screen.kind === 'play') {
    const row = basketsAfter(state.daysDone);
    body = (
      <Goes
        round={screen.round}
        friend={row.friend}
        guide={state.daysDone === 0 && state.lastDay === null}
        sound={soundOn}
        say={voice.say}
        seenKinds={state.seen}
        saveSeen={(kinds) => {
          // Kept in the state too, so playing again in the same sitting remembers.
          setState((s) => s && { ...s, seen: [...new Set([...s.seen, ...kinds])] });
          return backend.markSeen(kinds);
        }}
        onDone={(taps) => done(screen.round.seed, taps)}
      />
    );
  } else if (screen.kind === 'finish') body = <Finish result={screen.result} say={voice.say} onNext={() => setScreen({ kind: 'home' })} />;
  else body = <Home state={state} say={voice.say} onPlay={play} />;

  return (
    <div className="rb-root" ref={root}>
      <div className="rb-bar">
        {onExit && (
          <button type="button" className="rb-button" onClick={onExit}>
            <span aria-hidden="true">🏠</span> {WORDS.home}
          </button>
        )}
        {voice.available && (
          <button type="button" className="rb-button" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)}>
            <span aria-hidden="true">{voice.on ? '🗣️' : '🤫'}</span> {voice.on ? WORDS.voiceOn : WORDS.voiceOff}
          </button>
        )}
      </div>
      {body}
      {extra?.({ reload })}
    </div>
  );
}

/** The log on the home and finish screens: ten baskets, and who is picking berries. */
function Log({ baskets, friend, glowAt = null, pose }: { baskets: { metal: Metal }[]; friend: FriendName; glowAt?: number | null; pose: 'sit' | 'cheer' }) {
  return (
    <div className="rb-logbox rb-scene" style={sceneStyle()}>
      <BasketLog baskets={baskets} glowAt={glowAt} />
      <span className="rb-logbox__friend">
        <Friend friend={friend} pose={pose} />
      </span>
    </div>
  );
}

function readTipSeen(): boolean {
  try {
    return localStorage.getItem(TIP_KEY) === 'yes';
  } catch {
    return false;
  }
}

function Home({ state, say, onPlay }: { state: RobinState; say: (t: string) => void; onPlay: () => void }) {
  const row = basketsAfter(state.daysDone);
  const name = FRIEND_NAMES[row.friend];
  const doneToday = state.lastDay === state.today;
  const title = row.day === 0 && row.feasts > 0 ? WORDS.nextFriend(name) : WORDS.wants(name);
  const heading = useRef<HTMLHeadingElement>(null);
  // A child's very first day: Robin says hello first, in two short tips.
  const first = state.daysDone === 0 && state.lastDay === null;
  const [tipAt, setTipAt] = useState<number | null>(() => (first && !readTipSeen() ? 0 : null));
  const closeTip = () => {
    setTipAt(null);
    try {
      localStorage.setItem(TIP_KEY, 'yes');
    } catch {
      // Storage blocked: the tip may show again.
    }
  };
  useEffect(() => {
    heading.current?.focus();
    say(tipAt !== null ? WORDS.tip[tipAt] : homeLine(title, doneToday));
  }, [say, doneToday, title, tipAt]);
  return (
    <div className="rb-home">
      <Log baskets={row.baskets.map((metal) => ({ metal }))} friend={row.friend} pose="sit" />
      <div className="rb-panel">
        {tipAt !== null && (
          <FirstTimeTip
            prefix="rb"
            who={WORDS.tipName}
            face={<span className="rb-tip__face"><Bird friend="robin" /></span>}
            say={WORDS.tip[tipAt]}
            n={tipAt}
            of={WORDS.tip.length}
            inline
            nextLabel={WORDS.tipNext}
            lastLabel={WORDS.tipLast}
            closeLabel={WORDS.tipClose}
            onNext={() => setTipAt(tipAt + 1)}
            onClose={closeTip}
          />
        )}
        <h2 tabIndex={-1} ref={heading}>{title}</h2>
        <p className="rb-day">{WORDS.dayCount(Math.min(row.day + 1, DAYS_PER_FEAST))}</p>
        <NextPartChip noun={WORDS.part} done={doneToday} onHear={say} />
        <p className="rb-chip">{WORDS.step(state.step)}</p>
        <button type="button" className="button button--play rb-play-button" onClick={onPlay}>
          {doneToday ? WORDS.playAgain : WORDS.play}
        </button>
        <button type="button" className="rb-button rb-hear-home" onClick={() => say(homeLine(title, doneToday))}>
          <span aria-hidden="true">👂</span> {WORDS.hearAgain}
        </button>
        <button type="button" className="rb-button rb-hear-home" onClick={() => setTipAt(0)}>
          <span aria-hidden="true">🎓</span> {WORDS.replayGuide}
        </button>
        {row.feasts > 0 && (
          <p className="rb-shelf" aria-label={WORDS.feastsWon(row.feasts)}>
            {Array.from({ length: row.feasts }, (_, i) => <span key={i} className="rb-shelf__feast"><GoldenFeast /></span>)}
          </p>
        )}
      </div>
    </div>
  );
}

/** A basket changes colour, or, on the thirtieth day, the Golden Berry Feast is won; and what changes next time. */
function Finish({ result, say, onNext }: { result: RobinFinish; say: (t: string) => void; onNext: () => void }) {
  // On a Golden Berry Feast day the next set of baskets has already started, so show the one just finished: every basket gold.
  const row = basketsAfter(result.feast ? result.daysDone - 1 : result.daysDone);
  const things = result.feast ? row.baskets.map(() => ({ metal: 'gold' as const })) : row.baskets.map((metal) => ({ metal }));
  const changed = result.changed === null ? null : things[result.changed].metal;
  const name = FRIEND_NAMES[row.friend];
  const main = result.feast ? WORDS.goldenFeast(name) : changed ? WORDS.basketTurned(changed) : WORDS.doneToday;
  // What changes next time: a new step, or the help, or nothing.
  const next =
    result.step !== result.stepBefore ? WORDS.nextStep(result.step)
    : result.level < result.levelBefore ? WORDS.lessHelp
    : result.level > result.levelBefore ? WORDS.moreHelp
    : WORDS.sameAgain;
  // "Show me" lights the button that moves on (the next-step line is always there, and never chooses for the child).
  const [showing, setShowing] = useState(false);
  return (
    <div className={`rb-home${result.feast ? ' rb-home--prize' : ''}${showing ? ' rb-showing' : ''}`}>
      <Log baskets={things} friend={row.friend} glowAt={result.changed} pose="cheer" />
      <WhatsNext prefix="rb" title={main} spoken={finishLine(main, next)} note={next} buttonLabel={WORDS.ok} say={say} onNext={onNext}>
        {result.feast && <span className="rb-prize"><GoldenFeast /></span>}
        <button type="button" className="rb-button rb-showme" onClick={() => { setShowing(true); say(WORDS.pressOk); }}>
          <span aria-hidden="true">👉</span> {WORDS.showMe}
        </button>
      </WhatsNext>
    </div>
  );
}
