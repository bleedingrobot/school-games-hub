import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ClaimedEnding } from '../../../shared/botGame';
import {
  judgeCheckersGame,
  type CheckersGameReport,
  type JudgedCheckersGame,
} from '../../../shared/checkers/botGame';
import {
  findMove,
  mustCapture,
  replay,
  startPosition,
  type CheckersMove,
  type Colour,
} from '../../../shared/checkers/rules';
import { useAuth } from '../../auth/AuthContext';
import { AvatarImage } from '../../avatar/AvatarImage';
import { BotLevelPicker } from '../../components/BotLevelPicker';
import { refreshSaveToken, saveAbandonedGame, saveBotGame } from '../../data/botGames';
import { FriendlyError } from '../../data/profile';
import { useSound } from '../../sound';
import { playSound, type GameSound } from '../sounds';
import { BOT_LEVELS, type BotLevel } from '../types';
import { BOT_DESCRIPTIONS } from './bot';
import { startCheckersBot, type CheckersBot } from './botThread';
import { Board } from './Board';
import { Captured, pretty } from './moveText';

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
  judged: JudgedCheckersGame | null;
}

const ENDING_TEXT: Record<string, { won?: string; lost?: string; drawn?: string }> = {
  'no-pieces': {
    won: 'You captured every one of the bot’s pieces. Brilliant!',
    lost: 'The bot captured all of your pieces this time.',
  },
  'no-moves': {
    won: 'The bot’s pieces are all blocked, so it can’t move. You win!',
    lost: 'All of your pieces are blocked, so you can’t move. The bot wins this time.',
  },
  'forty-moves': { drawn: '40 moves each with no capture and no new king, so it’s a draw.' },
  resigned: { lost: 'You resigned. Good effort. Have another go!' },
};

const RESULT_HEADLINE = {
  won: { emoji: '🏆', title: 'You won!' },
  lost: { emoji: '💪', title: 'The bot won this time' },
  drawn: { emoji: '🤝', title: 'It’s a draw!' },
};

const NAME: Record<Colour, string> = { red: 'Red', white: 'White' };

function pickColour(choice: ColourChoice): Colour {
  if (choice !== 'random') return choice;
  return Math.random() < 0.5 ? 'red' : 'white';
}

