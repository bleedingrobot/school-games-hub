import { useEffect, useRef, useState } from 'react';
import type { BondSet } from '../../../shared/bond-match/bonds';
import { buildDeck, type BoardSize } from '../../../shared/bond-match/deck';
import { flip, newGame, type GameEvent, type GameState } from '../../../shared/bond-match/engine';
import { sumText } from '../../../shared/bond-match/exact';
import { scoreGame, type Score } from '../../../shared/bond-match/score';
import { useSound } from '../../sound';
import { playSound } from '../sounds';
import { Board } from './Board';
import { loadHideStats, saveHideStats } from './bests';
import { clock, TEXT } from './strings';
import { useReducedMotion } from './useReducedMotion';
import { Value } from './Value';

/** A mismatch turns back by itself after this long, so nobody gets stuck waiting to flip. */
export const MISMATCH_MS = 4000;
/** The last pair stays on show this long before the finish screen. */
export const FINISH_MS = 1200;

export interface FinishedGame {
  state: GameState;
  score: Score;
}

interface Props {
  set: BondSet;
  size: BoardSize;
  /** The caller picks the seed (the engine has no random of its own), so Play again can pick a new one. */
  seed: number;
  onFinish: (game: FinishedGame) => void;
  onQuit: () => void;
  mismatchMs?: number;
  finishMs?: number;
}

type Line = Extract<GameEvent, { type: 'match' | 'mismatch' }>;

/** "3 + 4 = 7" in plain text, or stacked fractions with a spoken label when the cards are fractions. */
function Sum({ texts, sum }: { texts: readonly [string, string]; sum: string }) {
  if (![...texts, sum].some((t) => t.includes('/'))) return <>{TEXT.mismatch(texts[0], texts[1], sum)}</>;
  return (
    <span role="img" aria-label={TEXT.spokenMismatch(texts[0], texts[1], sum)} className="bm-sum">
      <Value text={texts[0]} /> + <Value text={texts[1]} /> = <Value text={sum} />
    </span>
  );
}

/** One game on one board. Counts the time (the engine has no clock) and hands the finished game up. */
export function BondMatchGame({ set, size, seed, onFinish, onQuit, mismatchMs = MISMATCH_MS, finishMs = FINISH_MS }: Props) {
  const { soundOn } = useSound();
  const reducedMotion = useReducedMotion();
  const [game, setGame] = useState<GameState>(() => newGame(buildDeck(set, size, seed)));
  const [line, setLine] = useState<Line | null>(null);
  const [hideStats, setHideStats] = useState(loadHideStats);
  const startedAt = useRef<number | null>(null);
  const finishedAt = useRef<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const seconds = (at: number) => (startedAt.current === null ? 0 : Math.max(0, Math.floor((at - startedAt.current) / 1000)));

  useEffect(() => {
    if (startedAt.current === null || game.finished) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [game.flips, game.shown.length, game.finished]);

  // A mismatch turns back by itself after a few seconds. The next flip would turn it back too.
  useEffect(() => {
    if (line?.type !== 'mismatch') return;
    const timer = setTimeout(() => setLine(null), mismatchMs);
    return () => clearTimeout(timer);
  }, [line, mismatchMs]);

  useEffect(() => {
    if (!game.finished) return;
    const timer = setTimeout(() => {
      const score = scoreGame(game, seconds(finishedAt.current ?? Date.now()));
      if (score) onFinish({ state: game, score });
    }, finishMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the game finishes
  }, [game.finished]);

  const play = (sound: Parameters<typeof playSound>[0]) => { if (soundOn) playSound(sound); };

  function onFlip(index: number) {
    if (game.finished) return;
    const result = flip(game, index);
    if (result.refused) return;
    const at = Date.now();
    if (startedAt.current === null) startedAt.current = at;
    setNow(at);
    setGame(result.state);
    // Every accepted flip starts by clearing the line; a mismatch or a match then puts a new one up.
    let next: Line | null = null;
    for (const event of result.events) {
      if (event.type === 'first') play('flick');
      if (event.type === 'match') { next = event; play('item'); }
      if (event.type === 'mismatch') { next = event; play('tap'); }
      if (event.type === 'finish') { finishedAt.current = at; play('win'); }
    }
    setLine(next);
  }

  const mismatch = line?.type === 'mismatch' ? line : null;
  // Two cards left face up with no mismatch on show means the timer has turned them back.
  const shown = game.shown.length === 2 && !mismatch ? [] : game.shown;
  const target = sumText(set.pairs[0]);
  const elapsed = seconds(finishedAt.current ?? now);

  function toggleStats() {
    setHideStats(!hideStats);
    saveHideStats(!hideStats);
  }

  return (
    <section className="bm-game" aria-label={TEXT.name}>
      <div className="bm-bar">
        <button type="button" className="bm-link" onClick={onQuit}>← {TEXT.quit}</button>
        <h2 className="bm-bar__title">{set.label}</h2>
        {hideStats ? (
          <span className="bm-stats bm-stats--hidden">{TEXT.statsHidden}</span>
        ) : (
          <span className="bm-stats">
            <span>{TEXT.flips}: <strong data-testid="flips">{game.flips}</strong></span>
            <span>{TEXT.time}: <strong data-testid="time">{clock(elapsed)}</strong></span>
          </span>
        )}
        <button type="button" className="bm-link" aria-pressed={hideStats} onClick={toggleStats}>
          {hideStats ? TEXT.showStats : TEXT.hideStats}
        </button>
      </div>
      <Board cards={game.deck.cards} matched={game.matched} shown={shown} reducedMotion={reducedMotion} setLabel={set.label} onFlip={onFlip} />
      <div className="bm-line" role="status" aria-live="polite">
        {line?.type === 'mismatch' && (
          <>
            <p className="bm-line__sum"><Sum texts={line.texts} sum={line.sumText} /></p>
            <p className="bm-line__help">{line.sumsToTarget ? TEXT.mismatchWrongSet(target) : TEXT.mismatchNeed(target)}</p>
          </>
        )}
        {line?.type === 'match' && <p className="bm-line__sum bm-line__sum--match"><Sum texts={line.texts} sum={line.sumText} /> ✓<span className="sr-only"> {TEXT.match}</span></p>}
      </div>
    </section>
  );
}
