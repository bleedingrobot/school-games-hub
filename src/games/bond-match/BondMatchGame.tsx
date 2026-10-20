import { useEffect, useRef, useState } from 'react';
import type { BondSet } from '../../../shared/bond-match/bonds';
import { botView, chooseFlip, rememberFlip, type Memory } from '../../../shared/bond-match/bot';
import { buildDeck, type BoardSize } from '../../../shared/bond-match/deck';
import type { GameEvent, GameState } from '../../../shared/bond-match/engine';
import { newVersus, versusFlip, winnerOf, type Player, type VersusState } from '../../../shared/bond-match/versus';
import { sumText } from '../../../shared/bond-match/exact';
import { scoreGame, type Score } from '../../../shared/bond-match/score';
import { useSound } from '../../sound';
import { playSound } from '../sounds';
import { Board } from './Board';
import { loadHideStats, loadShowPictures, saveHideStats, saveShowPictures } from './bests';
import { clock, COLOUR_SETS, playerName, TEXT, type Players } from './strings';
import { useReducedMotion } from './useReducedMotion';
import { Value } from './Value';

/** A mismatch turns back by itself after this long, so nobody gets stuck waiting to flip. */
export const MISMATCH_MS = 4000;
/** The last pair stays on show this long before the finish screen. */
export const FINISH_MS = 1200;
/** How long the computer waits before each card it flips, so a child can follow it. */
export const BOT_MS = 900;
/** ...and before its first card after a child's mismatch, so the "3 + 4 = 7" line can be read first. */
export const BOT_AFTER_MISMATCH_MS = 2200;

export interface FinishedGame {
  state: GameState;
  score: Score;
  /** Pairs won by each player, and who won, in a two-player or computer game. */
  versus?: { pairs: readonly [number, number]; winner: Player | 'tie' };
}

