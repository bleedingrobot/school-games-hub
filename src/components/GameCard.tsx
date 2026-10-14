import { Link } from 'react-router';
import type { CSSProperties } from 'react';
import type { BotLevel, GameDefinition } from '../games/types';
import { BotLevelPicker } from './BotLevelPicker';

export function GameCard({
  game,
  level,
  onLevelChange,
}: {
  game: GameDefinition;
  level: BotLevel;
  onLevelChange: (level: BotLevel) => void;
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
      <BotLevelPicker
        name={`level-${game.id}`}
        legend="Bot level"
        value={level}
        onChange={onLevelChange}
      />
      <Link className="button button--light" to={`/${game.id}?bot=${level}`}>
        Play {game.name} vs bot
      </Link>
    </article>
  );
}
