import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { judgeBotGame, type BotGameReport, type ClaimedEnding, type JudgedGame } from '../../../shared/chess/botGame';
import {
  boardResult,
  Chess,
  playUci,
  replay,
  type Colour,
  type PromotionPiece,
  type Square,
} from '../../../shared/chess/rules';
import { useAuth } from '../../auth/AuthContext';
import { AvatarImage } from '../../avatar/AvatarImage';
import { BotLevelPicker } from '../../components/BotLevelPicker';
import { refreshSaveToken, saveAbandonedGame, saveBotGame } from '../../data/botGames';
import { FriendlyError } from '../../data/profile';
import { useSound } from '../../sound';
import { BOT_LEVELS, type BotLevel } from '../types';
import { Board } from './Board';
import { Captured, figurine } from './moveText';
import { BOT_DESCRIPTIONS, chooseBotMove, randomishMove, type ChessEngine } from './bot';
import { playSound, type GameSound } from '../sounds';
import { startBrowserStockfish } from './stockfish';

const BOT_EMOJI: Record<BotLevel, string> = { 'very-easy': '🐣', easy: '🤖', medium: '🧠' };
/** The bot always waits at least this long, so its moves don't appear instantly. */
const BOT_PAUSE_MS = { min: 600, extra: 700 };

type ColourChoice = Colour | 'random';
type SaveStatus = 'saving' | 'saved' | 'error' | 'left';

interface Game {
  id: number;
  level: BotLevel;
  studentColour: Colour;
  moves: string[];
  /** Set once the game is over: either by the rules, or by resigning. */
  judged: JudgedGame | null;
}

const ENDING_TEXT: Record<string, { won?: string; lost?: string; drawn?: string }> = {
  checkmate: {
    won: 'Checkmate! The bot’s king is trapped. Brilliant!',
    lost: 'Checkmate. The bot trapped your king this time.',
  },
  stalemate: {
    drawn: 'Stalemate! It’s someone’s turn, but they have no legal moves and aren’t in check. That’s a draw.',
  },
  'threefold-repetition': { drawn: 'The same position happened three times, so it’s a draw.' },
  'fifty-moves': { drawn: '50 moves each without a capture or a pawn move, so it’s a draw.' },
  'not-enough-pieces': { drawn: 'There aren’t enough pieces left for anyone to checkmate, so it’s a draw.' },
  resigned: { lost: 'You resigned. Good effort. Have another go!' },
};

const RESULT_HEADLINE = {
  won: { emoji: '🏆', title: 'You won!' },
  lost: { emoji: '💪', title: 'The bot won this time' },
  drawn: { emoji: '🤝', title: 'It’s a draw!' },
};

function pickColour(choice: ColourChoice): Colour {
  if (choice !== 'random') return choice;
  return Math.random() < 0.5 ? 'white' : 'black';
}

function lastMoveOf(chess: Chess) {
  const history = chess.history({ verbose: true });
  const last = history[history.length - 1];
  return last ? { from: last.from, to: last.to } : null;
}

