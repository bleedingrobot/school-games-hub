/**
 * Pieces of the 101 screen shared by games against bots (Card101Solo) and with classmates
 * (Card101Live): the scores, the card values, the "What happened" list and the podium.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import type { SeatView } from '../../../shared/card101/view';
import { CardValues } from './Card101Settings';
import type { Seat } from './Table';
import { ORDINAL } from './text';

/** Places from totals: lowest is 1st, ties share a place. */
export function placesFrom(totals: readonly number[], out: readonly boolean[]): number[] {
  return totals.map((t, i) => (out[i] ? 0 : 1 + totals.filter((u, j) => !out[j] && u < t).length));
}

/** The colour of a score bar: green, then amber after 75% of the way, then red after 90%. */
export function barLevel(total: number, target: number): 'ok' | 'warn' | 'danger' {
  const share = total / target;
  return share >= 0.9 ? 'danger' : share >= 0.75 ? 'warn' : 'ok';
}

/** Everyone's total, with a bar filling towards the target. */
export function ScoresPanel({ seats, view, turnSeat }: { seats: readonly Seat[]; view: SeatView; turnSeat: number | null }) {
  const target = view.settings.target;
  return (
    <section className="c101-panel" aria-labelledby="c101-scores-title">
      <h2 id="c101-scores-title" className="c101-panel__title">
        Scores <span>Round {view.round} · to {target}</span>
      </h2>
      <ul className="c101-scores">
        {seats.map((seat, i) => {
          const total = view.totals[i];
          const last = view.history.at(-1)?.hands[i];
          return (
            <li key={i} className={`c101-score${turnSeat === i ? ' is-turn' : ''}${view.out[i] ? ' is-out' : ''}`}>
              <AvatarImage avatar={seat.avatar} size={30} />
              <span className="c101-score__name">{i === view.seat ? 'You' : seat.name}</span>
              <span className="c101-score__total" aria-label={`${total} of ${target}${last != null ? `, last hand ${last}` : ''}`}>
                {total}
                {last != null && <small>+{last}</small>}
              </span>
              <span className={`c101-bar is-${barLevel(total, target)}`} aria-hidden="true">
                <span style={{ width: `${Math.min(100, (total / target) * 100)}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ValuesPanel() {
  return (
    <section className="c101-panel c101-panel--values" aria-labelledby="c101-values-title">
      <h2 id="c101-values-title" className="c101-panel__title">
        Card values
      </h2>
      <CardValues />
      <p className="c101-panel__note">Pairs cancel out. Three of a kind: the whole hand is 0.</p>
    </section>
  );
}

/** The game log, read out as it grows, with the newest line kept in sight. */
export function LogPanel({ lines, note }: { lines: readonly string[]; note: string }) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lines]);
  return (
    <section className="c101-panel c101-log" aria-labelledby="c101-log-title">
      <h2 id="c101-log-title" className="c101-panel__title">
        What happened <span>{note}</span>
      </h2>
      <ol ref={listRef} aria-live="polite" aria-relevant="additions" tabIndex={0} aria-labelledby="c101-log-title">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </section>
  );
}

const MEDALS = ['', '🥇', '🥈', '🥉', '4️⃣'];

/** The end of the game: everyone's place and total. `me` is the viewer's seat. */
export function Podium({
  seats,
  places,
  totals,
  me,
  shared,
  note,
  about,
  children,
}: {
  seats: readonly Seat[];
  places: number[];
  totals: number[];
  me: number;
  shared: boolean;
  /** A line about saving or points. */
  note: string | null;
  /** Instead of the usual line under the title (e.g. for a player who was out). */
  about?: string;
  children: ReactNode;
}) {
  const mine = places[me];
  const title = mine === 1 ? (shared ? 'You shared the win!' : 'You won!') : mine ? `You came ${ORDINAL[mine]}` : 'The game is over';
  const line = about ?? (mine === 1 ? 'Lowest total wins. Great remembering!' : 'Lowest total wins. Have another go!');
  const order = seats.map((_, i) => i).filter((i) => places[i] > 0).sort((a, b) => places[a] - places[b] || totals[a] - totals[b]);
  return (
    <div className="chess-result c101-podium" role="dialog" aria-modal="true" aria-labelledby="c101-result-title">
      <div className={`chess-result__card chess-result__card--${mine === 1 ? 'won' : 'drawn'}`}>
        <div className="chess-result__emoji" aria-hidden="true">
          {mine === 1 ? '🏆' : mine ? MEDALS[mine] : '🃏'}
        </div>
        <h2 id="c101-result-title">{title}</h2>
        <p>{line}</p>
        <ol className="c101-podium__list">
          {order.map((i) => (
            <li key={i} className={i === me ? 'is-me' : ''}>
              <span aria-hidden="true">{MEDALS[places[i]]}</span>
              <span className="sr-only">{ORDINAL[places[i]]}:</span>
              <AvatarImage avatar={seats[i].avatar} size={32} />
              <span>{i === me ? 'You' : seats[i].name}</span>
              <strong>{totals[i]}</strong>
            </li>
          ))}
        </ol>
        {note && (
          <p className="c101-podium__save" role="status">
            {note}
          </p>
        )}
        <div className="chess-result__buttons">{children}</div>
      </div>
    </div>
  );
}
