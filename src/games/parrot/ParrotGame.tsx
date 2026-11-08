/**
 * Parrot’s See-saw (docs/plans/maths-review/new-games/N2-balance.md): each day, ten goes at keeping Parrot's see-saw level,
 * finding the missing number in an equation. Each day's first finish turns one of ten shiny things on the bell rope (bud,
 * then bronze, silver and gold); thirty days win the Golden Bell, and a friend gets a see-saw. The screens only show what
 * the backend says. Built on the shape of Tūī’s Ten Tree.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { NextPartChip } from '../../components/NextPartChip';
import { FRIEND_NAMES, type Friend as FriendName } from '../../../shared/parrot/config';
import type { Tap } from '../../../shared/parrot/play';
import { DAYS_PER_BELL, ropeAfter } from '../../../shared/parrot/progress';
import type { Round } from '../../../shared/parrot/round';
import { FirstTimeTip } from '../../kit/FirstTimeTip';
import { WhatsNext } from '../../kit/WhatsNext';
import { useSound } from '../../sound';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { playSound } from '../sounds';
import { BellRope, Bird, Friend, GoldenBell, sceneStyle } from './art';
import { ParrotError, type ParrotBackend, type ParrotFinish, type ParrotState } from './backend';
import { Goes } from './Goes';
import { finishLine, homeLine, PART_BREAK, VOICE_FOLDER } from './voiceLines';
import { WORDS } from './words';
import './parrot.css';

/** This game talks unless it's turned off: most of its players can't read yet. Remembered on this device. */
const VOICE_KEY = 'parrot-voice';
const TIP_KEY = 'parrot-tip-seen';

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

type Screen = { kind: 'loading' } | { kind: 'home' } | { kind: 'play'; round: Round } | { kind: 'finish'; result: ParrotFinish };

export interface Helpers {
  reload: () => void;
}

interface Props {
  backend: ParrotBackend;
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
      el.classList.remove('pr-root--cover');
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      const cover = top > 0 && window.innerHeight - top - 12 < ROOM_UNDER_BAR;
      el.classList.toggle('pr-root--cover', cover);
      el.style.setProperty('--pr-room', top === 0 || cover ? '100dvh' : `calc(100dvh - ${top + 12}px)`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [root]);
}

export function ParrotGame({ backend, onExit, extra }: Props) {
  const [state, setState] = useState<ParrotState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [failed, setFailed] = useState<string | null>(null);
  const fail = useCallback((e: unknown) => setFailed(e instanceof ParrotError ? e.message : WORDS.wentWrong), []);
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
      if (soundOn) playSound(result.goldenBell ? 'win' : 'badge');
    }, fail);

  let body: ReactNode;
  if (failed) body = <p className="pr-message">{failed}</p>;
  else if (!state || screen.kind === 'loading') body = <p className="pr-message">…</p>;
  else if (screen.kind === 'play') {
    const rope = ropeAfter(state.daysDone);
    body = (
      <Goes
        round={screen.round}
        friend={rope.friend}
        guide={state.daysDone === 0 && state.lastDay === null}
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
    <div className="pr-root" ref={root}>
      <div className="pr-bar">
        {onExit && (
          <button type="button" className="pr-button" onClick={onExit}>
            <span aria-hidden="true">🏠</span> {WORDS.home}
          </button>
        )}
        {voice.available && (
          <button type="button" className="pr-button" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)}>
            <span aria-hidden="true">{voice.on ? '🗣️' : '🤫'}</span> {voice.on ? WORDS.voiceOn : WORDS.voiceOff}
          </button>
        )}
      </div>
      {body}
      {extra?.({ reload })}
    </div>
  );
}

/** The bell rope on the home and finish screens: ten shiny things, and whose see-saw it is. */
function Rope({ things, friend, glowAt = null, pose }: { things: { metal: 'bud' | 'bronze' | 'silver' | 'gold' }[]; friend: FriendName; glowAt?: number | null; pose: 'sit' | 'cheer' }) {
  return (
    <div className="pr-ropebox pr-scene" style={sceneStyle()}>
      <BellRope things={things} glowAt={glowAt} />
      <span className="pr-ropebox__friend">
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

function Home({ state, say, onPlay }: { state: ParrotState; say: (t: string) => void; onPlay: () => void }) {
  const rope = ropeAfter(state.daysDone);
  const name = FRIEND_NAMES[rope.friend];
  const doneToday = state.lastDay === state.today;
  const title = rope.day === 0 && rope.bells > 0 ? WORDS.nextFriend(name) : WORDS.wants(name);
  const heading = useRef<HTMLHeadingElement>(null);
  // A child's very first day: Parrot says hello first, in two short tips.
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
    <div className="pr-home">
      <Rope things={rope.things.map((metal) => ({ metal }))} friend={rope.friend} pose="sit" />
      <div className="pr-panel">
        {tipAt !== null && (
          <FirstTimeTip
            prefix="pr"
            who={WORDS.tipName}
            face={<span className="pr-tip__face"><Bird friend="parrot" /></span>}
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
        <p className="pr-day">{WORDS.dayCount(Math.min(rope.day + 1, DAYS_PER_BELL))}</p>
        <NextPartChip noun={WORDS.part} done={doneToday} onHear={say} />
        <p className="pr-chip">{WORDS.step(state.step)}</p>
        <button type="button" className="button button--play pr-play-button" onClick={onPlay}>
          {doneToday ? WORDS.playAgain : WORDS.play}
        </button>
        <button type="button" className="pr-button pr-hear-home" onClick={() => say(homeLine(title, doneToday))}>
          <span aria-hidden="true">👂</span> {WORDS.hearAgain}
        </button>
        {rope.bells > 0 && (
          <p className="pr-shelf" aria-label={WORDS.bellsWon(rope.bells)}>
            {Array.from({ length: rope.bells }, (_, i) => <span key={i} className="pr-shelf__bell"><GoldenBell /></span>)}
          </p>
        )}
      </div>
    </div>
  );
}

/** A shiny thing changes colour, or, on the thirtieth day, the Golden Bell is won; and what changes next time. */
function Finish({ result, say, onNext }: { result: ParrotFinish; say: (t: string) => void; onNext: () => void }) {
  // On a Golden Bell day the next rope has already started, so show the one just finished: every thing gold.
  const rope = ropeAfter(result.goldenBell ? result.daysDone - 1 : result.daysDone);
  const things = result.goldenBell ? rope.things.map(() => ({ metal: 'gold' as const })) : rope.things.map((metal) => ({ metal }));
  const changed = result.changed === null ? null : things[result.changed].metal;
  const name = FRIEND_NAMES[rope.friend];
  const main = result.goldenBell ? WORDS.goldenBell(name) : changed ? WORDS.thingTurned(changed) : WORDS.doneToday;
  // What changes next time: a new step, or the help, or nothing.
  const next =
    result.step !== result.stepBefore ? WORDS.nextStep(result.step)
    : result.level < result.levelBefore ? WORDS.lessHelp
    : result.level > result.levelBefore ? WORDS.moreHelp
    : WORDS.sameAgain;
  return (
    <div className={`pr-home${result.goldenBell ? ' pr-home--prize' : ''}`}>
      <Rope things={things} friend={rope.friend} glowAt={result.changed} pose="cheer" />
      <WhatsNext prefix="pr" title={main} spoken={finishLine(main, next)} note={next} buttonLabel={WORDS.ok} say={say} onNext={onNext}>
        {result.goldenBell && <span className="pr-prize"><GoldenBell /></span>}
      </WhatsNext>
    </div>
  );
}
