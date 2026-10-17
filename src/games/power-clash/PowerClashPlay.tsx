import { useEffect, useMemo, useState } from 'react';
import {
  LOADOUT_SIZE, legalSkip, placeableSquares, play, powerBlockedReason, targetChoices, validLoadout,
} from '../../../shared/power-clash/engine';
import { newMatch, nextRound, scoreRound, ROUNDS_TO_WIN, type Match } from '../../../shared/power-clash/match';
import type { Action, Player, PowerId } from '../../../shared/power-clash/types';
import { POWERS, TEXT, powerInfo } from './text';
import './power-clash.css';

type Loadouts = Record<Player, PowerId[]>;
const DEFAULT_LOADOUTS: Loadouts = {
  X: ['double-trouble', 'freeze-ray', 'board-wipe'],
  O: ['body-swap', 'freeze-ray', 'double-trouble'],
};

/** Two players, one screen. All the rules come from shared/power-clash; this only shows them. */
export function PowerClashPlay() {
  const [loadouts, setLoadouts] = useState<Loadouts>(DEFAULT_LOADOUTS);
  const [match, setMatch] = useState<Match | null>(null);
  const [selected, setSelected] = useState<{ power: PowerId; picked: number[] } | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!match) {
    return (
      <Setup
        loadouts={loadouts}
        onChange={setLoadouts}
        onStart={() => {
          setMatch(newMatch(loadouts));
          setMessage('');
        }}
      />
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
    setSelected(null);
    setMessage(describe(result.events.map((e) => e.kind)));
    setMatch((m) => scoreRound({ ...m!, state: result.state }));
  }

  function choosePower(power: PowerId) {
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
    if (over) return;
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

  return (
    <main className="pc" aria-label={TEXT.name}>
      <header className="pc__top">
        <h1>{TEXT.name}</h1>
        <p className="pc__score" aria-label="Score">
          <span className="pc__x">X {match.score.X}</span>
          <span className="pc__round">Round {match.round} · first to {ROUNDS_TO_WIN}</span>
          <span className="pc__o">O {match.score.O}</span>
        </p>
      </header>

      <div className="pc__table">
        <PowerPanel player="X" match={match} selected={selected} onChoose={choosePower} />
        <section className="pc__middle">
          <p className="pc__prompt" role="status" aria-live="polite">{prompt}</p>
          <div className="pc__board" role="group" aria-label="Board">
            {state.board.map((cell, i) => {
              const enabled = !over && choices.includes(i);
              const winning = state.line?.includes(i);
              const frozen = frozenNow.has(i) && cell === null;
              const chosen = selected?.picked.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  className={[
                    'pc__cell',
                    cell ? `pc__cell--${cell}` : '',
                    enabled ? 'pc__cell--open' : '',
                    enabled && selected ? 'pc__cell--target' : '',
                    winning ? 'pc__cell--win' : '',
                    frozen ? 'pc__cell--frozen' : '',
                    chosen ? 'pc__cell--chosen' : '',
                  ].join(' ')}
                  disabled={!enabled}
                  aria-label={cellLabel(i, cell, frozen)}
                  onClick={() => tapSquare(i)}
                >
                  {cell ?? ''}
                  {frozen ? <span className="pc__ice" aria-hidden="true">❄️</span> : null}
                </button>
              );
            })}
          </div>
          <p className="pc__message" aria-live="polite">{message}</p>
          <div className="pc__actions">
            {selected ? (
              <button type="button" className="button button--light" onClick={() => setSelected(null)}>
                Cancel power
              </button>
            ) : null}
            {!over && legalSkip(state) ? (
              <button type="button" className="button button--primary" onClick={() => apply({ type: 'skip' })}>
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
        <PowerPanel player="O" match={match} selected={selected} onChoose={choosePower} />
      </div>
    </main>
  );
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
  player, match, selected, onChoose,
}: {
  player: Player;
  match: Match;
  selected: { power: PowerId } | null;
  onChoose: (p: PowerId) => void;
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
                disabled={!myTurn || spent}
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
  loadouts, onChange, onStart,
}: {
  loadouts: Loadouts;
  onChange: (l: Loadouts) => void;
  onStart: () => void;
}) {
  const ready = validLoadout(loadouts.X) && validLoadout(loadouts.O);
  const players = useMemo<Player[]>(() => ['X', 'O'], []);
  function toggle(player: Player, id: PowerId) {
    const list = loadouts[player];
    const next = list.includes(id) ? list.filter((p) => p !== id) : list.length < LOADOUT_SIZE ? [...list, id] : list;
    onChange({ ...loadouts, [player]: next });
  }
  return (
    <main className="pc pc--setup" aria-label={TEXT.name}>
      <h1>{TEXT.name}</h1>
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
    </main>
  );
}
