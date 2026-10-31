import { Link } from 'react-router';
import type { CSSProperties } from 'react';
import type { BotLevel, GameDefinition } from '../games/types';
import type { CardMoves } from '../data/movesLeft';
import { BotLevelPicker } from './BotLevelPicker';
import { gameCardArt } from './gameCardArt';

/**
 * A game on the home page, in the Marble Rush course-card look: its painted scene across the top, a panel over the bottom
 * of the picture with the name, tagline and moves left, then bot levels and a Play button that carries the same picture.
 * A game with no picture yet shows a band of its own colours with its icon.
 */
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
  const art = gameCardArt(game.id);
  const style = {
    '--card-a': game.colours[0],
    '--card-b': game.colours[1],
    ...(art ? { '--card-art': `url("${art.small}")`, '--card-focus': art.focus ?? 'center 65%' } : {}),
  } as CSSProperties;
  return (
    <article className={art ? 'game-card game-card--art' : 'game-card'} style={style} aria-labelledby={`game-${game.id}-title`}>
      {art ? (
        <img
          className="game-card__pic"
          src={art.small}
          srcSet={`${art.small} 800w, ${art.card} 1600w`}
          sizes="(max-width: 700px) 100vw, 400px"
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="game-card__pic game-card__pic--none" aria-hidden="true">
          <Icon size={44} />
        </div>
      )}
      <div className="game-card__body">
        <div className="game-card__text">
          <h3 id={`game-${game.id}-title`}>{game.name}</h3>
          <p>{game.tagline}</p>
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
        <div className="game-card__do">
          {!game.noBots && (
            <BotLevelPicker name={`level-${game.id}`} legend="Bot level" value={level} onChange={onLevelChange} joined />
          )}
          <Link
            className="game-card__go"
            to={game.noBots ? `/${game.id}` : `/${game.id}?bot=${level}`}
            aria-label={game.noBots ? undefined : `Play ${game.name} vs bot`}
          >
            Play {game.name}
          </Link>
        </div>
      </div>
    </article>
  );
}