interface Props {
  set: BondSet;
  size: BoardSize;
  /** The caller picks the seed (the engine has no random of its own), so Play again can pick a new one. */
  seed: number;
  onFinish: (game: FinishedGame) => void;
  onQuit: () => void;
  /** Who is playing. Solo when left out. */
  players?: Players;
  mismatchMs?: number;
  finishMs?: number;
  botMs?: number;
  botAfterMismatchMs?: number;
  /** The computer's dice (0 up to 1). Tests pass a fixed one. */
  random?: () => number;
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

/** A colour set's mark: its shape and letter, with the name said aloud (the shape alone is not read out). */
function Mark({ set }: { set: 0 | 1 }) {
  const mark = COLOUR_SETS[set];
  return (
    <span className={`bm-mark bm-mark--${set}`}>
      <span aria-hidden="true">{mark.shape} {mark.letter}</span>
      <span className="sr-only">{mark.name} {mark.letter}</span>
    </span>
  );
}

/** "Right total, wrong set! Match ● A with ● A, or ◆ B with ◆ B." The two marks are shown, not only said. */
function WrongSet() {
  return (
    <>
      {TEXT.wrongSetLead}{' '}
      <span className="bm-nowrap">{TEXT.wrongSetMatch} <Mark set={0} /> {TEXT.wrongSetWith} <Mark set={0} />,</span>{' '}
      <span className="bm-nowrap">{TEXT.wrongSetOr} <Mark set={1} /> {TEXT.wrongSetWith} <Mark set={1} />.</span>
    </>
  );
}

/** One game on one board. Counts the time (the engine has no clock) and hands the finished game up. */
export function BondMatchGame({
  set, size, seed, onFinish, onQuit, players = { mode: 'solo' }, mismatchMs = MISMATCH_MS, finishMs = FINISH_MS,
  botMs = BOT_MS, botAfterMismatchMs = BOT_AFTER_MISMATCH_MS, random = Math.random,
}: Props) {
  const { soundOn } = useSound();
  const reducedMotion = useReducedMotion();
  // Solo games use the same two-player state and simply ignore whose turn it is.
  const [vs, setVs] = useState<VersusState>(() => newVersus(buildDeck(set, size, seed)));
  const game = vs.game;
  const memory = useRef<Memory>([]);
  const twoPlayers = players.mode !== 'solo';
  const botTurn = players.mode === 'bot' && vs.turn === 1 && !game.finished;
  const [line, setLine] = useState<Line | null>(null);
  const [hideStats, setHideStats] = useState(loadHideStats);
  const [pictures, setPictures] = useState(loadShowPictures);
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
      const winner = winnerOf(vs);
      if (score) onFinish({ state: game, score, ...(twoPlayers && winner !== undefined ? { versus: { pairs: vs.pairs, winner } } : {}) });
    }, finishMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the game finishes
  }, [game.finished]);

  const play = (sound: Parameters<typeof playSound>[0]) => { if (soundOn) playSound(sound); };

  // The computer's turn: one card at a time, slowly enough to watch. It sees only what is face up (shared/bond-match/bot.ts).
  useEffect(() => {
    if (!botTurn || players.mode !== 'bot') return;
    const level = players.level;
    const wait = game.shown.length === 2 && line?.type === 'mismatch' ? botAfterMismatchMs : botMs;
    const timer = setTimeout(() => flipCard(chooseFlip(botView(game, memory.current), level, random)), wait);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs again after each of the computer's flips
  }, [vs, botTurn]);

  /** A child's tap: ignored while it is the computer's go. */
  function onFlip(index: number) {
    if (botTurn) return;
    flipCard(index);
  }

  function flipCard(index: number) {
    if (game.finished) return;
    const result = versusFlip(vs, index);
    if (result.refused) return;
    if (players.mode === 'bot') memory.current = rememberFlip(memory.current, result.state.game, result.events, players.level);
    const at = Date.now();
    if (startedAt.current === null) startedAt.current = at;
    setNow(at);
    setVs(result.state);
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

  const hasFractions = game.deck.cards.some((c) => c.side.kind === 'fraction');

  function togglePictures() {
    setPictures(!pictures);
    saveShowPictures(!pictures);
  }

  function toggleStats() {
    setHideStats(!hideStats);
    saveHideStats(!hideStats);
  }

  return (
    <section className="bm-game" aria-label={TEXT.name}>
      <div className="bm-bar">
        <button type="button" className="bm-back" aria-label={TEXT.quit} onClick={onQuit}>
          <span aria-hidden="true">←</span>
          <span className="bm-back__text" aria-hidden="true">{TEXT.back}</span>
        </button>
        <h2 className="bm-goal">
          <span className="bm-goal__make" aria-hidden="true">{TEXT.make}</span>
          <span className="bm-goal__num" aria-hidden="true"><Value text={target} /></span>
          <span className="bm-goal__set">{set.label}</span>
        </h2>
        <div className="bm-bar__right">
          {hideStats ? (
            <span className="bm-stats bm-stats--hidden">{TEXT.statsHidden}</span>
          ) : (
            <span className="bm-stats">
              <span className="bm-stat"><span className="bm-stat__name">{TEXT.flips}</span> <strong data-testid="flips">{game.flips}</strong></span>
              <span className="bm-stat"><span className="bm-stat__name">{TEXT.time}</span> <strong data-testid="time">{clock(elapsed)}</strong></span>
            </span>
          )}
          <button type="button" className="bm-icon-btn" aria-pressed={hideStats} aria-label={hideStats ? TEXT.showStats : TEXT.hideStats} title={hideStats ? TEXT.showStats : TEXT.hideStats} onClick={toggleStats}>
            <span aria-hidden="true">{hideStats ? '🙈' : '⏱️'}</span>
          </button>
          {hasFractions && (
            <button type="button" className="bm-icon-btn" aria-pressed={pictures} aria-label={pictures ? TEXT.hidePictures : TEXT.showPictures} title={pictures ? TEXT.hidePictures : TEXT.showPictures} onClick={togglePictures}>
              <span aria-hidden="true">{pictures ? '📊' : '🔢'}</span>
            </button>
          )}
        </div>
      </div>
      {twoPlayers && (
        <div className="bm-turn" data-testid="turn">
          {([0, 1] as const).map((p) => (
            <div key={p} className={`bm-player bm-player--${p}${vs.turn === p && !game.finished ? ' bm-player--now' : ''}`}>
              <span className="bm-player__icon" aria-hidden="true">{players.mode === 'bot' && p === 1 ? '🤖' : p === 0 ? '🙂' : '😃'}</span>
              <span className="bm-player__name">{playerName(players, p)}</span>
              <span className="bm-player__pairs">{TEXT.pairs(vs.pairs[p])}</span>
            </div>
          ))}
          <p className="bm-turn__now" aria-live="polite">
            {game.finished ? TEXT.allPairsFound : TEXT.turn(players, vs.turn)}
          </p>
        </div>
      )}
      <Board cards={game.deck.cards} matched={game.matched} shown={shown} reducedMotion={reducedMotion} setLabel={set.label} pictures={hasFractions && pictures} onFlip={onFlip} />
      <div className="bm-line" role="status" aria-live="polite">
        {line?.type === 'mismatch' && (
          <div className="bm-line__pill bm-line__pill--miss">
            <p className="bm-line__sum"><Sum texts={line.texts} sum={line.sumText} /></p>
            <p className="bm-line__help">{line.sumsToTarget ? <WrongSet /> : TEXT.mismatchNeed(target)}</p>
          </div>
        )}
        {line?.type === 'match' && (
          <div className="bm-line__pill bm-line__pill--match">
            <p className="bm-line__sum bm-line__sum--match"><Sum texts={line.texts} sum={line.sumText} /> ✓<span className="sr-only"> {TEXT.match}</span></p>
          </div>
        )}
      </div>
    </section>
  );
}
