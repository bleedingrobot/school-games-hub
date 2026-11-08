/**
 * Tūī’s Ten Tree (docs/TUI-PLAN.md): each day, ten goes at the Ten Tree, seeing teen numbers as ten and some more.
 * Each day's first finish turns one kōwhai flower (bronze, then silver, then gold); thirty days win the Golden Nest,
 * and a new friend gets a Ten Tree. The screens only show what the backend says. Copied from Weka's Stepping Stones.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { NextPartChip } from '../../components/NextPartChip';
import { fetchWekaEnabled } from '../../data/weka';
import type { Tap } from '../../../shared/tui/play';
import { DAYS_PER_NEST, FLOWERS, FRIEND_NAMES, treeAfter, type Friend as FriendName, type Metal } from '../../../shared/tui/progress';
import type { Round } from '../../../shared/tui/round';
import { useSound } from '../../sound';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { playSound } from '../sounds';
import { WhatsNext } from '../../kit/WhatsNext';
import { backFor, Flower, Friend, GoldenNest, type Pose, type Scenery } from './art';
import { TuiError, type TuiBackend, type TuiFinish, type TuiState } from './backend';
import { Goes } from './Goes';
import { finishLine, homeLine, VOICE_FOLDER } from './voiceLines';
import { WORDS } from './words';
import './tui.css';

/** This game talks unless it's turned off: most of its players can't read yet. Remembered on this device. */
const VOICE_KEY = 'tui-voice';
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

type Screen = { kind: 'loading' } | { kind: 'home' } | { kind: 'play'; round: Round } | { kind: 'finish'; result: TuiFinish };

export interface Helpers {
  reload: () => void;
}

interface Props {
  backend: TuiBackend;
  /** Back to the hub's home page (the preview has none). */
  onExit?: () => void;
  /** Opens Weka's Stepping Stones from the "what's next" card (the hub's game page). */
  onOpenWeka?: () => void;
  /** Preview tools, shown over the game. */
  extra?: (h: Helpers) => ReactNode;
}

/** Below this much room under the hub's top bar, the game covers the whole screen, bar and all (as Weka does). */
const ROOM_UNDER_BAR = 420;
function useFitBelow(root: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const fit = () => {
      el.classList.remove('tui-root--cover');
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
      const cover = top > 0 && window.innerHeight - top - 12 < ROOM_UNDER_BAR;
      el.classList.toggle('tui-root--cover', cover);
      el.style.setProperty('--tui-room', top === 0 || cover ? '100dvh' : `calc(100dvh - ${top + 12}px)`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [root]);
}

export function TuiGame({ backend, onExit, onOpenWeka, extra }: Props) {
  const [state, setState] = useState<TuiState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [failed, setFailed] = useState<string | null>(null);
  const fail = useCallback((e: unknown) => setFailed(e instanceof TuiError ? e.message : WORDS.wentWrong), []);
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
      setState((s) => s && { ...s, daysDone: result.daysDone, lastFlowerDay: result.lastFlowerDay, step: result.step, level: result.level });
      setScreen({ kind: 'finish', result });
      if (soundOn) playSound(result.goldenNest ? 'win' : 'badge');
    }, fail);

  let body: ReactNode;
  if (failed) body = <p className="tui-message">{failed}</p>;
  else if (!state || screen.kind === 'loading') body = <p className="tui-message">…</p>;
  else if (screen.kind === 'play') {
    const tree = treeAfter(state.daysDone);
    body = (
      <Goes
        round={screen.round}
        scenery={tree.today}
        friend={tree.friend}
        seen={state.seen}
        onSeen={(kinds) => {
          setState((s) => s && { ...s, seen: [...new Set([...s.seen, ...kinds])] });
          return backend.markSeen(kinds);
        }}
        guide={state.daysDone === 0 && state.lastFlowerDay === null}
        // The gold-day finale, on the day's first challenge only.
        finale={tree.today === 'gold' && state.lastFlowerDay !== state.today}
        sound={soundOn}
        say={voice.say}
        onDone={(taps) => done(screen.round.seed, taps)}
      />
    );
  } else if (screen.kind === 'finish') body = <Finish result={screen.result} say={voice.say} onOpenWeka={onOpenWeka} onNext={() => setScreen({ kind: 'home' })} />;
  else body = <Home state={state} say={voice.say} onPlay={play} />;

  return (
    <div className="tui-root" ref={root}>
      <div className="tui-bar">
        {onExit && (
          <button type="button" className="tui-button" onClick={onExit}>
            <span aria-hidden="true">🏠</span> {WORDS.home}
          </button>
        )}
        {voice.available && (
          <button type="button" className="tui-button" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)}>
            <span aria-hidden="true">{voice.on ? '🗣️' : '🤫'}</span> {voice.on ? WORDS.voiceOn : WORDS.voiceOff}
          </button>
        )}
      </div>
      {body}
      {extra?.({ reload })}
    </div>
  );
}