export function CheckersPlay({ level }: { level: BotLevel }) {
  const { profile } = useAuth();
  const { soundOn } = useSound();
  const [, setParams] = useSearchParams();
  const [colourChoice, setColourChoice] = useState<ColourChoice>('red');
  const [game, setGame] = useState<Game | null>(null);
  const [thinking, setThinking] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [confirming, setConfirming] = useState<'resign' | 'new' | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [hint, setHint] = useState('');

  const bot = useRef<CheckersBot | null>(null);
  const live = useRef<Game | null>(null);
  const abandoned = useRef(new Set<number>());
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  live.current = game;

  const levelInfo = BOT_LEVELS.find((l) => l.id === (game?.level ?? level))!;

  // Start the bot's thinking helper when the page opens.
  useEffect(() => {
    bot.current = startCheckersBot();
    return () => {
      bot.current?.close();
      bot.current = null;
    };
  }, []);

  const replayed = useMemo(() => {
    const result = replay(game?.moves ?? []);
    return result.ok ? result : { position: startPosition(), played: [] as CheckersMove[] };
  }, [game?.moves]);
  const { position, played } = replayed;

  const report = useCallback(
    (g: Game, ending: ClaimedEnding): CheckersGameReport & { game: 'checkers' } => ({
      game: 'checkers',
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
    const studentMoved = g.moves.length > (g.studentColour === 'red' ? 0 : 1);
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
      const judged = judgeCheckersGame(report(g, ending));
      if (!judged.ok) return;
      const done = { ...g, judged: judged.game };
      setGame(done);
      setConfirming(null);
      setShowResult(true);
      setHint('');
      sound(judged.game.outcome === 'won' ? 'win' : 'end');
      void save(done, ending);
    },
    [report, save, sound],
  );

  const addMove = useCallback(
    (g: Game, notation: string) => {
      const check = replay(g.moves);
      if (!check.ok) return;
      const move = findMove(check.position, notation);
      if (!move) return;
      const next = { ...g, moves: [...g.moves, notation] };
      setGame(next);
      sound(move.crowns ? 'alert' : move.captures.length > 0 ? 'capture' : 'move');
      const after = replay(next.moves);
      if (after.ok && after.result) finish(next, 'finished');
    },
    [finish, sound],
  );

  function start() {
    recordIfAbandoned();
    void refreshSaveToken();
    setGame({ id: Date.now(), level, studentColour: pickColour(colourChoice), moves: [], judged: null });
    setSaveStatus(null);
    setConfirming(null);
    setShowResult(false);
    setHint('');
  }

  /** Same bot, same colour, fresh board. */
  function rematch() {
    if (!game) return;
    void refreshSaveToken();
    setGame({ id: Date.now(), level: game.level, studentColour: game.studentColour, moves: [], judged: null });
    setSaveStatus(null);
    setConfirming(null);
    setShowResult(false);
    setHint('');
  }

  const botsTurn = !!game && !game.judged && position.turn !== game.studentColour;

  // The bot's turn: think, wait a moment so it feels natural, then move.
  useEffect(() => {
    if (!game || !botsTurn) return;
    let cancelled = false;
    setThinking(true);
    const pause = new Promise((resolve) => setTimeout(resolve, BOT_PAUSE_MS.min + Math.random() * BOT_PAUSE_MS.extra));
    const thinkingAbout = position;
    bot.current ??= startCheckersBot();
    bot.current.bestMove(thinkingAbout, game.level).then(async (move) => {
      await pause;
      if (cancelled || live.current?.id !== game.id) return;
      setThinking(false);
      addMove(live.current, move.notation);
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
          🔴 Checkers vs bot
        </h1>
        <div className="chess-setup__card">
          <BotLevelPicker
            name="checkers-level"
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
                  ['red', 'Red (you go first)'],
                  ['white', 'White'],
                  ['random', 'Surprise me'],
                ] as const
              ).map(([value, text]) => (
                <label key={value} className="level-picker__option">
                  <input
                    type="radio"
                    name="checkers-colour"
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
          <div className="chess-setup__help">
            <p>
              <strong>How to play:</strong> tap one of your pieces, then tap a dot to move it there. Pieces move
              diagonally forwards. Jump over the bot’s pieces to capture them.
            </p>
            <p>
              <strong>The big rule:</strong> if you can jump, you must! Reach the far side to get a crowned king, which
              can move backwards too. With a keyboard, use the arrow keys and press Enter.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ---------- During and after a game ----------
  const judged = game.judged;
  const studentTurn = !judged && !botsTurn;
  const jumpRequired = studentTurn && mustCapture(position);
  const rows: { number: number; red?: string; white?: string }[] = [];
  played.forEach((move, i) => {
    const row = Math.floor(i / 2);
    rows[row] ??= { number: row + 1 };
    rows[row][i % 2 === 0 ? 'red' : 'white'] = pretty(move.notation) + (move.crowns ? ' ♛' : '');
  });
  // Red moves first, so Red's moves are the even-numbered ones (counting from 0).
  const capturedBy = (colour: Colour) =>
    played.filter((_, i) => (i % 2 === 0 ? 'red' : 'white') === colour).reduce((n, m) => n + m.captures.length, 0);
  const botColour: Colour = game.studentColour === 'red' ? 'white' : 'red';
  const lastPlayed = played[played.length - 1];

  let status: string;
  if (judged) status = RESULT_HEADLINE[judged.outcome].title;
  else if (thinking || botsTurn) status = `${levelInfo.label} bot is thinking…`;
  else if (jumpRequired) status = 'Your turn: you must jump!';
  else status = 'Your turn';

  const headline = judged && RESULT_HEADLINE[judged.outcome];
  const explanation = judged && ENDING_TEXT[judged.reason]?.[judged.outcome];

  return (
    <div className="chess-game">
      <div className="chess-game__board">
        <Board
          position={position}
          orientation={game.studentColour}
          canMove={studentTurn}
          lastMove={lastPlayed?.path ?? null}
          onMove={(move) => addMove(game, move.notation)}
          onHint={setHint}
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
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => void save(game, judged.reason === 'resigned' ? 'resigned' : 'finished')}
                    >
                      Try again
                    </button>
                  </>
                )}
              </p>
              <div className="chess-result__buttons">
                <button type="button" className="button button--primary" onClick={rematch} autoFocus>
                  Rematch
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
            <span className="player-card__colour">{NAME[botColour]}</span>
          </div>
          <Captured count={capturedBy(botColour)} colour={game.studentColour} who="The bot" />
        </div>

        <div className={`player-card${studentTurn ? ' is-turn' : ''}`}>
          <AvatarImage avatar={profile?.avatar} size={48} />
          <div>
            <strong>{profile?.display_name ?? 'You'}</strong>
            <span className="player-card__colour">{NAME[game.studentColour]} (you)</span>
          </div>
          <Captured count={capturedBy(game.studentColour)} colour={botColour} who="You" />
        </div>

        <p className={`turn-status${jumpRequired ? ' is-check' : ''}`} role="status" aria-live="polite">
          {status}
        </p>
        {jumpRequired && !hint && (
          <p className="chess-note">When you can jump, you have to. The pieces that can jump are glowing.</p>
        )}
        {hint && !judged && (
          <p className="chess-note" role="alert">
            {hint}
          </p>
        )}

        {judged ? (
          <div className="chess-actions">
            <button type="button" className="button button--primary" onClick={rematch}>
              Rematch
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
              {game.studentColour === 'red' ? 'You go first. Red always starts!' : 'The bot goes first. Red always starts!'}
            </p>
          ) : (
            <ol>
              {rows.map((row) => (
                <li key={row.number}>
                  <span className="move-list__number">{row.number}.</span>
                  <span>{row.red}</span>
                  <span>{row.white ?? ''}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
}
