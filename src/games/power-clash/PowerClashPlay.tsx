import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LOADOUT_SIZE, legalSkip, placeableSquares, play, powerBlockedReason, targetChoices, validLoadout,
} from '../../../shared/power-clash/engine';
import { newMatch, nextRound, scoreRound, ROUNDS_TO_WIN, type Match } from '../../../shared/power-clash/match';
import type { Action, Cell, GameEvent, Player, PowerId } from '../../../shared/power-clash/types';
import { useSound } from '../../sound';
import { playSound, type GameSound } from '../sounds';
import { PowerClashGuide } from './Guide';
import { POWERS, TEXT, powerInfo, shout, type ShoutKind } from './text';
import './power-clash.css';

type Loadouts = Record<Player, PowerId[]>;
const DEFAULT_LOADOUTS: Loadouts = {
  X: ['double-trouble', 'freeze-ray', 'board-wipe'],
  O: ['body-swap', 'freeze-ray', 'double-trouble'],
};

/** How long input stays locked while an animation plays (never more than about a second). */
const LOCK_MS = 900;
const LOCK_CALM_MS = 150;

interface Fx {
  key: number;
  events: GameEvent[];
  /** What stood on the wiped square before the blast, so it can fly off. */
  wiped: Cell;
}

function useReducedMotion() {
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

const SOUNDS: Partial<Record<GameEvent['kind'], GameSound>> = {
  place: 'tap', 'double-trouble': 'zap', 'body-swap': 'swap', freeze: 'freeze', wipe: 'boom', skip: 'end', win: 'win', draw: 'draw',
};

/** Two players, one screen. All the rules come from shared/power-clash; this only shows them. */
export function PowerClashPlay() {
  const [loadouts, setLoadouts] = useState<Loadouts>(DEFAULT_LOADOUTS);
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
  const { soundOn } = useSound();
  const calm = useReducedMotion();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
      if (e.key === '?') setHelpOpen(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const help = helpOpen ? <PowerClashGuide onClose={() => setHelpOpen(false)} returnTo={helpButton} /> : null;
  const helpBtn = (
    <button type="button" className="button button--light pc__help" ref={helpButton} onClick={() => setHelpOpen(true)}>
      How to play <kbd>?</kbd>
    </button>
  );

  if (!match) {
    return (
      <>
        <Setup
          loadouts={loadouts}
          onChange={setLoadouts}
          helpButton={helpBtn}
          onStart={() => {
            setMatch(newMatch(loadouts));
            setMessage('');
            setFx(null);
            setShoutText('');
          }}
        />
        {help}
      </>
    );
  }

  const { state } = match;
  const over = state.status !== 'active';
  const me = state.active;

  function apply(action: Action) {
    const result = play(state, action);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    // The engine has already decided everything. From here on it is only show.
    const scored = scoreRound({ ...match!, state: result.state });
    setSelected(null);
    setMessage(describe(result.events.map((e) => e.kind)));
    setMatch(scored);
    const wipe = result.events.find((e) => e.kind === 'wipe');
    plays.current += 1;
    setFx({ key: plays.current, events: result.events, wiped: wipe ? state.board[wipe.square] : null });

    const kinds = result.events.map((e) => e.kind);
    let big: ShoutKind | null = null;
    if (scored.winner) big = 'match';
    else if (kinds.includes('win')) big = 'win';
    else if (kinds.includes('draw')) big = 'draw';
    else big = (['body-swap', 'freeze-ray', 'board-wipe', 'double-trouble'] as const).find((p) =>
      kinds.includes(p === 'freeze-ray' ? 'freeze' : p === 'board-wipe' ? 'wipe' : p),
    ) ?? (kinds.includes('skip') ? 'skip' : null);
    setShoutText(big ? shout(big, plays.current) : '');

    if (soundOn) {
      const order: GameEvent['kind'][] = ['win', 'draw', 'wipe', 'freeze', 'body-swap', 'double-trouble', 'skip', 'place'];
      const first = order.find((k) => kinds.includes(k));
      if (first) playSound(SOUNDS[first]!);
    }

    setBusy(true);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [
      window.setTimeout(() => setBusy(false), calm ? LOCK_CALM_MS : LOCK_MS),
      window.setTimeout(() => setShoutText(''), 1800),
    ];
  }

  function choosePower(power: PowerId) {
    if (busy) return;
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
    if (over || busy) return;
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
  if (match.winner) prompt = `Player ${match.winner} wins the match!`;
  else if (state.status === 'draw') prompt = 'A draw! Nobody wins this round.';
  else if (over) prompt = `Player ${state.status} wins the round!`;
  else if (selected) prompt = powerInfo(selected.power).steps[selected.picked.length];
  else if (legalSkip(state)) prompt = `Player ${me}: every square is frozen, so you miss your go.`;
  else if (state.placesLeft === 2) prompt = `Player ${me}: place your first symbol (then one more!)`;
  else if (state.powerThisTurn) prompt = `Player ${me}: now place your symbol`;
  else prompt = `Player ${me}: use a power, or just place a symbol`;

  const fxOf = (i: number) => cellFx(fx, i);
  const kinds = fx?.events.map((e) => e.kind) ?? [];
  const boardFx = [
    kinds.includes('double-trouble') ? 'pc__board--zap' : '',
    kinds.includes('wipe') || kinds.includes('win') ? 'pc__board--shake' : '',
    kinds.includes('win') ? 'pc__board--win' : '',
    kinds.includes('draw') ? 'pc__board--draw' : '',
  ].join(' ');

  return (
    <section className={`pc ${calm ? 'pc--calm' : ''}`} aria-label={TEXT.name}>
      <header className="pc__top">
        <h1>{TEXT.name}</h1>
        {helpBtn}
        <p className="pc__score" aria-label="Score">
          <span className="pc__x">X {match.score.X}</span>
          <span className="pc__round">Round {match.round} · first to {ROUNDS_TO_WIN}</span>
          <span className="pc__o">O {match.score.O}</span>
        </p>
      </header>

      <div className="pc__table">
        <PowerPanel player="X" match={match} selected={selected} onChoose={choosePower} locked={busy} />
        <section className="pc__middle">
          <p className="pc__prompt" role="status" aria-live="polite">{prompt}</p>
          <p className="pc__shout" aria-hidden="true" key={fx?.key}>{shoutText}</p>
          <div className={`pc__board ${boardFx}`} role="group" aria-label="Board" aria-busy={busy}>
            {state.board.map((cell, i) => {
              const enabled = !over && !busy && choices.includes(i);
              const winning = state.line?.includes(i);
              const frozen = frozenNow.has(i) && cell === null;
              const chosen = selected?.picked.includes(i);
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
                    chosen ? 'pc__cell--chosen' : '',
                    fxOf(i),
                  ].join(' ')}
                  key={`${i}-${fx?.key ?? 0}`}
                  style={swapVars(fx, i)}
                  disabled={!enabled}
                  aria-label={cellLabel(i, cell, frozen)}
                  onClick={() => tapSquare(i)}
                >
                  {cell ?? ''}
                  {frozen ? <span className="pc__ice" aria-hidden="true">❄️</span> : null}
                  {fx?.wiped && kinds.includes('wipe') && fx.events.some((e) => e.kind === 'wipe' && e.square === i) ? (
                    <span className={`pc__fly pc__fly--${fx.wiped}`} aria-hidden="true">{fx.wiped}</span>
                  ) : null}
                  {!calm ? particles(fx, i) : null}
                </button>
              );
            })}
          </div>
          <p className="pc__message" role="status" aria-live="polite">{message}</p>
          <div className="pc__actions">
            {selected ? (
              <button type="button" className="button button--light" onClick={() => setSelected(null)}>
                Cancel power
              </button>
            ) : null}
            {!over && legalSkip(state) ? (
              <button type="button" className="button button--primary" disabled={busy} onClick={() => apply({ type: 'skip' })}>
                Miss my go
              </button>
            ) : null}
            {over && !match.winner ? (
              <button
                type="button"
                className="button button--play"
                onClick={() => {
                  setMatch(nextRound(match));
                  setMessage('');
                  setFx(null);
                  setShoutText('');
                }}
              >
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
                  if (match.winner) setMatch(newMatch(match.loadout, match.starter === 'X' ? 'O' : 'X'));
                  else setMatch(null);
                }}
              >
                {match.winner ? 'Rematch' : 'Change powers'}
              </button>
            ) : null}
            {over && match.winner ? (
              <button type="button" className="button button--light" onClick={() => setMatch(null)}>
                Change powers
              </button>
            ) : null}
          </div>
        </section>
        <PowerPanel player="O" match={match} selected={selected} onChoose={choosePower} locked={busy} />
      </div>
      {help}
    </section>
  );
}

