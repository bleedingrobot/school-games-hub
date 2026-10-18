import { Link } from 'react-router';
import type { CSSProperties } from 'react';
import type { BotLevel, GameDefinition } from '../games/types';
import type { CardMoves } from '../data/movesLeft';
import { BotLevelPicker } from './BotLevelPicker';

export function GameCard({
  game,
  level,
  onLevelChange,
  moves,
}: {
  game: GameDefinition;
  level: BotLevel;
  onLevelChange: (level: BotLevel) => void;
  /** Today's daily allowance in this game, for games that have one. */
  moves?: CardMoves;
}) {
  const { Icon } = game;
  return (
    <article
      className="game-card"
      style={{ '--card-a': game.colours[0], '--card-b': game.colours[1] } as CSSProperties}
      aria-labelledby={`game-${game.id}-title`}
    >
      <div className="game-card__top">
        <div className="game-card__icon">
          <Icon size={72} />
        </div>
        <div>
          <h3 id={`game-${game.id}-title`}>{game.name}</h3>
          <p>{game.tagline}</p>
        </div>
      </div>
      {moves && (
        <div className="game-card__moves" aria-label="Moves left today">
          {moves.allDone ? (
            <p className="game-card__moves-done">All done for today. See you tomorrow!</p>
          ) : (
            <>
              <p className="game-card__moves-title">Left today</p>
              <ul>
                {moves.chips.map((chip) => (
                  <li key={chip.text} className={chip.empty ? 'is-empty' : undefined}>
                    <span aria-hidden="true">{chip.emoji}</span> {chip.text}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {game.noBots ? (
        <Link className="button button--light" to={`/${game.id}`}>
          Play {game.name}
        </Link>
      ) : (
        <>
          <BotLevelPicker
            name={`level-${game.id}`}
            legend="Bot level"
            value={level}
            onChange={onLevelChange}
          />
          <Link className="button button--light" to={`/${game.id}?bot=${level}`}>
            Play {game.name} vs bot
          </Link>
        </>
      )}
    </article>
  );
}
