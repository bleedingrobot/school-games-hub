/**
 * The end-of-round scoring show: one player at a time, their four cards turn over and the
 * working appears ("The 7s cancel", "The 3 cancels the Queen: 10 → 0", "Hand: 4 + 0 = 4"),
 * then their total goes up. A Skip button shows everyone at once.
 */
import { useEffect, useRef, useState } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import { cardName } from '../../../shared/card101/cards';
import type { RoundResult } from '../../../shared/card101/engine';
import { PlayingCard } from './PlayingCard';
import type { Seat } from './Table';
import { cancelledSlots, listNames, scoreLines } from './text';

/** How long each player's hand stays on its own before the next one turns over (Normal speed). */
const STEP_MS = 1600;

export function Scoring({
  result,
  seats,
  me,
  gameOver,
  onNext,
  timeScale,
  onRevealed,
}: {
  result: RoundResult;
  seats: readonly Seat[];
  me: number;
  /** This round ended the game: the button goes to the podium. */
  gameOver: boolean;
  onNext: () => void;
  timeScale: number;
  /** Called once when every hand is showing (for the round-win sound). */
  onRevealed?: () => void;
}) {
  const order = seats.map((_, i) => i).filter((i) => result.scores[i]);
  const [shown, setShown] = useState(timeScale === 0 ? order.length : 1);
  const nextRef = useRef<HTMLButtonElement>(null);
  const told = useRef(false);
  const all = shown >= order.length;

  useEffect(() => {
    if (all) return;
    const timer = setTimeout(() => setShown((n) => n + 1), STEP_MS * timeScale);
    return () => clearTimeout(timer);
  }, [shown, all, timeScale]);

  useEffect(() => {
    if (!all) return;
    nextRef.current?.focus({ preventScroll: true });
    if (!told.current) {
      told.current = true;
      onRevealed?.();
    }
  }, [all, onRevealed]);

  const name = (i: number) => (i === me ? 'You' : seats[i].name);
  const winners = result.winners.map(name);
  const iWon = result.winners.includes(me);
  const perfect = result.winners.some((i) => result.scores[i]!.total === 0);
  const before = (i: number) => result.totals[i] - result.scores[i]!.total;

  return (
    <div className="c101-scoring" role="dialog" aria-modal="false" aria-labelledby="c101-scoring-title">
      <div className="c101-scoring__card">
        <h2 id="c101-scoring-title">Round {result.round} scores</h2>
        <ol className="c101-scoring__rows">
          {order.slice(0, shown).map((i) => {
            const hand = result.hands[i];
            const score = result.scores[i]!;
            const crossed = cancelledSlots(score);
            const { steps, sum } = scoreLines(hand, score);
            const won = result.winners.includes(i);
            return (
              <li key={i} className={`c101-score-row${won ? ' is-winner' : ''}${score.total === 0 ? ' is-zero' : ''}`}>
                <div className="c101-score-row__who">
                  <AvatarImage avatar={seats[i].avatar} size={32} />
                  <strong>{name(i)}</strong>
                  {result.knocker === i && <span className="c101-badge c101-badge--knock">✊ Knocked</span>}
                </div>
                <div className="c101-score-row__cards" role="list" aria-label={`${name(i) === 'You' ? 'Your' : `${name(i)}’s`} cards`}>
                  {hand.map((card, slot) => (
                    <span
                      key={slot}
                      role="listitem"
                      className={`c101-score-card${crossed.has(slot) ? ' is-crossed' : ''}`}
                      style={{ animationDelay: `${slot * 120 * timeScale}ms` }}
                      aria-label={`${cardName(card)}${crossed.has(slot) ? ', cancelled' : `, ${score.values[slot]}`}`}
                    >
                      <PlayingCard card={card} />
                      <span className="c101-score-card__value" aria-hidden="true">
                        {crossed.has(slot) ? '0' : score.values[slot]}
                      </span>
                    </span>
                  ))}
                </div>
                <div className="c101-score-row__working">
                  {steps.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  <p className="c101-score-row__sum">{sum}</p>
                </div>
                <div className="c101-score-row__total" aria-label={`Total: ${before(i)} plus ${score.total} makes ${result.totals[i]}`}>
                  <span>{before(i)}</span>
                  <span aria-hidden="true">+{score.total} →</span>
                  <strong>{result.totals[i]}</strong>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="c101-scoring__footer" aria-live="polite">
          {all ? (
            <>
              <p className={`c101-scoring__winner${perfect ? ' is-perfect' : ''}`}>
                {iWon && winners.length === 1 ? '🏆 You win the round!' : `🏆 ${listNames(winners)} ${winners.length > 1 ? 'share' : 'wins'} the round!`}
                {perfect && <span> A perfect zero! ✨</span>}
              </p>
              <button ref={nextRef} type="button" className="button button--play" onClick={onNext}>
                {gameOver ? '🏆 See who won' : 'Next round ▶'}
              </button>
            </>
          ) : (
            <button type="button" className="button button--light" onClick={() => setShown(order.length)}>
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