/** Which animation class a square gets, read from the engine's events. */
function cellFx(fx: Fx | null, i: number): string {
  if (!fx) return '';
  const out: string[] = [];
  for (const e of fx.events) {
    if (e.kind === 'place' && e.square === i) out.push('pc__cell--pop');
    if (e.kind === 'body-swap' && e.squares.includes(i)) out.push('pc__cell--swap');
    if (e.kind === 'freeze' && e.square === i) out.push('pc__cell--frosting');
    if (e.kind === 'wipe' && e.square === i) out.push('pc__cell--blast');
    if (e.kind === 'win' && e.line.includes(i)) out.push('pc__cell--cheer');
  }
  return out.join(' ');
}

/** For a Body Swap: how far (in squares) each symbol slides to reach where it now sits. */
function swapVars(fx: Fx | null, i: number): React.CSSProperties | undefined {
  const e = fx?.events.find((ev) => ev.kind === 'body-swap');
  if (!e || e.kind !== 'body-swap' || !e.squares.includes(i)) return undefined;
  const other = e.squares[0] === i ? e.squares[1] : e.squares[0];
  return { '--dx': (other % 3) - (i % 3), '--dy': Math.floor(other / 3) - Math.floor(i / 3) } as React.CSSProperties;
}

/** A few short-lived sparks on the square where something big happened. */
function particles(fx: Fx | null, i: number) {
  if (!fx) return null;
  const hit = fx.events.some(
    (e) => (e.kind === 'wipe' && e.square === i) || (e.kind === 'freeze' && e.square === i) || (e.kind === 'win' && e.line.includes(i)),
  );
  if (!hit) return null;
  return Array.from({ length: 6 }, (_, n) => (
    <span key={n} className="pc__particle" aria-hidden="true" style={{ '--a': `${n * 60 + 20}deg` } as React.CSSProperties} />
  ));
}