/** The Ten Tree on the home and finish screens: ten kōwhai flowers along the branch, and the friend filling up. */
function Tree({ scenery, flowers, friend, pose }: { scenery: Scenery; flowers: { metal: Metal; glow?: boolean }[]; friend: FriendName; pose: Pose }) {
  return (
    <div className={`tui-tree tui-scene--${scenery}`} style={backFor(scenery)}>
      <div className="tui-tree__flowers" role="img" aria-label={`${flowers.filter((f) => f.metal !== 'bud').length} of ${FLOWERS} flowers changed`}>
        {flowers.map((f, i) => (
          <span key={i} className="tui-tree__spot">
            <Flower metal={f.metal} glow={f.glow} />
          </span>
        ))}
      </div>
      <span className="tui-tree__friend">
        <Friend friend={friend} pose={pose} />
      </span>
    </div>
  );
}

function Home({ state, say, onPlay }: { state: TuiState; say: (t: string) => void; onPlay: () => void }) {
  const tree = treeAfter(state.daysDone);
  const name = FRIEND_NAMES[tree.friend];
  const doneToday = state.lastFlowerDay === state.today;
  const title = tree.day === 0 && tree.nests > 0 ? WORDS.nextFriend(name) : WORDS.wants(name);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(homeLine(title, doneToday));
  }, [say, doneToday, title]);
  return (
    <div className="tui-home">
      <Tree scenery={tree.today} flowers={tree.flowers.map((metal) => ({ metal }))} friend={tree.friend} pose="sit" />
      <div className="tui-panel">
        <h2 tabIndex={-1} ref={heading}>{title}</h2>
        <p className="tui-day">{WORDS.dayCount(Math.min(tree.day + 1, DAYS_PER_NEST))}</p>
        <NextPartChip noun={WORDS.part} done={doneToday} onHear={say} />
        <p className="tui-chip">{WORDS.step(state.step)}</p>
        {doneToday && <p>{WORDS.doneToday}</p>}
        <button type="button" className="button button--play tui-play-button" onClick={onPlay}>
          {doneToday ? WORDS.playAgain : WORDS.play}
        </button>
        {tree.nests > 0 && (
          <p className="tui-shelf" aria-label={WORDS.nestsWon(tree.nests)}>
            {Array.from({ length: tree.nests }, (_, i) => <span key={i} className="tui-shelf__nest"><GoldenNest /></span>)}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A flower changes colour, or, on the thirtieth day, the Golden Nest is won. With the top step secure and Weka on for the
 * class, the "what's next" card (R8) follows: its line is read after the finish line, and its button opens Weka.
 */
export function Finish({ result, say, onOpenWeka, onNext }: { result: TuiFinish; say: (t: string, onEnd?: () => void) => void; onOpenWeka?: () => void; onNext: () => void }) {
  // On a Golden Nest day the new tree has already started, so show the one just finished: every flower gold.
  const tree = treeAfter(result.goldenNest ? result.daysDone - 1 : result.daysDone);
  const flowers = result.goldenNest
    ? Array.from({ length: FLOWERS }, () => ({ metal: 'gold' as const, glow: true }))
    : tree.flowers.map((metal, i) => ({ metal, glow: i === result.flowerChanged }));
  const changed = result.flowerChanged === null ? null : flowers[result.flowerChanged].metal;
  const name = FRIEND_NAMES[tree.friend];
  const main = result.goldenNest ? WORDS.goldenNest(name) : changed ? WORDS.flowerTurned(changed) : WORDS.doneToday;
  const up = result.step !== result.stepBefore ? result.step : null;
  const line = finishLine(main, up);
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
  return (
    <div className={`tui-home${result.goldenNest ? ' tui-home--prize' : ''}`}>
      <Tree scenery={result.goldenNest ? 'gold' : tree.today} flowers={flowers} friend={tree.friend} pose="cheer" />
      {wekaOn !== null && (
        <WhatsNext prefix="tui" title={main} spoken={line} note={up ? WORDS.nextStep(up) : null} buttonLabel="OK" say={sayThen} onNext={onNext}>
          {result.goldenNest && <span className="tui-prize"><GoldenNest cushion /></span>}
          {card && (
            <div className="tui-next-game">
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
