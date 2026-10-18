import { useEffect, useMemo, useRef, useState } from 'react';
import type { BotLevel } from '../../../shared/botGame';
import type { PowerClashGameReport } from '../../../shared/power-clash/save';
import {
  applyStudent, botLoadoutFor, botSide, encodeStudentAction, isBotTurn, isStudentTurn, matchIsOver, playOneBot, startSolo,
  type SoloGame,
} from '../../../shared/power-clash/solo';
import { BotLevelPicker } from '../../components/BotLevelPicker';
import {
  LOADOUT_SIZE, legalSkip, placeableSquares, play, powerBlockedReason, targetChoices, validLoadout,
} from '../../../shared/power-clash/engine';
import { newMatch, nextRound, scoreRound, ROUNDS_TO_WIN, type Match } from '../../../shared/power-clash/match';
import type { Action, GameEvent, Player, PowerClashState, PowerId } from '../../../shared/power-clash/types';
import { useSound } from '../../sound';
import { playSound } from '../sounds';
import {
  ChaosBanner, WildWheel, boardClasses, cellFx, cellLabel, chaosCountdown, describe, makeFx, particles, shoutKindFor, soundFor, swapVars, type Fx,
} from './fx';
import { PowerClashGuide } from './Guide';
import { BOT_NAMES, POWERS, TEXT, botLine, powerInfo, shout } from './text';
import './power-clash.css';

export { SOUNDS, cellFx, cellLabel, describe, particles, swapVars, type Fx } from './fx';

type Loadouts = Record<Player, PowerId[]>;
const DEFAULT_LOADOUTS: Loadouts = {
  X: ['body-swap', 'freeze-ray', 'board-wipe'],
  O: ['body-swap', 'freeze-ray', 'board-wipe'],
};

/** How long input stays locked while an animation plays (never more than about a second). */
export const LOCK_MS = 900;
export const LOCK_CALM_MS = 150;

/** How long the bot "thinks" before it moves (a short, visible moment), and with reduced motion just a blink. */
const BOT_THINK_MIN_MS = 600;
const BOT_THINK_SPREAD_MS = 400;
const BOT_THINK_CALM_MS = 150;

const MY_DEFAULT_POWERS: PowerId[] = ['body-swap', 'freeze-ray', 'board-wipe'];

/** How the page saves bot games. Missing in the stand-alone preview: every bot game is practice. */
export interface PowerClashSaving {
  /** A stamped seed from the server, or null if there isn't one (a practice game). */
  seed(): Promise<{ seed: string; stamp: string } | null>;
  save(report: PowerClashGameReport): Promise<{ countsForPoints?: boolean } | void>;
  /** Records a game left part-way. Must work while the page is closing. */
  abandon(report: PowerClashGameReport): void;
}

type SaveStatus = 'practice' | 'playing' | 'saving' | 'saved' | 'saved-no-points' | 'error';

/** A bot game in progress: the student's side and the bot's level. */
interface BotSession {
  side: Player;
  level: BotLevel;
}