export function ChessPlay({ level }: { level: BotLevel }) {
  const { profile } = useAuth();
  const { soundOn } = useSound();
  const [, setParams] = useSearchParams();
  const [colourChoice, setColourChoice] = useState<ColourChoice>('white');
  const [game, setGame] = useState<Game | null>(null);
  const [thinking, setThinking] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [confirming, setConfirming] = useState<'resign' | 'new' | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [engineBroken, setEngineBroken] = useState(false);

  const engine = useRef<(ChessEngine & { close(): void }) | null>(null);
  const live = useRef<Game | null>(null);
  const abandoned = useRef(new Set<number>());
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  live.current = game;

  const levelInfo = BOT_LEVELS.find((l) => l.id === (game?.level ?? level))!;

  // Start Stockfish when the page opens, so it's ready by the time it's needed.
  useEffect(() => {
    engine.current = startBrowserStockfish();
    return () => {
      engine.current?.close();
      engine.current = null;
    };
  }, []);

  const chess = useMemo(() => {
    if (!game) return new Chess();
    const replayed = replay(game.moves);
    return replayed.ok ? replayed.chess : new Chess();
  }, [game]);

  const report = useCallback(
    (g: Game, ending: ClaimedEnding): BotGameReport & { game: 'chess' } => ({
      game: 'chess',
      level: g.level,
      studentColour: g.studentColour,
      moves: g.moves,
      ending,
    }),
    [],
  );

  const sound = useCallback((name: GameSound) => {
    if (soundOnRef.current) playSound(name);
  }, []);

  /** If the student leaves part-way through (and has moved), record it as unfinished. */
  const recordIfAbandoned = useCallback(() => {
    const g = live.current;
    if (!g || g.judged || abandoned.current.has(g.id)) return;
    const studentMoved = g.moves.length > (g.studentColour === 'white' ? 0 : 1);
    if (!studentMoved) return;
    abandoned.current.add(g.id);
    saveAbandonedGame(report(g, 'abandoned'));
  }, [report]);

  useEffect(() => {
    window.addEventListener('pagehide', recordIfAbandoned);
    return () => {
      window.removeEventListener('pagehide', recordIfAbandoned);
      recordIfAbandoned();
    };
  }, [recordIfAbandoned]);

  const save = useCallback(
    async (g: Game, ending: ClaimedEnding) => {
      if (abandoned.current.has(g.id)) {
        setSaveStatus('left');
        return;
      }
      setSaveStatus('saving');
      try {
        await saveBotGame(report(g, ending));
        setSaveStatus('saved');
      } catch (error) {
        setSaveMessage(error instanceof FriendlyError ? error.message : "We couldn't save this game.");
        setSaveStatus('error');
      }
    },
    [report],
  );

  const finish = useCallback(
    (g: Game, ending: ClaimedEnding) => {
      const judged = judgeBotGame(report(g, ending));
      if (!judged.ok) return;
      const done = { ...g, judged: judged.game };
      setGame(done);
      setConfirming(null);
      setShowResult(true);
      sound(judged.game.outcome === 'won' ? 'win' : 'end');
      void save(done, ending);
    },
    [report, save, sound],
  );

  const addMove = useCallback(
    (g: Game, uci: string) => {
      const check = replay(g.moves);
      if (!check.ok) return;
      const move = playUci(check.chess, uci);
      if (!move) return;
      const next = { ...g, moves: [...g.moves, uci] };
      setGame(next);
      sound(check.chess.inCheck() ? 'alert' : move.captured ? 'capture' : 'move');
      if (boardResult(check.chess)) finish(next, 'finished');
    },
    [finish, sound],
  );

  function start() {
    recordIfAbandoned();
    engine.current?.newGame();
    void refreshSaveToken();
    setGame({ id: Date.now(), level, studentColour: pickColour(colourChoice), moves: [], judged: null });
    setSaveStatus(null);
    setConfirming(null);
    setShowResult(false);
  }

  const botsTurn = !!game && !game.judged && (chess.turn() === 'w' ? 'white' : 'black') !== game.studentColour;

  // The bot's turn: think, wait a moment so it feels natural, then move.
  useEffect(() => {
    if (!game || !botsTurn) return;
    let cancelled = false;
    setThinking(true);
    const pause = new Promise((resolve) => setTimeout(resolve, BOT_PAUSE_MS.min + Math.random() * BOT_PAUSE_MS.extra));
    const thinkingFor = new Chess(chess.fen());
    chooseBotMove(thinkingFor, game.level, engineBroken ? null : engine.current)
      .catch(() => {
        setEngineBroken(true);
        return randomishMove(thinkingFor);
      })
      .then(async (move) => {
        await pause;
        if (cancelled || live.current?.id !== game.id) return;
        setThinking(false);
        addMove(live.current, move);
      });
    return () => {
      cancelled = true;
      setThinking(false);
    };
    // Only re-run when it becomes the bot's turn in a new position.
  }, [game?.id, game?.moves.length, botsTurn]);

  // ---------- Before a game: pick the bot and a colour ----------
  if (!game) {
    return (
      <section className="chess-setup" aria-labelledby="setup-title">
        <h1 id="setup-title" className="page-title">
          ♟️ Chess vs bot
        </h1>
        <div className="chess-setup__card">
          <BotLevelPicker
            name="chess-level"
            legend="Pick your bot"
            value={level}
            onChange={(next) => setParams({ bot: next }, { replace: true })}
          />
          <p className="chess-setup__bot">
            <span aria-hidden="true">{BOT_EMOJI[level]}</span> <strong>{levelInfo.label} bot:</strong>{' '}
            {BOT_DESCRIPTIONS[level]}
          </p>
          <fieldset className="level-picker">
            <legend>Your pieces</legend>
            <div className="level-picker__options">
              {(
                [
                  ['white', 'White (you go first)'],
                  ['black', 'Black'],
                  ['random', 'Surprise me'],
                ] as const
              ).map(([value, text]) => (
                <label key={value} className="level-picker__option">
                  <input
                    type="radio"
                    name="chess-colour"
                    value={value}
                    checked={colourChoice === value}
                    onChange={() => setColourChoice(value)}
                  />
                  <span>{text}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="button" className="button button--play chess-setup__start" onClick={start}>
            <span aria-hidden="true">▶</span> Start game
          </button>
          <p className="chess-setup__help">
            How to move: tap one of your pieces, then tap a dot to move it there. With a keyboard, use the arrow keys
            and press Enter.
          </p>
        </div>
      </section>
    );
  }

  // ---------- During and after a game ----------
  const judged = game.judged;
  const studentTurn = !judged && !botsTurn;
  const history = chess.history({ verbose: true });
  const rows: { number: number; white?: string; black?: string }[] = [];
  history.forEach((move, i) => {
    const row = Math.floor(i / 2);
    rows[row] ??= { number: row + 1 };
    rows[row][move.color === 'w' ? 'white' : 'black'] = figurine(move.san, move.color);
  });
  const captured = (by: 'w' | 'b') =>
    history.filter((m) => m.color === by && m.captured).map((m) => ({ type: m.captured!, colour: by === 'w' ? 'b' : 'w' }));
  const studentCode = game.studentColour === 'white' ? 'w' : 'b';
  const botCode = studentCode === 'w' ? 'b' : 'w';

  let status: string;
  if (judged) status = RESULT_HEADLINE[judged.outcome].title;
  else if (thinking || botsTurn) status = `${levelInfo.label} bot is thinking…`;
  else if (chess.inCheck()) status = 'Check! Your king is under attack. Keep it safe!';
  else status = 'Your turn';

  const headline = judged && RESULT_HEADLINE[judged.outcome];
  const explanation = judged && ENDING_TEXT[judged.reason]?.[judged.outcome];

  return (
    <div className="chess-game">
      <div className="chess-game__board">
        <Board
          chess={chess}
          orientation={game.studentColour}
          canMove={studentTurn}
          lastMove={lastMoveOf(chess)}
          onMove={(from: Square, to: Square, promotion?: PromotionPiece) => addMove(game, from + to + (promotion ?? ''))}
        />

        {judged && showResult && headline && (
          <div className="chess-result" role="dialog" aria-modal="true" aria-labelledby="result-title">
            <div className={`chess-result__card chess-result__card--${judged.outcome}`}>
              <div className="chess-result__emoji" aria-hidden="true">
                {headline.emoji}
              </div>
              <h2 id="result-title">{headline.title}</h2>
              {explanation && <p>{explanation}</p>}
              <p className="chess-result__save" role="status">
                {saveStatus === 'saving' && 'Saving your game…'}
                {saveStatus === 'saved' && '✓ Saved to your games'}
                {saveStatus === 'left' && 'This game was already recorded as unfinished.'}
                {saveStatus === 'error' && (
                  <>
                    {saveMessage}{' '}
                    <button type="button" className="link-button" onClick={() => void save(game, judged.reason === 'resigned' ? 'resigned' : 'finished')}>
                      Try again
                    </button>
                  </>
                )}
              </p>
              <div className="chess-result__buttons">
                <button type="button" className="button button--primary" onClick={start} autoFocus>
                  Play again
                </button>
                <button type="button" className="button button--light" onClick={() => setShowResult(false)}>
                  Look at the board
                </button>
                <button type="button" className="link-button" onClick={() => setGame(null)}>
                  Change bot or colour
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <aside className="chess-game__side" aria-label="Game information">
        <div className={`player-card${botsTurn ? ' is-turn' : ''}`}>
          <span className="player-card__bot" aria-hidden="true">
            {BOT_EMOJI[game.level]}
          </span>
          <div title={BOT_DESCRIPTIONS[game.level]}>
            <strong>{levelInfo.label} bot</strong>
            <span className="player-card__colour">{game.studentColour === 'white' ? 'Black' : 'White'}</span>
          </div>
          <Captured pieces={captured(botCode)} who="The bot" />
        </div>

        <div className={`player-card${studentTurn ? ' is-turn' : ''}`}>
          <AvatarImage avatar={profile?.avatar} size={48} />
          <div>
            <strong>{profile?.display_name ?? 'You'}</strong>
            <span className="player-card__colour">{game.studentColour === 'white' ? 'White' : 'Black'} (you)</span>
          </div>
          <Captured pieces={captured(studentCode)} who="You" />
        </div>

        <p className={`turn-status${chess.inCheck() && !judged ? ' is-check' : ''}`} role="status" aria-live="polite">
          {status}
        </p>
        {engineBroken && (
          <p className="chess-note">The bot’s brain didn’t load properly, so it’s just making random moves.</p>
        )}

        {judged ? (
          <div className="chess-actions">
            <button type="button" className="button button--primary" onClick={start}>
              Play again
            </button>
            {!showResult && (
              <button type="button" className="button button--light" onClick={() => setShowResult(true)}>
                Show result
              </button>
            )}
          </div>
        ) : confirming ? (
          <div className="chess-confirm" role="group" aria-label="Are you sure?">
            <p>
              {confirming === 'resign'
                ? 'Give up this game? It will count as a loss.'
                : 'Start a new game? This one will count as unfinished.'}
            </p>
            <div className="chess-actions">
              <button
                type="button"
                className="button button--danger"
                onClick={() => (confirming === 'resign' ? finish(game, 'resigned') : start())}
              >
                {confirming === 'resign' ? 'Yes, resign' : 'Yes, start again'}
              </button>
              <button type="button" className="button button--light" onClick={() => setConfirming(null)} autoFocus>
                Keep playing
              </button>
            </div>
          </div>
        ) : (
          <div className="chess-actions">
            <button type="button" className="button button--light" onClick={() => setConfirming('new')}>
              New game
            </button>
            <button type="button" className="button button--light" onClick={() => setConfirming('resign')}>
              🏳️ Resign
            </button>
          </div>
        )}

        <section className="move-list" aria-labelledby="moves-title">
          <h2 id="moves-title">Moves</h2>
          {rows.length === 0 ? (
            <p className="move-list__empty">
              {game.studentColour === 'white' ? 'You go first. White always starts!' : 'The bot goes first.'}
            </p>
          ) : (
            <ol>
              {rows.map((row) => (
                <li key={row.number}>
                  <span className="move-list__number">{row.number}.</span>
                  <span>{row.white}</span>
                  <span>{row.black ?? ''}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
}