function cellLabel(i: number, cell: Player | null, frozen: boolean) {
  const where = `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}`;
  return `${where}: ${cell ?? (frozen ? 'frozen, empty' : 'empty')}`;
}

function describe(kinds: string[]): string {
  if (kinds.includes('double-trouble')) return 'Double Trouble! Two symbols this turn.';
  if (kinds.includes('body-swap')) return 'Body Swap! They traded places.';
  if (kinds.includes('freeze')) return 'Freeze Ray! That square is frozen for one turn.';
  if (kinds.includes('wipe')) return 'Board Wipe! Gone.';
  if (kinds.includes('skip')) return 'Missed a go.';
  return '';
}

function PowerPanel({
  player, match, selected, onChoose, locked,
}: {
  player: Player;
  match: Match;
  selected: { power: PowerId } | null;
  onChoose: (p: PowerId) => void;
  locked: boolean;
}) {
  const { state } = match;
  const myTurn = state.active === player && state.status === 'active';
  return (
    <aside className={`pc__panel pc__panel--${player} ${myTurn ? 'pc__panel--turn' : ''}`}>
      <h2>
        Player {player} {myTurn ? '← your go' : ''}
      </h2>
      <ul>
        {state.loadout[player].map((id) => {
          const info = powerInfo(id);
          const spent = state.used[player].includes(id);
          const reason = myTurn ? powerBlockedReason(state, id) : null;
          return (
            <li key={id}>
              <button
                type="button"
                className={`pc__power ${selected?.power === id && myTurn ? 'pc__power--on' : ''}`}
                disabled={!myTurn || spent || locked}
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
  loadouts, onChange, onStart, helpButton,
}: {
  loadouts: Loadouts;
  onChange: (l: Loadouts) => void;
  onStart: () => void;
  helpButton: React.ReactNode;
}) {
  const ready = validLoadout(loadouts.X) && validLoadout(loadouts.O);
  const players = useMemo<Player[]>(() => ['X', 'O'], []);
  function toggle(player: Player, id: PowerId) {
    const list = loadouts[player];
    const next = list.includes(id) ? list.filter((p) => p !== id) : list.length < LOADOUT_SIZE ? [...list, id] : list;
    onChange({ ...loadouts, [player]: next });
  }
  return (
    <section className="pc pc--setup" aria-label={TEXT.name}>
      <h1>{TEXT.name}</h1>
      {helpButton}
      <p className="pc__lead">
        Two players, one screen. Each of you picks <strong>{LOADOUT_SIZE} different powers</strong>.
        Every power can be used <strong>once</strong>. Get three in a row, first to {ROUNDS_TO_WIN} rounds wins.
      </p>
      <div className="pc__setup-cols">
        {players.map((player) => (
          <section key={player} className={`pc__panel pc__panel--${player}`}>
            <h2>Player {player}: pick {LOADOUT_SIZE} ({loadouts[player].length}/{LOADOUT_SIZE})</h2>
            <ul>
              {POWERS.map((info) => {
                const on = loadouts[player].includes(info.id);
                return (
                  <li key={info.id}>
                    <button
                      type="button"
                      className={`pc__power ${on ? 'pc__power--on' : ''}`}
                      aria-pressed={on}
                      onClick={() => toggle(player, info.id)}
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
        ))}
      </div>
      <button type="button" className="button button--play" disabled={!ready} onClick={onStart}>
        Start the clash
      </button>
    </section>
  );
}