/** A fresh seed for a game played on this device only. */
function newSeed(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `local-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export interface PowerClashProps {
  /** The bot level the page opens with. */
  level?: BotLevel;
  onLevelChange?: (level: BotLevel) => void;
  saving?: PowerClashSaving;
  /** Tests set this to 0 so the bot doesn't wait. */
  timeScale?: number;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query?.addEventListener) return;
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Two players on one screen, or one player against a bot. All the rules come from
 * shared/power-clash; this only shows them.
 *
 * A bot game is played through shared/power-clash/solo.ts, exactly the way the server
 * replays it: the bot's powers and every move come from the game's seed, so the server can
 * check a saved game. Before a game the page asks for a stamped seed; at the end it sends
 * the seed, the stamp, both sets of powers and the student's actions. No seed (no Wi-Fi, or
 * the stand-alone preview) means a practice game, and the page says so.
 */
export function PowerClashPlay({ level: levelProp = 'easy', onLevelChange, saving, timeScale = 1 }: PowerClashProps = {}) {
  const [loadouts, setLoadouts] = useState<Loadouts>(DEFAULT_LOADOUTS);
  const [mine, setMine] = useState<PowerId[]>(MY_DEFAULT_POWERS);
  const [mode, setMode] = useState<'pass' | 'bot'>('pass');
  const [chaos, setChaos] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [side, setSide] = useState<Player>('X');
  const [level, setLevel] = useState<BotLevel>(levelProp);
  const [bot, setBot] = useState<BotSession | null>(null);
  const [thinking, setThinking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('practice');
  const [saveMessage, setSaveMessage] = useState('');
  const [match, setMatch] = useState<Match | null>(null);
  const [selected, setSelected] = useState<{ power: PowerId; picked: number[] } | null>(null);
  const [message, setMessage] = useState('');
  const [fx, setFx] = useState<Fx | null>(null);
  const [busy, setBusy] = useState(false);
  const [shoutText, setShoutText] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButton = useRef<HTMLButtonElement>(null);
  const plays = useRef(0);
  const timers = useRef<number[]>([]);
  const botTimer = useRef<number | null>(null);
  const soloRef = useRef<SoloGame | null>(null);
  /** Goes up whenever a game is left or started, so a bot still "thinking" about an old game stops. */
  const keyRef = useRef(0);
  const actionsRef = useRef<string[]>([]);
  const stampRef = useRef<string | null>(null);
  /** Seeds already sent to the server (finished or left), so nothing is sent twice. */
  const sentRef = useRef(new Set<string>());
  const startingRef = useRef(false);
  const { soundOn } = useSound();
  const calm = useReducedMotion();
  const live = useRef({ soundOn, calm, timeScale });
  live.current = { soundOn, calm, timeScale };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
      if (e.key === '?') setHelpOpen(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      if (botTimer.current !== null) window.clearTimeout(botTimer.current);
    },
    [],
  );

  function reportFor(solo: SoloGame, ending: PowerClashGameReport['ending']): PowerClashGameReport | null {
    const stamp = stampRef.current;
    if (!stamp) return null;
    const { seed, level: botLevel, side: mySide, loadout } = solo.setup;
    const botPowers = botLoadoutFor(seed, botLevel);
    const loadouts = mySide === 'X' ? { X: loadout, O: botPowers } : { X: botPowers, O: loadout };
    return { game: 'power-clash', seed, stamp, level: botLevel, side: mySide, loadouts, actions: [...actionsRef.current], ending, chaos: solo.setup.chaos === true };
  }

  /** Saves the match as soon as the rules say it's over. */
  async function saveFinished(solo: SoloGame) {
    const report = reportFor(solo, 'finished');
    if (!saving || !report || sentRef.current.has(report.seed)) return;
    sentRef.current.add(report.seed);
    setSaveStatus('saving');
    try {
      const answer = await saving.save(report);
      if (soloRef.current === solo) setSaveStatus(answer && answer.countsForPoints === false ? 'saved-no-points' : 'saved');
    } catch (error) {
      if (soloRef.current !== solo) return;
      setSaveMessage(error instanceof Error && error.message ? error.message : 'We couldn’t save this game.');
      setSaveStatus('error');
    }
  }

  /** If the student leaves a match part-way (after doing something), it's recorded as left early. */
  const leftEarly = useRef(() => {});
  leftEarly.current = () => {
    const solo = soloRef.current;
    if (!saving || !solo || matchIsOver(solo) || actionsRef.current.length === 0) return;
    const report = reportFor(solo, 'abandoned');
    if (!report || sentRef.current.has(report.seed)) return;
    sentRef.current.add(report.seed);
    saving.abandon(report);
  };
  useEffect(() => {
    const onHide = () => leftEarly.current();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      onHide();
    };
  }, []);

  function stopBot() {
    keyRef.current++;
    if (botTimer.current !== null) window.clearTimeout(botTimer.current);
    botTimer.current = null;
    setThinking(false);
  }

  function leaveBotGame() {
    leftEarly.current();
    stopBot();
    soloRef.current = null;
    setBot(null);
  }

  /** The bot takes its turn after a short, visible think; then waits for the animation to finish before the next step. */
  function scheduleBot(extraMs = 0) {
    const solo = soloRef.current;
    const key = keyRef.current;
    if (!solo || !isBotTurn(solo)) {
      setThinking(false);
      return;
    }
    setThinking(true);
    const { calm: isCalm, timeScale: scale } = live.current;
    // Think for a moment, but never move while the last animation is still playing (extraMs is how long that is).
    const think = isCalm ? BOT_THINK_CALM_MS : BOT_THINK_MIN_MS + Math.random() * BOT_THINK_SPREAD_MS;
    const wait = Math.max(think, extraMs) * scale;
    botTimer.current = window.setTimeout(() => {
      if (key !== keyRef.current) return;
      const before = solo.match.state;
      const move = playOneBot(solo);
      if (!move) {
        setThinking(false);
        return;
      }
      present(before, move.events, solo.match, 'bot');
      if (matchIsOver(solo)) {
        setThinking(false);
        void saveFinished(solo);
      } else scheduleBot(live.current.calm ? LOCK_CALM_MS : LOCK_MS);
    }, wait);
  }

  const help = helpOpen ? <PowerClashGuide onClose={() => setHelpOpen(false)} returnTo={helpButton} /> : null;
  const helpBtn = (
    <button type="button" className="button button--light pc__help" ref={helpButton} onClick={() => setHelpOpen(true)}>
      How to play <kbd>?</kbd>
    </button>
  );

  async function startBotGame() {
    if (startingRef.current) return;
    leftEarly.current();
    stopBot();
    let stamped: { seed: string; stamp: string } | null = null;
    if (saving) {
      startingRef.current = true;
      setStarting(true);
      stamped = await saving.seed().catch(() => null);
      startingRef.current = false;
      setStarting(false);
    }
    const solo = startSolo({ seed: stamped?.seed ?? newSeed(), level, side, loadout: mine, chaos });
    soloRef.current = solo;
    stampRef.current = stamped?.stamp ?? null;
    actionsRef.current = [];
    setSaveStatus(stamped ? 'playing' : 'practice');
    setSaveMessage('');
    setBot({ side, level });
    setMatch(solo.match);
    setMessage('');
    setFx(null);
    setShoutText('');
    setSelected(null);
    setBusy(false);
    scheduleBot();
  }

  if (!match) {
    return (
      <>
        <Setup
          loadouts={loadouts}
          onChange={setLoadouts}
          helpButton={helpBtn}
          mode={mode}
          onMode={setMode}
          chaos={chaos}
          onChaos={setChaos}
          side={side}
          onSide={setSide}
          mine={mine}
          onMine={setMine}
          level={level}
          onLevel={(next) => {
            setLevel(next);
            onLevelChange?.(next);
          }}
          starting={starting}
          saves={!!saving}
          onStart={() => {
            setMessage('');
            setFx(null);
            setShoutText('');
            if (mode === 'bot') void startBotGame();
            else setMatch(newMatch(loadouts, 'X', chaos));
          }}
        />
        {help}
      </>
    );
  }

  const { state } = match;
  const over = state.status !== 'active';
  const me = state.active;
  const mySide = bot?.side ?? null;
  const foe: Player | null = mySide ? botSide({ side: mySide }) : null;
  /** The bot's turn: the student can't do anything. */
  const botTurn = !!bot && !over && state.active === foe;
  const locked = busy || botTurn;
  /** The short name in the score line: it has to fit on a phone. */
  const shortName = (p: Player) => (p === mySide ? 'You' : 'Bot');
  const nameOf = (p: Player) => (bot ? (p === mySide ? 'You' : BOT_NAMES[bot.level]) : `Player ${p}`);

  /** Shows what just happened: the message, animations, shouts and sound. The engine has already decided it. */
  function present(prev: PowerClashState, events: GameEvent[], scored: Match, actor: 'pass' | 'you' | 'bot') {
    setSelected(null);
    setMessage(actor === 'bot' ? botLine(events) : describe(events));
    setMatch(scored);
    plays.current += 1;
    setFx(makeFx(plays.current, prev, scored.state, events));

    const big = shoutKindFor(events, scored.winner !== null);
    setShoutText(big ? shout(big, plays.current) : '');

    if (live.current.soundOn) {
      const sound = soundFor(events);
      if (sound) playSound(sound);
    }

    setBusy(true);
    setOverlay(true);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [
      window.setTimeout(() => setBusy(false), (live.current.calm ? LOCK_CALM_MS : LOCK_MS) * live.current.timeScale),
      window.setTimeout(() => setShoutText(''), 1800),
      window.setTimeout(() => setOverlay(false), 2600),
    ];
  }

  function apply(action: Action) {
    if (bot) {
      const solo = soloRef.current;
      if (!solo || !isStudentTurn(solo)) return;
      const text = encodeStudentAction(action);
      const before = solo.match.state;
      let events: GameEvent[];
      try {
        events = applyStudent(solo, text);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'That is not allowed');
        return;
      }
      actionsRef.current.push(text);
      present(before, events, solo.match, 'you');
      if (matchIsOver(solo)) void saveFinished(solo);
      else scheduleBot(live.current.calm ? LOCK_CALM_MS : LOCK_MS);
      return;
    }
    // Two players on one screen: nothing to replay, so the dice are just random.
    const result = play(state, action, Math.random);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    present(state, result.events, scoreRound({ ...match!, state: result.state }), 'pass');
  }

  function nextRoundClicked() {
    const solo = soloRef.current;
    if (bot && solo) {
      applyStudent(solo, 'next');
      actionsRef.current.push('next');
      setMatch(solo.match);
      setMessage('');
      setFx(null);
      setShoutText('');
      scheduleBot();
      return;
    }
    setMatch(nextRound(match!));
    setMessage('');
    setFx(null);
    setShoutText('');
  }

  function choosePower(power: PowerId) {
    if (locked) return;
    if (selected?.power === power) {
      setSelected(null);
      return;
    }
    const reason = powerBlockedReason(state, power);
    if (reason) {
      setMessage(reason);
      return;
    }
    if (powerInfo(power).steps.length === 0) {
      apply({ type: 'use-power', power, targets: [] });
      return;
    }
    setMessage('');
    setSelected({ power, picked: [] });
  }

  function tapSquare(square: number) {
    if (over || locked) return;
    if (!selected) {
      apply({ type: 'place', square });
      return;
    }
    const picked = [...selected.picked, square];
    if (picked.length === powerInfo(selected.power).steps.length) {
      apply({ type: 'use-power', power: selected.power, targets: picked });
    } else {
      setSelected({ ...selected, picked });
    }
  }

  const choices = selected
    ? targetChoices(state, selected.power, selected.picked)
    : placeableSquares(state);
  const frozenNow = new Set(state.frozen.map((f) => f.square));

  let prompt: string;
  if (match.winner) prompt = bot ? (match.winner === mySide ? 'You win the match!' : `${nameOf(match.winner)} wins the match.`) : `Player ${match.winner} wins the match!`;
  else if (state.status === 'draw') prompt = 'A draw! Nobody wins this round.';
  else if (over) prompt = bot ? (state.status === mySide ? 'You win the round!' : `${nameOf(state.status as Player)} wins the round.`) : `Player ${state.status} wins the round!`;
  else if (botTurn) prompt = `${nameOf(me)} is thinking…`;
  else if (selected) prompt = powerInfo(selected.power).steps[selected.picked.length];
  else if (legalSkip(state)) prompt = bot ? 'Every square is frozen, so you miss your go.' : `Player ${me}: every square is frozen, so you miss your go.`;
  else {
    const who = bot ? 'Your go' : `Player ${me}`;
    if (state.placesLeft === 2) prompt = `${who}: place your first symbol (then one more!)`;
    else if (state.powerThisTurn) prompt = `${who}: now place your symbol`;
    else prompt = bot ? `${who}: pick a power or a square` : `${who}: use a power, or just place a symbol`;
  }

  const fxOf = (i: number) => cellFx(fx, i);
  const kinds = fx?.events.map((e) => e.kind) ?? [];
  const boardFx = boardClasses(fx);
  const shieldedNow = new Set(state.shields.map((sh) => sh.square));

  const saveNote: Record<SaveStatus, string> = {
    practice: 'Practice game: this one won’t be saved.',
    playing: 'This game will be saved when it’s over.',
    saving: 'Saving your game…',
    saved: 'Game saved. Thanks for playing!',
    'saved-no-points': 'Game saved.',
    error: saveMessage,
  };

  return (
    <section className={`pc ${calm ? 'pc--calm' : ''} ${state.chaos ? 'pc--chaos' : ''}`} aria-label={TEXT.name}>
      <header className="pc__top">
        <h1>{TEXT.name}</h1>
        {helpBtn}
        <p className="pc__score" aria-label="Score">
          <span className="pc__x">{bot ? shortName('X') : 'X'} {match.score.X}</span>
          <span className="pc__round">Round {match.round} · first to {ROUNDS_TO_WIN}</span>
          <span className="pc__o">{bot ? shortName('O') : 'O'} {match.score.O}</span>
        </p>
      </header>
      {state.chaos ? <p className="pc__chaosbadge">🌀 Chaos Mode: {over ? 'surprises make every round different' : chaosCountdown(state)}</p> : null}

      <div className="pc__table">
        <PowerPanel player="X" match={match} selected={selected} onChoose={choosePower} locked={locked} name={bot ? nameOf('X') : undefined} isBot={foe === 'X'} />
        <section className="pc__middle">
          <p className="pc__prompt" role="status" aria-live="polite">{prompt}</p>
          <p className="pc__shout" aria-hidden="true" key={fx?.key}>{shoutText}</p>
          <div className="pc__stage">
          <ChaosBanner fx={fx} show={overlay} />
          <WildWheel fx={fx} show={overlay} />
          <div className={`pc__board ${boardFx}`} role="group" aria-label="Board" aria-busy={locked || thinking}>
            {state.board.map((cell, i) => {
              const enabled = !over && !locked && choices.includes(i);
              const winning = state.line?.includes(i);
              const frozen = frozenNow.has(i) && cell === null;
              const chosen = selected?.picked.includes(i);
              const shielded = shieldedNow.has(i) && cell !== null;
              return (
                <button
                  type="button"
                  className={[
                    'pc__cell',
                    cell ? `pc__cell--${cell}` : '',
                    enabled ? 'pc__cell--open' : '',
                    enabled && selected ? 'pc__cell--target' : '',
                    winning ? 'pc__cell--win' : '',
                    frozen ? 'pc__cell--frozen' : '',
                    shielded ? 'pc__cell--shield' : '',
                    chosen ? 'pc__cell--chosen' : '',
                    fxOf(i),
                  ].join(' ')}
                  key={`${i}-${fx?.key ?? 0}`}
                  style={swapVars(fx, i)}
                  disabled={!enabled}
                  aria-label={cellLabel(i, cell, frozen, shielded)}
                  onClick={() => tapSquare(i)}
                >
                  {cell ?? ''}
                  {frozen ? <span className="pc__ice" aria-hidden="true">❄️</span> : null}
                  {shielded ? <span className="pc__shield" aria-hidden="true">🛡️</span> : null}
                  {fx?.wiped && kinds.includes('wipe') && fx.events.some((e) => e.kind === 'wipe' && e.square === i) ? (
                    <span className={`pc__fly pc__fly--${fx.wiped}`} aria-hidden="true">{fx.wiped}</span>
                  ) : null}
                  {!calm ? particles(fx, i) : null}
                </button>
              );
            })}
          </div>
          </div>
          <p className="pc__message" role="status" aria-live="polite">{message}</p>
          <div className="pc__actions">
            {selected ? (
              <button type="button" className="button button--light" onClick={() => setSelected(null)}>
                Cancel power
              </button>
            ) : null}
            {!over && legalSkip(state) && !botTurn ? (
              <button type="button" className="button button--primary" disabled={locked} onClick={() => apply({ type: 'skip' })}>
                Miss my go
              </button>
            ) : null}
            {over && !match.winner ? (
              <button type="button" className="button button--play" onClick={nextRoundClicked}>
                Next round
              </button>
            ) : null}
            {over ? (
              <button
                type="button"
                className="button button--light"
                onClick={() => {
                  setFx(null);
                  setShoutText('');
                  if (bot) {
                    if (match.winner) void startBotGame();
                    else {
                      leaveBotGame();
                      setMatch(null);
                    }
                    return;
                  }
                  if (match.winner) setMatch(newMatch(match.loadout, match.starter === 'X' ? 'O' : 'X', match.chaos));
                  else setMatch(null);
                }}
              >
                {match.winner ? 'Rematch' : 'Change powers'}
              </button>
            ) : null}
            {over && match.winner ? (
              <button
                type="button"
                className="button button--light"
                onClick={() => {
                  leaveBotGame();
                  setMatch(null);
                }}
              >
                Change powers
              </button>
            ) : null}
          </div>
        </section>
        <div className="pc__col">
          <PowerPanel player="O" match={match} selected={selected} onChoose={choosePower} locked={locked} name={bot ? nameOf('O') : undefined} isBot={foe === 'O'} />
          {bot ? (
            <div className="pc__extras">
              <p className="pc__save" role="status" aria-live="polite">{saveNote[saveStatus]}</p>
              {!over ? (
                <button
                  type="button"
                  className="button button--light pc__leave"
                  onClick={() => {
                    leaveBotGame();
                    setMatch(null);
                  }}
                >
                  Leave game
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {help}
    </section>
  );
}

export function PowerPanel({
  player, match, selected, onChoose, locked, name, isBot = false, readOnly = false, turnLabel,
}: {
  player: Player;
  match: Match;
  selected: { power: PowerId } | null;
  onChoose: (p: PowerId) => void;
  locked: boolean;
  /** In a bot game: "You" or the bot's name. */
  name?: string;
  isBot?: boolean;
  /** Someone else's powers: shown, but never pressable (a classmate's panel). */
  readOnly?: boolean;
  /** Replaces the "← your go" note when it is this panel's turn. */
  turnLabel?: string;
}) {
  const { state } = match;
  const myTurn = state.active === player && state.status === 'active';
  return (
    <aside className={`pc__panel pc__panel--${player} ${myTurn ? 'pc__panel--turn' : ''}`}>
      <h2>
        {name ? `${name} (${player})` : `Player ${player}`} {myTurn ? (turnLabel ?? (isBot ? '← thinking' : '← your go')) : ''}
      </h2>
      <ul>
        {state.loadout[player].map((id) => {
          const info = powerInfo(id);
          const spent = state.used[player].includes(id);
          const reason = myTurn && !isBot && !readOnly ? powerBlockedReason(state, id) : null;
          return (
            <li key={id}>
              <button
                type="button"
                className={`pc__power ${selected?.power === id && myTurn ? 'pc__power--on' : ''}`}
                disabled={!myTurn || spent || locked || readOnly}
                aria-pressed={selected?.power === id && myTurn}
                onClick={() => onChoose(id)}
                title={reason ?? info.blurb}
              >
                <span className="pc__power-icon" aria-hidden="true">{info.icon}</span>
                <span className="pc__power-name">{info.name}</span>
                <span className="pc__power-blurb">
                  {spent ? 'Used up' : reason && myTurn ? `Can’t use: ${reason}` : info.blurb}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function Setup({
  loadouts, onChange, onStart, helpButton, mode, onMode, chaos, onChaos, side, onSide, mine, onMine, level, onLevel, starting, saves,
}: {
  loadouts: Loadouts;
  onChange: (l: Loadouts) => void;
  onStart: () => void;
  helpButton: React.ReactNode;
  mode: 'pass' | 'bot';
  onMode: (m: 'pass' | 'bot') => void;
  chaos: boolean;
  onChaos: (on: boolean) => void;
  side: Player;
  onSide: (p: Player) => void;
  mine: PowerId[];
  onMine: (p: PowerId[]) => void;
  level: BotLevel;
  onLevel: (l: BotLevel) => void;
  starting: boolean;
  saves: boolean;
}) {
  const vsBot = mode === 'bot';
  const ready = vsBot ? validLoadout(mine) : validLoadout(loadouts.X) && validLoadout(loadouts.O);
  const players = useMemo<Player[]>(() => ['X', 'O'], []);
  const pickIn = (list: PowerId[], id: PowerId) =>
    list.includes(id) ? list.filter((p) => p !== id) : list.length < LOADOUT_SIZE ? [...list, id] : list;
  function toggle(player: Player, id: PowerId) {
    onChange({ ...loadouts, [player]: pickIn(loadouts[player], id) });
  }
  const panel = (key: string, title: string, className: string, list: PowerId[], onToggle: (id: PowerId) => void) => (
    <section key={key} className={`pc__panel ${className}`}>
      <h2>{title} ({list.length}/{LOADOUT_SIZE})</h2>
      <ul>
        {POWERS.map((info) => {
          const on = list.includes(info.id);
          return (
            <li key={info.id}>
              <button
                type="button"
                className={`pc__power ${on ? 'pc__power--on' : ''}`}
                aria-pressed={on}
                onClick={() => onToggle(info.id)}
              >
                <span className="pc__power-icon" aria-hidden="true">{info.icon}</span>
                <span className="pc__power-name">{info.name}</span>
                <span className="pc__power-blurb">{info.blurb}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
  return (
    <section className="pc pc--setup" aria-label={TEXT.name}>
      <h1>{TEXT.name}</h1>
      {helpButton}
      <fieldset className="pc__modes">
        <legend>How do you want to play?</legend>
        <button type="button" className={`pc__mode ${!vsBot ? 'pc__mode--on' : ''}`} aria-pressed={!vsBot} onClick={() => onMode('pass')}>
          Two players, one screen
        </button>
        <button type="button" className={`pc__mode ${vsBot ? 'pc__mode--on' : ''}`} aria-pressed={vsBot} onClick={() => onMode('bot')}>
          Play a bot
        </button>
      </fieldset>
      <fieldset className="pc__modes">
        <legend>Which rules?</legend>
        <button type="button" className={`pc__mode ${!chaos ? 'pc__mode--on' : ''}`} aria-pressed={!chaos} onClick={() => onChaos(false)}>
          Normal
        </button>
        <button type="button" className={`pc__mode pc__mode--chaos ${chaos ? 'pc__mode--on' : ''}`} aria-pressed={chaos} onClick={() => onChaos(true)}>
          🌀 Chaos Mode
        </button>
      </fieldset>
      {chaos ? (
        <p className="pc__lead pc__lead--chaos">
          <strong>Chaos Mode:</strong> after every third go, a surprise happens! An earthquake, a meteor, a frost wave, a lucky star or a recharge. Everything else works as normal.
        </p>
      ) : null}
      <p className="pc__lead">
        {vsBot ? 'You and a bot. ' : 'Two players, one screen. '}
        {vsBot ? 'Pick' : 'Each of you picks'} <strong>{LOADOUT_SIZE} different powers</strong>.
        Every power can be used <strong>once</strong>. Get three in a row, first to {ROUNDS_TO_WIN} rounds wins.
      </p>
      {vsBot ? (
        <div className="pc__botsetup">
          <div className="pc__botrow">
            <BotLevelPicker name="level-power-clash" legend="Bot level" value={level} onChange={onLevel} />
            <fieldset className="pc__modes">
              <legend>Your side</legend>
              {players.map((p) => (
                <button key={p} type="button" className={`pc__mode ${side === p ? 'pc__mode--on' : ''}`} aria-pressed={side === p} onClick={() => onSide(p)}>
                  {p === 'X' ? 'X (you go first)' : 'O (bot goes first)'}
                </button>
              ))}
            </fieldset>
          </div>
          <div className="pc__setup-cols pc__setup-cols--one">
            {panel('mine', 'Pick your powers', `pc__panel--${side}`, mine, (id) => onMine(pickIn(mine, id)))}
          </div>
          <p className="pc__lead">The bot brings its own three. You’ll see them when the game starts.</p>
        </div>
      ) : (
        <div className="pc__setup-cols">
          {players.map((player) => panel(player, `Player ${player}: pick ${LOADOUT_SIZE}`, `pc__panel--${player}`, loadouts[player], (id) => toggle(player, id)))}
        </div>
      )}
      <button type="button" className="button button--play" disabled={!ready || starting} onClick={onStart}>
        {starting ? 'Getting ready…' : 'Start the clash'}
      </button>
      {vsBot && !saves ? <p className="pc__lead">This is a practice copy: bot games aren’t saved here.</p> : null}
    </section>
  );
}
